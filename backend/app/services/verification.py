"""Cashier ID checks for the senior and PWD discount, per Security.md §5.7.

A self-declared senior or PWD phone gets the statutory discount provisionally. The
discount becomes final only when a crew member checks the ID at the counter; a
rejected check re-prices that phone's lines at full VAT before any cash is taken.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models import AuditLog, Payment, PriorityVerificationLog, Transaction, TransactionItem
from app.models.enums import PaymentStatus
from app.services import order as order_service
from app.services import queue as queue_service

ACTION = "priority_id_checked"
ENTITY = "priority_verification_log"


async def pending_checks(
    db: AsyncSession, transactions: list[Transaction]
) -> dict[int, list[PriorityVerificationLog]]:
    """Unchecked discount claims per order, limited to phones that still owe money on it."""
    if not transactions:
        return {}

    txn_ids = [txn.txn_id for txn in transactions]

    devices_by_txn: dict[int, set[int | None]] = {}
    for txn_id, device_id in await db.execute(
        select(TransactionItem.txn_id, TransactionItem.device_id)
        .where(TransactionItem.txn_id.in_(txn_ids))
        .distinct()
    ):
        devices_by_txn.setdefault(txn_id, set()).add(device_id)

    paid_by_txn: dict[int, set[int | None]] = {}
    unpaid_txns: set[int] = set()
    for payment in await db.scalars(select(Payment).where(Payment.txn_id.in_(txn_ids))):
        if payment.status is PaymentStatus.PAID:
            paid_by_txn.setdefault(payment.txn_id, set()).add(payment.device_id)
        else:
            unpaid_txns.add(payment.txn_id)

    logs = list(
        await db.scalars(
            select(PriorityVerificationLog)
            .where(
                PriorityVerificationLog.session_id.in_({txn.session_id for txn in transactions}),
                PriorityVerificationLog.discount_eligible.is_(True),
                PriorityVerificationLog.verified_at.is_(None),
            )
            .order_by(PriorityVerificationLog.log_id)
        )
    )

    pending: dict[int, list[PriorityVerificationLog]] = {}
    for txn in transactions:
        if txn.txn_id not in unpaid_txns:
            continue
        owing = devices_by_txn.get(txn.txn_id, set()) - paid_by_txn.get(txn.txn_id, set())
        claims = [
            log for log in logs if log.session_id == txn.session_id and log.device_id in owing
        ]
        if claims:
            pending[txn.txn_id] = claims
    return pending


async def record_check(
    db: AsyncSession,
    txn_id: int,
    log_id: int,
    staff_id: str,
    verified: bool,
    id_last4: str | None,
    cardholder_name: str | None,
    issuing_lgu: str | None,
) -> Transaction:
    """Record the cashier's ID check and re-price the claiming phone's lines to match."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")

    claims = (await pending_checks(db, [transaction])).get(txn_id, [])
    log = next((claim for claim in claims if claim.log_id == log_id), None)
    if log is None:
        raise BusinessRuleError("That ID check is no longer waiting on this order. Refresh the queue.")

    before = {
        "discount_eligible": log.discount_eligible,
        "net_amount": str(transaction.net_amount),
        "discount_amount": str(transaction.discount_amount),
    }

    log.id_presented = verified
    log.id_last4 = id_last4 if verified else None
    log.cardholder_name = cardholder_name if verified else None
    log.issuing_lgu = issuing_lgu if verified else None
    log.verified_by = staff_id
    log.verified_at = datetime.now(UTC)
    log.discount_eligible = verified
    await db.flush()

    await order_service.reprice_device_lines(db, transaction, log.device_id)

    db.add(
        AuditLog(
            staff_id=staff_id,
            action=ACTION,
            entity_type=ENTITY,
            entity_id=str(log.log_id),
            before_state=before,
            after_state={
                "txn_id": txn_id,
                "outcome": "verified" if verified else "rejected",
                "declared_status": log.declared_status.value,
                "discount_eligible": log.discount_eligible,
                "net_amount": str(transaction.net_amount),
                "discount_amount": str(transaction.discount_amount),
            },
        )
    )

    await db.commit()
    await db.refresh(transaction)
    return transaction


async def has_pending_check(db: AsyncSession, transaction: Transaction) -> bool:
    return bool((await pending_checks(db, [transaction])).get(transaction.txn_id))


async def settle_cash(db: AsyncSession, txn_id: int, staff_id: str) -> Transaction:
    """Take cash only once every discount on the order has been checked against an ID."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")
    if await has_pending_check(db, transaction):
        raise BusinessRuleError("Check the senior or PWD ID before confirming payment.")
    return await queue_service.confirm_cash_payment(db, txn_id, staff_id)
