from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models import KitchenQueue, Payment, Session, Transaction
from app.models.enums import PaymentMethod, PaymentStatus, PrintStatus, TxnStatus

QUEUE_LOCK_SQL = text("SELECT pg_advisory_xact_lock(hashtext('kitchen_queue'))")

NEXT_STATUS = {
    TxnStatus.PENDING: TxnStatus.PREPARING,
    TxnStatus.PREPARING: TxnStatus.READY,
    TxnStatus.READY: TxnStatus.COMPLETED,
}


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
    """Serialise queue mutation for the whole transaction.

    FOR UPDATE alone cannot do this: a row lock does not stop a concurrent INSERT,
    and an already-started statement never sees the new row.
    """
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
    """Insert an order per Algorithms.md §2.3, with the three invariants held.

    The advance condition is evaluated as one predicate rather than three sequential
    loops: run separately, a protected standard order between two priority orders
    lets a newer priority order jump an older one.
    """
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
    """Mark a cashier-fallback payment settled once the crew has taken the cash."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")

    payment = await db.scalar(select(Payment).where(Payment.txn_id == txn_id))
    if payment is None:
        raise NotFoundError("That order has no payment record.")
    if payment.method is not PaymentMethod.CASHIER:
        raise BusinessRuleError("That order was paid online. There is nothing to collect.")
    if payment.status is PaymentStatus.PAID:
        raise BusinessRuleError(
            f"Order Q-{transaction.queue_number:03d} is already marked paid."
        )

    payment.status = PaymentStatus.PAID
    payment.paid_at = datetime.now(UTC)
    payment.print_status = PrintStatus.SUCCESS

    slot = await db.scalar(select(KitchenQueue).where(KitchenQueue.txn_id == txn_id))
    if slot is not None:
        slot.updated_by = staff_id

    await db.commit()
    await db.refresh(transaction)
    return transaction
