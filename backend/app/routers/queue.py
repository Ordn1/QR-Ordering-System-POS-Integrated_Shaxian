import logging

from fastapi import APIRouter
from sqlalchemy import select

from app.config import settings
from app.core.deps import AnyStaff, DbSession
from app.models import KitchenQueue, Payment, Table, Transaction
from app.models.enums import PaymentMethod, PaymentStatus
from app.core.exceptions import NotFoundError
from app.schemas.queue import (
    OrderStatusRead,
    PendingVerificationRead,
    QueueEntryRead,
    StatusWrite,
    VerificationWrite,
)
from app.services import order as order_service
from app.services import pos as pos_service
from app.services import queue as queue_service
from app.services import verification as verification_service
from app.websocket import events

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/queue", tags=["queue"])


def _summary_method_and_status(
    payments: list[Payment],
) -> tuple[PaymentMethod, PaymentStatus]:
    if not payments:
        return PaymentMethod.CASHIER, PaymentStatus.PENDING
    status = order_service.aggregate_payment_status(payments)
    if any(p.status != PaymentStatus.PAID for p in payments):
        return PaymentMethod.CASHIER, status
    if any(p.method is PaymentMethod.ONLINE for p in payments):
        return PaymentMethod.ONLINE, status
    return payments[0].method, status


@router.get("", response_model=list[QueueEntryRead])
async def read_queue(db: DbSession, staff: AnyStaff) -> list[QueueEntryRead]:
    return await build_entries(db, await queue_service.list_queue(db))


async def build_entries(db: DbSession, rows: list) -> list[QueueEntryRead]:
    if not rows:
        return []

    tables = {table.table_id: table.table_number for table in await db.scalars(select(Table))}
    all_payments = list(
        await db.scalars(
            select(Payment).where(Payment.txn_id.in_([txn.txn_id for _, txn, _ in rows]))
        )
    )
    payments_by_txn: dict[int, list[Payment]] = {}
    for p in all_payments:
        payments_by_txn.setdefault(p.txn_id, []).append(p)

    pending = await verification_service.pending_checks(db, [txn for _, txn, _ in rows])

    result: list[QueueEntryRead] = []
    for slot, txn, session in rows:
        method, status = _summary_method_and_status(payments_by_txn.get(txn.txn_id, []))
        result.append(
            QueueEntryRead(
                txn_id=txn.txn_id,
                queue_position=slot.queue_position,
                queue_number=txn.queue_number,
                priority_skips_used=slot.priority_skips_used,
                is_priority=txn.is_priority,
                declared_priority_status=session.declared_priority_status,
                session_type=session.session_type,
                table_number=tables[session.table_id],
                status=txn.status,
                item_count=txn.item_count,
                gross_amount=txn.gross_amount,
                vat_amount=txn.vat_amount,
                discount_amount=txn.discount_amount,
                net_amount=txn.net_amount,
                payment_method=method,
                payment_status=status,
                entered_queue_at=slot.entered_queue_at,
                prep_started_at=slot.prep_started_at,
                pending_verifications=[
                    PendingVerificationRead.model_validate(log)
                    for log in pending.get(txn.txn_id, [])
                ],
            )
        )
    return result


@router.patch("/{txn_id}/status", response_model=OrderStatusRead)
async def update_status(
    txn_id: int, payload: StatusWrite, db: DbSession, staff: AnyStaff
) -> OrderStatusRead:
    transaction = await queue_service.advance_status(db, txn_id, payload.status, staff.staff_id)
    await events.publish_status(transaction)
    return await order_status(db, transaction)


@router.post("/{txn_id}/verification", response_model=QueueEntryRead)
async def record_verification(
    txn_id: int, payload: VerificationWrite, db: DbSession, staff: AnyStaff
) -> QueueEntryRead:
    """Record the cashier's ID check; a rejection re-prices the claiming phone's lines."""
    transaction = await verification_service.record_check(
        db,
        txn_id,
        payload.log_id,
        staff.staff_id,
        payload.outcome == "verified",
        payload.id_last4,
        payload.cardholder_name,
        payload.issuing_lgu,
    )
    await events.publish_status(transaction)
    await events.publish_cart_changed(transaction.session_id)
    await events.publish_session_changed(transaction.session_id)

    rows = [row for row in await queue_service.list_queue(db) if row[1].txn_id == txn_id]
    entries = await build_entries(db, rows)
    if not entries:
        raise NotFoundError("That order has left the queue. Refresh the queue.")
    return entries[0]


@router.post("/{txn_id}/payment", response_model=OrderStatusRead)
async def confirm_payment(txn_id: int, db: DbSession, staff: AnyStaff) -> OrderStatusRead:
    transaction = await verification_service.settle_cash(db, txn_id, staff.staff_id)
    await events.publish_status(transaction)
    await events.publish_cart_changed(transaction.session_id)

    try:
        await pos_service.transmit(
            db, txn_id, settings.POS_ENDPOINT, staff_id=staff.staff_id
        )
    except Exception:  # noqa: BLE001
        logger.exception("POS transmission failed for txn %s", txn_id)

    return await order_status(db, transaction)


async def order_status(db: DbSession, transaction: Transaction) -> OrderStatusRead:
    slot = await db.scalar(
        select(KitchenQueue).where(KitchenQueue.txn_id == transaction.txn_id)
    )
    payments = list(
        await db.scalars(select(Payment).where(Payment.txn_id == transaction.txn_id))
    )
    return OrderStatusRead(
        txn_id=transaction.txn_id,
        queue_number=transaction.queue_number,
        status=transaction.status,
        is_priority=transaction.is_priority,
        queue_position=(
            slot.queue_position if slot is not None and slot.completed_at is None else None
        ),
        net_amount=transaction.net_amount,
        payment_status=order_service.aggregate_payment_status(payments),
    )