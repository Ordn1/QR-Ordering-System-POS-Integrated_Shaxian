"""Cashier ID checks for the senior and PWD discount, per Security.md §5.7.

A self-declared senior or PWD phone gets the statutory discount provisionally. The
discount becomes final only when a crew member checks the ID at the counter; a
rejected check re-prices that phone's lines at full VAT before any cash is taken.
"""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models import AuditLog, Payment, PriorityVerificationLog, Transaction, TransactionItem
from app.models.enums import PaymentStatus, TxnStatus
from app.schemas.queue import IdCheckWrite, VerificationWrite
from app.services import order as order_service

ACTION = "priority_id_checked"
ENTITY = "priority_verification_log"


def _net(items: list[TransactionItem], eligible: bool | None) -> Decimal:
    return order_service.price_order(
        [
            order_service.CartLine(
                item_id=item.item_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_eligible=item.is_discounted if eligible is None else eligible,
            )
            for item in items
        ]
    ).net_amount


def price_deltas(items: list[TransactionItem], device_id: int) -> tuple[Decimal, Decimal]:
    """How an order's amount due moves if this phone's ID is accepted, and if it is refused."""
    own = [item for item in items if item.device_id == device_id]
    current = _net(own, None)
    return _net(own, True) - current, _net(own, False) - current


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
    card: IdCheckWrite | VerificationWrite | None = None,
) -> Transaction:
    """Record the cashier's ID check and re-price the claiming phone's lines to match.

    Card details are optional and kept only for an accepted ID: the last four digits,
    the cardholder and the issuing LGU.
    """
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
    log.verified_by = staff_id
    log.verified_at = datetime.now(UTC)
    log.discount_eligible = verified
    if verified and card is not None:
        log.id_last4 = card.id_last4
        log.cardholder_name = card.cardholder_name
        log.issuing_lgu = card.issuing_lgu
    await db.flush()

    await order_service.reprice_device_lines(db, transaction, log.device_id)
    others = list(
        await db.scalars(
            select(Transaction)
            .join(TransactionItem, TransactionItem.txn_id == Transaction.txn_id)
            .where(
                Transaction.session_id == transaction.session_id,
                Transaction.txn_id != txn_id,
                Transaction.status != TxnStatus.VOIDED,
                TransactionItem.device_id == log.device_id,
            )
            .distinct()
        )
    )
    for other in others:
        await order_service.reprice_device_lines(db, other, log.device_id)

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
                "card_recorded": log.id_last4 is not None,
                "net_amount": str(transaction.net_amount),
                "discount_amount": str(transaction.discount_amount),
                "also_repriced": [other.txn_id for other in others],
            },
        )
    )

    await db.commit()
    await db.refresh(transaction)
    return transaction


async def verify_next(db: AsyncSession, txn_id: int, staff_id: str) -> Transaction:
    """Verify the oldest pending claim on this order. A second senior at the table is a second call."""
    claims = await _claims_for(db, txn_id)
    return await record_check(db, txn_id, claims[0].log_id, staff_id, True)


async def revoke_pending(db: AsyncSession, txn_id: int, staff_id: str) -> Transaction:
    """No valid ID was shown: reject every pending claim on this order and re-price it."""
    claims = await _claims_for(db, txn_id)
    transaction = None
    for claim in claims:
        transaction = await record_check(db, txn_id, claim.log_id, staff_id, False)
    return transaction


async def _claims_for(db: AsyncSession, txn_id: int) -> list[PriorityVerificationLog]:
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")
    claims = (await pending_checks(db, [transaction])).get(txn_id, [])
    if not claims:
        raise BusinessRuleError("No senior or PWD ID check is waiting on this order.")
    return claims
