from decimal import Decimal
import logging

from fastapi import APIRouter
from sqlalchemy import select

from app.config import settings
from app.core.deps import AnyStaff, DbSession
from app.core.exceptions import BusinessRuleError
from app.models import (
    KitchenQueue,
    MenuItem,
    Payment,
    PriorityVerificationLog,
    Table,
    Transaction,
    TransactionItem,
)
from app.models.enums import PaymentMethod, PaymentStatus
from app.schemas.queue import (
    CashPaymentWrite,
    OrderStatusRead,
    PriorityVerifyWrite,
    QueueEntryRead,
    QueueItemRead,
    StatusWrite,
)
from app.services import order as order_service
from app.services import pos as pos_service
from app.services import queue as queue_service
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
    rows = await queue_service.list_queue(db)
    if not rows:
        return []

    txn_ids = [txn.txn_id for _, txn, _ in rows]
    tables = {table.table_id: table.table_number for table in await db.scalars(select(Table))}
    all_payments = list(
        await db.scalars(
            select(Payment).where(Payment.txn_id.in_(txn_ids))
        )
    )
    payments_by_txn: dict[int, list[Payment]] = {}
    for p in all_payments:
        payments_by_txn.setdefault(p.txn_id, []).append(p)

    item_rows = await db.execute(
        select(TransactionItem, MenuItem)
        .join(MenuItem, MenuItem.item_id == TransactionItem.item_id)
        .where(TransactionItem.txn_id.in_(txn_ids))
        .order_by(TransactionItem.txi_id)
    )
    items_by_txn: dict[int, list[QueueItemRead]] = {}
    for line, menu_item in item_rows.all():
        items_by_txn.setdefault(line.txn_id, []).append(
            QueueItemRead(
                item_id=line.item_id,
                name=menu_item.name_en,
                qty=line.quantity,
                unit_price=line.unit_price,
                subtotal=line.subtotal,
            )
        )

    session_ids = [session.session_id for _, _, session in rows]
    verifs = list(
        await db.scalars(
            select(PriorityVerificationLog).where(
                PriorityVerificationLog.session_id.in_(session_ids)
            )
        )
    )
    verif_by_session = {v.session_id: v for v in verifs}

    result: list[QueueEntryRead] = []
    for slot, txn, session in rows:
        txn_payments = payments_by_txn.get(txn.txn_id, [])
        method, status = _summary_method_and_status(txn_payments)
        unpaid_amt = sum(
            (p.amount for p in txn_payments if p.status != PaymentStatus.PAID),
            Decimal("0.00"),
        )
        verif = verif_by_session.get(session.session_id)
        result.append(
            QueueEntryRead(
                txn_id=txn.txn_id,
                queue_position=slot.queue_position,
                queue_number=txn.queue_number,
                priority_skips_used=slot.priority_skips_used,
                is_priority=txn.is_priority,
                declared_priority_status=session.declared_priority_status,
                id_verified=bool(verif and verif.verified_by is not None and verif.id_presented),
                id_last4=verif.id_last4 if verif else None,
                cardholder_name=verif.cardholder_name if verif else None,
                issuing_lgu=verif.issuing_lgu if verif else None,
                session_type=session.session_type,
                table_number=tables[session.table_id],
                status=txn.status,
                item_count=txn.item_count,
                gross_amount=txn.gross_amount,
                vatable_sales=txn.vatable_sales,
                vat_exempt_sales=txn.vat_exempt_sales,
                vat_amount=txn.vat_amount,
                discount_amount=txn.discount_amount,
                net_amount=txn.net_amount,
                unpaid_amount=unpaid_amt,
                payment_method=method,
                payment_status=status,
                entered_queue_at=slot.entered_queue_at,
                prep_started_at=slot.prep_started_at,
                items=items_by_txn.get(txn.txn_id, []),
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


@router.post("/{txn_id}/verify-id", response_model=OrderStatusRead)
async def verify_id(
    txn_id: int, payload: PriorityVerifyWrite, db: DbSession, staff: AnyStaff
) -> OrderStatusRead:
    transaction = await queue_service.verify_priority_id(
        db,
        txn_id,
        id_last4=payload.id_last4,
        cardholder_name=payload.cardholder_name,
        issuing_lgu=payload.issuing_lgu,
        staff_id=staff.staff_id,
    )
    return await order_status(db, transaction)


@router.post("/{txn_id}/revoke-discount", response_model=OrderStatusRead)
async def revoke_discount(
    txn_id: int, db: DbSession, staff: AnyStaff
) -> OrderStatusRead:
    transaction = await queue_service.revoke_priority_discount(
        db, txn_id, staff_id=staff.staff_id
    )
    await events.publish_status(transaction)
    await events.publish_session_changed(transaction.session_id)
    await events.publish_cart_changed(transaction.session_id)
    return await order_status(db, transaction)


@router.post("/{txn_id}/payment", response_model=OrderStatusRead)
async def confirm_payment(
    txn_id: int,
    db: DbSession,
    staff: AnyStaff,
    payload: CashPaymentWrite | None = None,
) -> OrderStatusRead:
    existing_txn = await db.get(Transaction, txn_id)
    existing_payments = list(
        await db.scalars(select(Payment).where(Payment.txn_id == txn_id))
    )
    unpaid_due = sum(
        (p.amount for p in existing_payments if p.status != PaymentStatus.PAID),
        Decimal("0.00"),
    )
    due_amount = (
        unpaid_due
        if unpaid_due > Decimal("0.00")
        else (existing_txn.net_amount if existing_txn else Decimal("0.00"))
    )
    cash_tendered = (
        payload.cash_tendered
        if payload and payload.cash_tendered is not None
        else due_amount
    )
    if existing_txn and cash_tendered < due_amount:
        raise BusinessRuleError(
            f"Cash tendered (₱{cash_tendered:.2f}) is less than amount due (₱{due_amount:.2f})."
        )

    transaction = await queue_service.confirm_cash_payment(db, txn_id, staff_id=staff.staff_id)
    change_due = max(Decimal("0.00"), cash_tendered - due_amount)

    await events.publish_status(transaction)
    await events.publish_cart_changed(transaction.session_id)

    receipt_no: str | None = None
    try:
        tx_result = await pos_service.transmit(
            db,
            txn_id,
            settings.POS_ENDPOINT,
            staff_id=staff.staff_id,
            cash_tendered=cash_tendered,
            change_due=change_due,
        )
        receipt_no = tx_result.receipt_no
    except Exception:  # noqa: BLE001
        logger.exception("POS transmission failed for txn %s", txn_id)

    return await order_status(
        db,
        transaction,
        receipt_no=receipt_no,
        cash_tendered=cash_tendered,
        change_due=change_due,
    )


async def order_status(
    db: DbSession,
    transaction: Transaction,
    receipt_no: str | None = None,
    cash_tendered: Decimal | None = None,
    change_due: Decimal | None = None,
) -> OrderStatusRead:
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
        receipt_no=receipt_no,
        cash_tendered=cash_tendered,
        change_due=change_due,
    )