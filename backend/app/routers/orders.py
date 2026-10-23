from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.customer import CurrentDevice
from app.core.deps import AdminStaff, AnyStaff, DbSession
from app.core.exceptions import PermissionError
from app.models import Session, SessionDevice, Table
from app.models.enums import Language, PaymentMethod, PaymentStatus
from app.schemas.checkout import (
    OrderCreate,
    PaymentShareRead,
    QuoteCreate,
    QuoteRead,
    ReceiptLine,
    ReceiptRead,
)
from app.schemas.order import (
    TransactionDetailRead,
    TransactionItemDetailRead,
    TransactionRead,
    TransactionVoidWrite,
)
from app.schemas.queue import OrderStatusRead, PaymentShareStatusRead
from app.services import order as order_service
from app.services import payment as payment_service
from app.websocket import events

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])
orders_router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


def name_for(item, language: str) -> str:
    return {
        "en": item.name_en,
        "fil": item.name_fil,
        "bis": item.name_bis,
    }.get(language, item.name_en)


async def build_receipt(
    db: DbSession,
    txn_id: int,
    language: str,
    current_device_id: int | None = None,
    checkout_url: str | None = None,
    fallback_to_cashier: bool = False,
) -> ReceiptRead:
    transaction, rows, payments = await order_service.get_receipt(db, txn_id)
    devices = list(
        await db.scalars(
            select(SessionDevice)
            .where(SessionDevice.session_id == transaction.session_id)
            .order_by(SessionDevice.joined_at.asc(), SessionDevice.device_id.asc())
        )
    )
    dev_meta = {
        dev.device_id: (idx, dev.is_host)
        for idx, dev in enumerate(devices, start=1)
    }

    my_payment = next(
        (p for p in payments if p.device_id == current_device_id),
        payments[0] if payments else None,
    )
    overall_status = order_service.aggregate_payment_status(payments)

    shares = [
        PaymentShareRead(
            payment_id=p.payment_id,
            device_id=p.device_id,
            device_number=dev_meta.get(p.device_id, (1, False))[0],
            is_host=dev_meta.get(p.device_id, (1, False))[1],
            is_me=p.device_id == current_device_id,
            amount=p.amount,
            method=p.method,
            status=p.status,
        )
        for p in payments
    ]

    return ReceiptRead(
        **{
            column: getattr(transaction, column)
            for column in (
                "txn_id",
                "queue_date",
                "queue_number",
                "placed_at",
                "status",
                "is_priority",
                "item_count",
                "gross_amount",
                "vatable_sales",
                "vat_exempt_sales",
                "vat_amount",
                "discount_amount",
                "net_amount",
            )
        },
        payment_method=my_payment.method if my_payment else PaymentMethod.CASHIER,
        payment_status=overall_status,
        checkout_url=checkout_url,
        fallback_to_cashier=fallback_to_cashier,
        lines=[
            ReceiptLine(
                item_id=line.item_id,
                name=name_for(item, language),
                quantity=line.quantity,
                unit_price=line.unit_price,
                subtotal=line.subtotal,
                discount_amount=line.discount_amount,
                device_id=line.device_id,
            )
            for line, item in rows
        ],
        shares=shares,
    )


@orders_router.get("/{session_id}/latest", response_model=list[OrderStatusRead])
async def latest_orders(
    session_id: int, db: DbSession, device: CurrentDevice
) -> list[OrderStatusRead]:
    raw = await order_service.session_order_status(db, session_id, current_device_id=device.device_id)
    return [
        OrderStatusRead(
            txn_id=o["txn_id"],
            queue_number=o["queue_number"],
            status=o["status"],
            is_priority=o["is_priority"],
            queue_position=o["queue_position"],
            net_amount=o["net_amount"],
            payment_status=o["payment_status"],
            shares_total=o.get("shares_total", 0),
            shares_paid=o.get("shares_paid", 0),
            unpaid_amount=o.get("unpaid_amount", 0),
            my_share_unpaid=o.get("my_share_unpaid", False),
            my_share_amount=o.get("my_share_amount", 0),
            shares=[
                PaymentShareStatusRead(**s)
                for s in o.get("shares", [])
            ],
        )
        for o in raw
    ]


@orders_router.post("/{session_id}/quote", response_model=QuoteRead)
async def quote_order(
    session_id: int, payload: QuoteCreate, db: DbSession, device: CurrentDevice
) -> QuoteRead:
    """Price the cart so checkout can show VAT and any statutory discount up front."""
    priced = await order_service.quote_order(
        db,
        session_id,
        device,
        [(line.item_id, line.quantity) for line in payload.items],
        payload.checkout_scope,
    )
    return QuoteRead(
        gross_amount=priced.gross_amount,
        vatable_sales=priced.vatable_sales,
        vat_exempt_sales=priced.vat_exempt_sales,
        vat_amount=priced.vat_amount,
        discount_amount=priced.discount_amount,
        net_amount=priced.net_amount,
        item_count=priced.item_count,
        discount_applied=priced.discount_amount > 0,
    )


