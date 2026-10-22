from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models import (
    KitchenQueue,
    Payment,
    PriorityVerificationLog,
    Session,
    Transaction,
    TransactionItem,
)
from app.models.enums import (
    PaymentMethod,
    PaymentStatus,
    PriorityStatus,
    PrintStatus,
    SessionType,
    TxnStatus,
)

QUEUE_LOCK_SQL = text("SELECT pg_advisory_xact_lock(hashtext('kitchen_queue'))")
CENTAVO = Decimal("0.01")

NEXT_STATUS = {
    TxnStatus.PENDING: TxnStatus.PREPARING,
    TxnStatus.PREPARING: TxnStatus.READY,
    TxnStatus.READY: TxnStatus.COMPLETED,
}


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENTAVO, rounding=ROUND_HALF_UP)


@dataclass
class QueueEntry:
    slot: KitchenQueue
    transaction: Transaction

    @property
    def is_priority(self) -> bool:
        return self.transaction.is_priority

    @property
    def started(self) -> bool:
        return self.slot.prep_started_at is not None

    @property
    def protected(self) -> bool:
        return self.slot.priority_skips_used >= settings.MAX_PRIORITY_SKIPS


async def lock_queue(db: AsyncSession) -> None:
    """Serialise queue mutation for the whole transaction."""
    await db.execute(QUEUE_LOCK_SQL)


async def pending_entries(db: AsyncSession) -> list[QueueEntry]:
    rows = await db.execute(
        select(KitchenQueue, Transaction)
        .join(Transaction, Transaction.txn_id == KitchenQueue.txn_id)
        .where(KitchenQueue.completed_at.is_(None))
        .order_by(KitchenQueue.queue_position)
    )
    return [QueueEntry(slot=slot, transaction=txn) for slot, txn in rows]


async def place_in_queue(db: AsyncSession, transaction: Transaction) -> KitchenQueue:
    """Insert an order per Algorithms.md §2.3, with the three invariants held."""
    await lock_queue(db)
    queue = await pending_entries(db)

    slot = KitchenQueue(txn_id=transaction.txn_id, queue_position=len(queue) + 1)

    if not transaction.is_priority:
        db.add(slot)
        return slot

    index = 0
    while index < len(queue) and (
        queue[index].started or queue[index].is_priority or queue[index].protected
    ):
        index += 1

    for entry in queue[index:]:
        if not entry.is_priority and not entry.started:
            entry.slot.priority_skips_used += 1

    db.add(slot)
    await db.flush()

    reordered = [*queue[:index], QueueEntry(slot=slot, transaction=transaction), *queue[index:]]
    for position, entry in enumerate(reordered, start=1):
        entry.slot.queue_position = position

    return slot


async def list_queue(db: AsyncSession) -> list[tuple[KitchenQueue, Transaction, Session]]:
    rows = await db.execute(
        select(KitchenQueue, Transaction, Session)
        .join(Transaction, Transaction.txn_id == KitchenQueue.txn_id)
        .join(Session, Session.session_id == Transaction.session_id)
        .where(KitchenQueue.completed_at.is_(None))
        .order_by(KitchenQueue.queue_position)
    )
    return [(slot, txn, session) for slot, txn, session in rows]


