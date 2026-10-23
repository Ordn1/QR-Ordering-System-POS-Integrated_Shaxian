from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    PaymentMethod,
    PaymentStatus,
    PriorityStatus,
    SessionType,
    TxnStatus,
)
from app.schemas.fields import ALPHA, sized


class QueueItemRead(BaseModel):
    item_id: str
    name: str
    qty: int
    unit_price: Decimal
    subtotal: Decimal


class QueueEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    queue_position: int
    queue_number: int
    priority_skips_used: int
    is_priority: bool
    declared_priority_status: PriorityStatus
    id_verified: bool = False
    id_last4: str | None = None
    cardholder_name: str | None = None
    issuing_lgu: str | None = None
    session_type: SessionType
    table_number: int
    status: TxnStatus
    item_count: int
    gross_amount: Decimal
    vatable_sales: Decimal = Decimal("0.00")
    vat_exempt_sales: Decimal = Decimal("0.00")
    vat_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    unpaid_amount: Decimal = Decimal("0.00")
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    entered_queue_at: datetime
    prep_started_at: datetime | None
    items: list[QueueItemRead] = []


class StatusWrite(BaseModel):
    status: TxnStatus


class CashPaymentWrite(BaseModel):
    cash_tendered: Decimal | None = None


class PriorityVerifyWrite(BaseModel):
    id_last4: sized(4, r"^[0-9]{4}$")
    cardholder_name: sized(80, ALPHA)
    issuing_lgu: sized(50, ALPHA)


class PaymentShareStatusRead(BaseModel):
    payment_id: int
    device_id: int | None
    device_number: int
    is_host: bool
    is_me: bool
    amount: Decimal
    method: PaymentMethod
    status: PaymentStatus


class OrderStatusRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    queue_number: int
    status: TxnStatus
    is_priority: bool
    queue_position: int | None
    net_amount: Decimal
    payment_status: PaymentStatus
    receipt_no: str | None = None
    cash_tendered: Decimal | None = None
    change_due: Decimal | None = None
    shares_total: int = 0
    shares_paid: int = 0
    unpaid_amount: Decimal = Decimal("0.00")
    my_share_unpaid: bool = False
    my_share_amount: Decimal = Decimal("0.00")
    shares: list[PaymentShareStatusRead] = []