@orders_router.post("/{session_id}", response_model=ReceiptRead, status_code=201)
async def place_order(
    session_id: int, payload: OrderCreate, db: DbSession, device: CurrentDevice
) -> ReceiptRead:
    transaction, active_payment = await order_service.place_order(
        db,
        session_id,
        device,
        [(line.item_id, line.quantity) for line in payload.items],
        payload.payment_method,
        payload.checkout_scope,
    )

    checkout_url: str | None = None
    fallback_to_cashier = False
    if payload.payment_method is PaymentMethod.ONLINE and active_payment is not None:
        checkout_url, fallback_to_cashier = await payment_service.initiate_online_payment(
            db, transaction, active_payment, payload.origin_url
        )

    await events.publish_new_order(transaction)
    await events.publish_cart_changed(session_id)
    return await build_receipt(
        db,
        transaction.txn_id,
        payload.language.value,
        current_device_id=device.device_id,
        checkout_url=checkout_url,
        fallback_to_cashier=fallback_to_cashier,
    )


@orders_router.get("/{session_id}/receipt/{txn_id}", response_model=ReceiptRead)
async def get_order_receipt(
    session_id: int,
    txn_id: int,
    db: DbSession,
    device: CurrentDevice,
    language: Language = Query(default=Language.EN),
) -> ReceiptRead:
    transaction, _, _ = await order_service.get_receipt(db, txn_id)
    if transaction.session_id != session_id:
        raise PermissionError("That order belongs to another table session.")
    return await build_receipt(
        db, txn_id, language.value, current_device_id=device.device_id
    )


@orders_router.post("/{session_id}/verify/{txn_id}", response_model=ReceiptRead)
async def verify_order_payment(
    session_id: int,
    txn_id: int,
    db: DbSession,
    device: CurrentDevice,
    language: Language = Query(default=Language.EN),
) -> ReceiptRead:
    transaction, _, _ = await order_service.get_receipt(db, txn_id)
    if transaction.session_id != session_id:
        raise PermissionError("That order belongs to another table session.")
    await payment_service.verify_online_payment(db, txn_id, device_id=device.device_id)
    return await build_receipt(
        db, txn_id, language.value, current_device_id=device.device_id
    )


@router.get("", response_model=list[TransactionRead])
async def list_transactions(db: DbSession, staff: AdminStaff) -> list[TransactionRead]:
    rows = await order_service.list_transactions(db)
    return [
        TransactionRead.model_validate(
            {
                **transaction.__dict__,
                "table_number": table_number,
                "session_type": ordering_session.session_type,
                "declared_priority_status": ordering_session.declared_priority_status,
            }
        )
        for transaction, ordering_session, table_number in rows
    ]


@router.get("/{txn_id}", response_model=TransactionDetailRead)
async def get_transaction_detail(
    txn_id: int, db: DbSession, staff: AnyStaff
) -> TransactionDetailRead:
    transaction, rows, payments = await order_service.get_receipt(db, txn_id)
    ordering_session = await db.get(Session, transaction.session_id)
    table = await db.get(Table, ordering_session.table_id) if ordering_session else None
    overall_status = order_service.aggregate_payment_status(payments)
    method = (
        PaymentMethod.ONLINE
        if any(p.method is PaymentMethod.ONLINE for p in payments)
        else PaymentMethod.CASHIER
    )
    return TransactionDetailRead(
        txn_id=transaction.txn_id,
        placed_at=transaction.placed_at,
        queue_date=transaction.queue_date,
        queue_number=transaction.queue_number,
        table_number=table.table_number if table else None,
        session_type=ordering_session.session_type,
        declared_priority_status=ordering_session.declared_priority_status,
        status=transaction.status,
        is_priority=transaction.is_priority,
        item_count=transaction.item_count,
        gross_amount=transaction.gross_amount,
        vatable_sales=transaction.vatable_sales,
        vat_exempt_sales=transaction.vat_exempt_sales,
        vat_amount=transaction.vat_amount,
        discount_amount=transaction.discount_amount,
        net_amount=transaction.net_amount,
        voided_by=transaction.voided_by,
        void_reason=transaction.void_reason,
        voided_at=transaction.voided_at,
        payment_method=method,
        payment_status=overall_status if payments else PaymentStatus.PENDING,
        lines=[
            TransactionItemDetailRead(
                item_id=line.item_id,
                name=item.name_en,
                quantity=line.quantity,
                unit_price=line.unit_price,
                subtotal=line.subtotal,
                is_discounted=line.is_discounted,
                discount_amount=line.discount_amount,
            )
            for line, item in rows
        ],
    )


@router.post("/{txn_id}/void", response_model=TransactionRead)
async def void_transaction(
    txn_id: int, payload: TransactionVoidWrite, db: DbSession, staff: AnyStaff
) -> TransactionRead:
    transaction = await order_service.void_transaction(
        db, txn_id, payload.reason, staff.staff_id
    )
    ordering_session = await db.get(Session, transaction.session_id)
    table = await db.get(Table, ordering_session.table_id) if ordering_session else None
    await events.publish_status(transaction)
    return TransactionRead.model_validate(
        {
            **transaction.__dict__,
            "table_number": table.table_number if table else None,
            "session_type": ordering_session.session_type,
            "declared_priority_status": ordering_session.declared_priority_status,
        }
    )