# Update
async def verify_priority_id(
    db: AsyncSession,
    txn_id: int,
    id_last4: str,
    cardholder_name: str,
    issuing_lgu: str,
    staff_id: str,
) -> Transaction:
    """Record the physical Senior/PWD ID inspection by Service Crew."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")

    session = await db.get(Session, transaction.session_id)
    if session is None or session.declared_priority_status is PriorityStatus.STANDARD:
        raise BusinessRuleError("This order does not have a priority declaration.")

    now = datetime.now(UTC)
    verif = await db.scalar(
        select(PriorityVerificationLog).where(
            PriorityVerificationLog.session_id == transaction.session_id
        )
    )
    eligible = session.declared_priority_status in (
        PriorityStatus.SENIOR,
        PriorityStatus.PWD,
    )
    if verif is None:
        db.add(
            PriorityVerificationLog(
                session_id=transaction.session_id,
                declared_status=session.declared_priority_status,
                id_presented=True,
                id_last4=id_last4,
                cardholder_name=cardholder_name,
                issuing_lgu=issuing_lgu,
                verified_by=staff_id,
                verified_at=now,
                discount_eligible=eligible,
            )
        )
    else:
        verif.id_presented = True
        verif.id_last4 = id_last4
        verif.cardholder_name = cardholder_name
        verif.issuing_lgu = issuing_lgu
        verif.verified_by = staff_id
        verif.verified_at = now
        verif.discount_eligible = eligible

    await db.commit()
    await db.refresh(transaction)
    return transaction


# Update
async def revoke_priority_discount(
    db: AsyncSession, txn_id: int, staff_id: str
) -> Transaction:
    """Revert an unverified Senior/PWD discount to standard VAT-inclusive pricing when no physical ID is presented."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")

    session = await db.get(Session, transaction.session_id)
    if session is None:
        raise NotFoundError("Table session not found.")

    now = datetime.now(UTC)
    verif = await db.scalar(
        select(PriorityVerificationLog).where(
            PriorityVerificationLog.session_id == transaction.session_id
        )
    )
    if verif is not None:
        verif.id_presented = False
        verif.id_last4 = None
        verif.cardholder_name = None
        verif.issuing_lgu = None
        verif.verified_by = staff_id
        verif.verified_at = now
        verif.discount_eligible = False

    session.declared_priority_status = PriorityStatus.STANDARD
    session.session_type = (
        SessionType.GROUP if session.group_mode else SessionType.STANDARD
    )

    divisor = Decimal(1) + settings.VAT_RATE
    items = list(
        await db.scalars(
            select(TransactionItem).where(TransactionItem.txn_id == txn_id)
        )
    )

    gross_total = Decimal("0.00")
    vatable_total = Decimal("0.00")
    vat_total = Decimal("0.00")

    for line in items:
        line_gross = _money(line.unit_price * line.quantity)
        line_vatable = _money(line_gross / divisor)
        line_vat = line_gross - line_vatable
        line.subtotal = line_gross
        line.is_discounted = False
        line.discount_amount = Decimal("0.00")
        gross_total += line_gross
        vatable_total += line_vatable
        vat_total += line_vat

    transaction.gross_amount = gross_total
    transaction.vatable_sales = vatable_total
    transaction.vat_exempt_sales = Decimal("0.00")
    transaction.vat_amount = vat_total
    transaction.discount_amount = Decimal("0.00")
    transaction.net_amount = gross_total
    transaction.is_priority = False

    payments = list(
        await db.scalars(
            select(Payment)
            .where(Payment.txn_id == txn_id)
            .order_by(Payment.payment_id.asc())
        )
    )
    paid_total = sum(
        (p.amount for p in payments if p.status == PaymentStatus.PAID),
        Decimal("0.00"),
    )
    unpaid_payments = [p for p in payments if p.status != PaymentStatus.PAID]
    remaining_due = gross_total - paid_total

    if remaining_due > Decimal("0.00"):
        if unpaid_payments:
            if len(unpaid_payments) == 1:
                unpaid_payments[0].amount = remaining_due
                unpaid_payments[0].discount_applied = Decimal("0.00")
            else:
                extra = remaining_due - sum(
                    (p.amount for p in unpaid_payments), Decimal("0.00")
                )
                unpaid_payments[0].amount += extra
                for p in unpaid_payments:
                    p.discount_applied = Decimal("0.00")
        else:
            db.add(
                Payment(
                    txn_id=txn_id,
                    device_id=payments[0].device_id if payments else None,
                    method=PaymentMethod.CASHIER,
                    amount=remaining_due,
                    discount_applied=Decimal("0.00"),
                    aggregator_ref="DISCOUNT-DIFF",
                    status=PaymentStatus.PENDING,
                )
            )

    await db.commit()
    await db.refresh(transaction)
    return transaction


async def advance_status(
    db: AsyncSession, txn_id: int, target: TxnStatus, staff_id: str
) -> Transaction:
    """Move an order one step along pending -> preparing -> ready -> completed."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")

    expected = NEXT_STATUS.get(transaction.status)
    if expected is None:
        raise BusinessRuleError(
            f"Order Q-{transaction.queue_number:03d} is already {transaction.status.value}."
        )
    if target is not expected:
        raise BusinessRuleError(
            f"Order Q-{transaction.queue_number:03d} moves to {expected.value} next, "
            f"not {target.value}."
        )

    if target is TxnStatus.PREPARING:
        payments = list(
            await db.scalars(select(Payment).where(Payment.txn_id == txn_id))
        )
        unpaid = [p for p in payments if p.status != PaymentStatus.PAID]
        if unpaid:
            remaining = sum((p.amount for p in unpaid), Decimal("0.00"))
            raise BusinessRuleError(
                f"Order Q-{transaction.queue_number:03d} cannot be prepared yet — "
                f"{len(unpaid)} payment share(s) (₱{remaining:.2f}) are still unpaid."
            )

    if target is TxnStatus.COMPLETED and transaction.discount_amount > Decimal("0.00"):
        verif = await db.scalar(
            select(PriorityVerificationLog).where(
                PriorityVerificationLog.session_id == transaction.session_id
            )
        )
        if verif is None or verif.verified_by is None:
            raise BusinessRuleError(
                f"Order Q-{transaction.queue_number:03d} has a Senior/PWD discount. "
                "Please click 'Verify Senior / PWD ID' when handing over the order (or revert to standard price if no ID is presented)."
            )

    slot = await db.scalar(select(KitchenQueue).where(KitchenQueue.txn_id == txn_id))
    now = datetime.now(UTC)

    transaction.status = target
    if slot is not None:
        slot.updated_by = staff_id
        if target is TxnStatus.PREPARING:
            slot.prep_started_at = now
        elif target is TxnStatus.COMPLETED:
            slot.completed_at = now

    await db.commit()
    await db.refresh(transaction)
    return transaction


async def confirm_cash_payment(db: AsyncSession, txn_id: int, staff_id: str) -> Transaction:
    """Mark all unpaid payment shares settled once the crew has collected cash."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")

    payments = list(
        await db.scalars(select(Payment).where(Payment.txn_id == txn_id))
    )
    if not payments:
        raise NotFoundError("That order has no payment record.")

    unpaid = [p for p in payments if p.status != PaymentStatus.PAID]
    if not unpaid:
        raise BusinessRuleError(
            f"Order Q-{transaction.queue_number:03d} is already marked paid."
        )

    now = datetime.now(UTC)
    for payment in unpaid:
        payment.status = PaymentStatus.PAID
        payment.paid_at = now
        payment.print_status = PrintStatus.SUCCESS

    slot = await db.scalar(select(KitchenQueue).where(KitchenQueue.txn_id == txn_id))
    if slot is not None:
        slot.updated_by = staff_id

    await db.commit()
    await db.refresh(transaction)
    return transaction