from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Language, PaymentMethod, PaymentStatus, TxnStatus
from app.schemas.fields import SmallPositive


class OrderLineWrite(BaseModel):
    item_id: str = Field(min_length=8, max_length=8, pattern=r"^MNU-[0-9]{4}$")
    quantity: SmallPositive


class OrderCreate(BaseModel):
    items: list[OrderLineWrite] = Field(default_factory=list)
    payment_method: PaymentMethod
    language: Language = Language.EN
    origin_url: str | None = Field(default=None, max_length=120)
    checkout_scope: str = Field(default="single", pattern=r"^(single|table|split)$")


class QuoteCreate(BaseModel):
    """A cart priced for preview. No payment method — nothing is recorded."""

    items: list[OrderLineWrite] = Field(default_factory=list)
    checkout_scope: str = Field(default="single", pattern=r"^(single|table|split)$")


class QuoteRead(BaseModel):
    gross_amount: Decimal
    vatable_sales: Decimal
    vat_exempt_sales: Decimal
    vat_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    item_count: int
    discount_applied: bool


class ReceiptLine(BaseModel):
    item_id: str
    name: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    device_id: int | None = None


class PaymentShareRead(BaseModel):
    payment_id: int
    device_id: int | None
    device_number: int
    is_host: bool
    is_me: bool
    amount: Decimal
    method: PaymentMethod
    status: PaymentStatus


class ReceiptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    queue_date: date
    queue_number: int
    placed_at: datetime
    status: TxnStatus
    is_priority: bool
    item_count: int
    gross_amount: Decimal
    vatable_sales: Decimal
    vat_exempt_sales: Decimal
    vat_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    checkout_url: str | None = None
    fallback_to_cashier: bool = False
    lines: list[ReceiptLine]
    shares: list[PaymentShareRead] = Field(default_factory=list)