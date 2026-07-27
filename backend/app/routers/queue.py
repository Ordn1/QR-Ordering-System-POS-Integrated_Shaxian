import logging

from fastapi import APIRouter
from sqlalchemy import select

from app.config import settings
from app.core.deps import AnyStaff, DbSession
from app.models import KitchenQueue, Payment, Table, Transaction
from app.schemas.queue import OrderStatusRead, QueueEntryRead, StatusWrite
from app.services import pos as pos_service
from app.services import queue as queue_service
from app.websocket import events

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/queue", tags=["queue"])


@router.get("", response_model=list[QueueEntryRead])
async def read_queue(db: DbSession, staff: AnyStaff) -> list[QueueEntryRead]:
    rows = await queue_service.list_queue(db)
    if not rows:
        return []

    tables = {table.table_id: table.table_number for table in await db.scalars(select(Table))}
    payments = {
        payment.txn_id: payment
        for payment in await db.scalars(
            select(Payment).where(Payment.txn_id.in_([txn.txn_id for _, txn, _ in rows]))
        )
    }

    return [
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
            payment_method=payments[txn.txn_id].method,
            payment_status=payments[txn.txn_id].status,
            entered_queue_at=slot.entered_queue_at,
            prep_started_at=slot.prep_started_at,
        )
        for slot, txn, session in rows
    ]


@router.patch("/{txn_id}/status", response_model=OrderStatusRead)
async def update_status(
    txn_id: int, payload: StatusWrite, db: DbSession, staff: AnyStaff
) -> OrderStatusRead:
    transaction = await queue_service.advance_status(db, txn_id, payload.status, staff.staff_id)
    await events.publish_status(transaction)
    return await order_status(db, transaction)


@router.post("/{txn_id}/payment", response_model=OrderStatusRead)
async def confirm_payment(txn_id: int, db: DbSession, staff: AnyStaff) -> OrderStatusRead:
    transaction = await queue_service.confirm_cash_payment(db, txn_id, staff.staff_id)
    await events.publish_status(transaction)

    # §2.2.3.1.13: the sale goes to the register the moment the cash is collected,
    # so the counter never re-keys it. A bridge failure is logged and surfaced on
    # the POS console — it must never fail a payment the crew has already taken.
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
    payment = await db.scalar(select(Payment).where(Payment.txn_id == transaction.txn_id))
    return OrderStatusRead(
        txn_id=transaction.txn_id,
        queue_number=transaction.queue_number,
        status=transaction.status,
        is_priority=transaction.is_priority,
        queue_position=(
            slot.queue_position if slot is not None and slot.completed_at is None else None
        ),
        net_amount=transaction.net_amount,
        payment_status=payment.status,
    )
