from decimal import Decimal

from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import AnyStaff, DbSession
from app.core.exceptions import NotFoundError
from app.models import (
    KitchenQueue,
    MenuItem,
    Payment,
    PriorityVerificationLog,
    Table,
    Transaction,
    TransactionItem,
)
from app.models.enums import PaymentMethod, PaymentStatus, Tender
from app.schemas.assistance import AssistanceQueueRead, AssistanceRead
from app.schemas.pos import TransmitResult
from app.schemas.queue import (
    OrderStatusRead,
    PendingVerificationRead,
    QueueEntryRead,
    QueueItemRead,
    SettlementWrite,
    StatusWrite,
    VerificationWrite,
)
from app.services import assistance as assistance_service
from app.services import order as order_service
from app.services import payment as payment_service
from app.services import queue as queue_service
from app.services import session as session_service
from app.services import verification as verification_service
from app.websocket import events

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


@router.get("/assistance", response_model=list[AssistanceQueueRead])
async def read_assistance(db: DbSession, staff: AnyStaff) -> list[AssistanceQueueRead]:
    return await assistance_service.open_requests(db)


@router.post("/assistance/{request_id}/acknowledge", response_model=AssistanceRead)
async def acknowledge_assistance(
    request_id: int, db: DbSession, staff: AnyStaff
) -> AssistanceRead:
    request = await assistance_service.acknowledge(db, request_id, staff.staff_id)
    await events.publish_assistance_changed(request.session_id)
    return assistance_service.to_read(request)


def claim_read(
    log: PriorityVerificationLog, label, lines: list[TransactionItem]
) -> PendingVerificationRead:
    if_valid, if_invalid = verification_service.price_deltas(lines, log.device_id)
    return PendingVerificationRead(
        log_id=log.log_id,
        device_id=log.device_id,
        declared_status=log.declared_status,
        device_number=label.device_number if label else None,
        display_name=label.display_name if label else None,
        is_companion=bool(label and label.managed_by_device_id is not None),
        managed_by_number=label.managed_by_number if label else None,
        managed_by_name=label.managed_by_name if label else None,
        delta_if_valid=if_valid,
        delta_if_invalid=if_invalid,
    )


async def build_entries(db: DbSession, rows: list) -> list[QueueEntryRead]:
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

    pending = await verification_service.pending_checks(db, [txn for _, txn, _ in rows])
    labels = await session_service.device_labels(db, {session.session_id for _, _, session in rows})
    item_rows = await db.execute(
        select(TransactionItem, MenuItem)
        .join(MenuItem, MenuItem.item_id == TransactionItem.item_id)
        .where(TransactionItem.txn_id.in_(txn_ids))
        .order_by(TransactionItem.txi_id)
    )
    items_by_txn: dict[int, list[QueueItemRead]] = {}
    lines_by_txn: dict[int, list[TransactionItem]] = {}
    for line, menu_item in item_rows.all():
        lines_by_txn.setdefault(line.txn_id, []).append(line)
        items_by_txn.setdefault(line.txn_id, []).append(
            QueueItemRead(
                item_id=line.item_id,
                pos_code=menu_item.pos_code,
                name=menu_item.name_en,
                qty=line.quantity,
                unit_price=line.unit_price,
                subtotal=line.subtotal,
                device_id=line.device_id,
                is_discounted=line.is_discounted,
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
    verif_by_session: dict[int, PriorityVerificationLog] = {}
    for verif in sorted(verifs, key=lambda log: (log.verified_at is not None, log.log_id)):
        verif_by_session[verif.session_id] = verif

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
                pending_verifications=[
                    claim_read(log, labels.get(log.device_id), lines_by_txn.get(txn.txn_id, []))
                    for log in pending.get(txn.txn_id, [])
                ],
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


@router.post("/{txn_id}/verification", response_model=QueueEntryRead)
async def record_verification(
    txn_id: int, payload: VerificationWrite, db: DbSession, staff: AnyStaff
) -> QueueEntryRead:
    transaction = await verification_service.record_check(
        db,
        txn_id,
        payload.log_id,
        staff.staff_id,
        payload.outcome == "verified",
        payload,
    )
    await events.publish_status(transaction)
    await events.publish_cart_changed(transaction.session_id)
    await events.publish_session_changed(transaction.session_id)

    rows = [row for row in await queue_service.list_queue(db) if row[1].txn_id == txn_id]
    entries = await build_entries(db, rows)
    if not entries:
        raise NotFoundError("That order has left the queue. Refresh the queue.")
    return entries[0]


@router.post("/{txn_id}/verify-id", response_model=OrderStatusRead)
async def verify_id(txn_id: int, db: DbSession, staff: AnyStaff) -> OrderStatusRead:
    transaction = await verification_service.verify_next(db, txn_id, staff.staff_id)
    await events.publish_status(transaction)
    await events.publish_cart_changed(transaction.session_id)
    await events.publish_session_changed(transaction.session_id)
    return await order_status(db, transaction)


@router.post("/{txn_id}/revoke-discount", response_model=OrderStatusRead)
async def revoke_discount(
    txn_id: int, db: DbSession, staff: AnyStaff
) -> OrderStatusRead:
    transaction = await verification_service.revoke_pending(db, txn_id, staff.staff_id)
    await events.publish_status(transaction)
    await events.publish_session_changed(transaction.session_id)
    await events.publish_cart_changed(transaction.session_id)
    return await order_status(db, transaction)


@router.post("/{txn_id}/payment", response_model=OrderStatusRead)
async def confirm_payment(
    txn_id: int,
    db: DbSession,
    staff: AnyStaff,
    payload: SettlementWrite | None = None,
) -> OrderStatusRead:
    settlement = payload or SettlementWrite()
    settled = await payment_service.settle_at_counter(db, txn_id, staff.staff_id, settlement)

    await events.publish_status(settled.transaction)
    await events.publish_cart_changed(settled.transaction.session_id)
    if settlement.checks:
        await events.publish_session_changed(settled.transaction.session_id)
    if settled.closed is not None:
        await events.publish_session_ended(settled.closed)

    return await order_status(
        db,
        settled.transaction,
        tender=settled.tender,
        cash_tendered=settled.tendered,
        change_due=settled.change_due,
        transmission=(
            TransmitResult(**vars(settled.transmission)) if settled.transmission else None
        ),
    )


async def order_status(
    db: DbSession,
    transaction: Transaction,
    tender: Tender | None = None,
    cash_tendered: Decimal | None = None,
    change_due: Decimal | None = None,
    transmission: TransmitResult | None = None,
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
        receipt_no=transmission.receipt_no if transmission else None,
        tender=tender,
        cash_tendered=cash_tendered,
        change_due=change_due,
        transmission=transmission,
    )
