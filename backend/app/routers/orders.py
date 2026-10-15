from fastapi import APIRouter, Query

from app.core.customer import CurrentDevice
from app.core.deps import AdminStaff, DbSession
from app.core.exceptions import PermissionError
from app.models.enums import Language, PaymentMethod
from app.schemas.checkout import (
    OrderCreate,
    QuoteCreate,
    QuoteRead,
    ReceiptLine,
    ReceiptRead,
)
from app.schemas.order import TransactionRead
from app.schemas.queue import OrderStatusRead
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
    checkout_url: str | None = None,
    fallback_to_cashier: bool = False,
) -> ReceiptRead:
    transaction, rows, payment = await order_service.get_receipt(db, txn_id)
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
        payment_method=payment.method,
        payment_status=payment.status,
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
            )
            for line, item in rows
        ],
    )


@orders_router.get("/{session_id}/latest", response_model=list[OrderStatusRead])
async def latest_orders(
    session_id: int, db: DbSession, device: CurrentDevice
) -> list[OrderStatusRead]:
    return await order_service.session_order_status(db, session_id)


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
    transaction = await order_service.place_order(
        db,
        session_id,
        device,
        [(line.item_id, line.quantity) for line in payload.items],
        payload.payment_method,
    )

    checkout_url: str | None = None
    fallback_to_cashier = False
    if payload.payment_method is PaymentMethod.ONLINE:
        checkout_url, fallback_to_cashier = await payment_service.initiate_online_payment(
            db, transaction, payload.origin_url,
            device_token=str(device.device_token),
        )

    await events.publish_new_order(transaction)
    return await build_receipt(
        db,
        transaction.txn_id,
        payload.language.value,
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
    return await build_receipt(db, txn_id, language.value)


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
    await payment_service.verify_online_payment(db, txn_id)
    return await build_receipt(db, txn_id, language.value)


@router.get("", response_model=list[TransactionRead])
async def list_transactions(db: DbSession, staff: AdminStaff) -> list[TransactionRead]:
    rows = await order_service.list_transactions(db)
    return [
        TransactionRead.model_validate(
            {**transaction.__dict__, "session_type": session_type}
        )
        for transaction, session_type in rows
    ]