from datetime import date, datetime
from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Language, PaymentMethod, PaymentStatus, TxnStatus
from app.schemas.fields import SmallPositive
from app.schemas.session import DiscountStatus


class OrderLineWrite(BaseModel):
    item_id: str = Field(min_length=8, max_length=8, pattern=r"^MNU-[0-9]{4}$")
    quantity: SmallPositive
    for_device_id: int | None = Field(default=None, ge=1)


class OrderCreate(BaseModel):
    items: list[OrderLineWrite] = Field(default_factory=list)
    payment_method: PaymentMethod
    language: Language = Language.EN
    origin_url: str | None = Field(default=None, max_length=120)
    checkout_scope: str = Field(default="single", pattern=r"^(single|table|split)$")
    # How an online payment is collected: PayMongo's hosted page (GCash, Maya, card),
    # or a QR Ph code shown on our own receipt page so the diner never leaves the system.
    online_channel: Literal["checkout", "qrph"] = "checkout"


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
    discount_status: DiscountStatus = "none"
    online_allowed: bool = True
    my_net_amount: Decimal = Decimal("0.00")
    shares: list["QuoteShareRead"] = Field(default_factory=list)


class QuoteShareRead(BaseModel):
    device_id: int
    device_number: int | None
    display_name: str | None = None
    is_me: bool
    is_companion: bool
    managed_by_me: bool
    net_amount: Decimal
    discount_amount: Decimal
    pays_at_cashier: bool


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
    device_number: int | None
    is_host: bool
    is_me: bool
    display_name: str | None = None
    is_companion: bool = False
    managed_by_me: bool = False
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
    # This phone's share is waiting on a QR Ph scan shown on the receipt page.
    qrph_pending: bool = False
    discount_status: DiscountStatus = "none"
    lines: list[ReceiptLine]
    shares: list[PaymentShareRead] = Field(default_factory=list)


class QrPhCodeRead(BaseModel):
    """The QR Ph code a diner scans with any bank or e-wallet app."""

    payment_id: int
    status: PaymentStatus
    amount: Decimal
    image_url: str | None = None
    expires_at: datetime | None = None
    # Sandbox only: PayMongo's page for simulating a successful scan.
    test_url: str | None = None
