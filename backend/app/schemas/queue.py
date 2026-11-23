from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    PaymentMethod,
    PaymentStatus,
    PriorityStatus,
    SessionType,
    Tender,
    TxnStatus,
)
from app.schemas.fields import ALPHA, ID_LAST4, sized
from app.schemas.pos import TransmitResult

CardholderName = sized(80, ALPHA)
IssuingLgu = sized(50, ALPHA)


class PendingVerificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: int
    device_id: int
    declared_status: PriorityStatus
    device_number: int | None = None
    display_name: str | None = None
    is_companion: bool = False
    managed_by_number: int | None = None
    managed_by_name: str | None = None
    delta_if_valid: Decimal = Decimal("0.00")
    delta_if_invalid: Decimal = Decimal("0.00")


class VerificationWrite(BaseModel):
    """The cashier looked at the physical OSCA / PWD card and judged it legit or not.

    The card details are optional; the staff member's confirmation is the record.
    """

    log_id: int = Field(ge=1)
    outcome: Literal["verified", "rejected"]
    id_last4: str | None = Field(default=None, pattern=ID_LAST4)
    cardholder_name: CardholderName | None = None
    issuing_lgu: IssuingLgu | None = None


class IdCheckWrite(BaseModel):
    log_id: int = Field(ge=1)
    discount_eligible: bool
    id_last4: str | None = Field(default=None, pattern=ID_LAST4)
    cardholder_name: CardholderName | None = None
    issuing_lgu: IssuingLgu | None = None


class SettlementWrite(BaseModel):
    tender: Tender = Tender.CASH
    cash_tendered: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    checks: list[IdCheckWrite] = Field(default_factory=list)


class QueueItemRead(BaseModel):
    item_id: str
    pos_code: str | None = None
    name: str
    qty: int
    unit_price: Decimal
    subtotal: Decimal
    device_id: int | None = None
    is_discounted: bool = False


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
    pending_verifications: list[PendingVerificationRead] = Field(default_factory=list)
    items: list[QueueItemRead] = []


class StatusWrite(BaseModel):
    status: TxnStatus


class PaymentShareStatusRead(BaseModel):
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
    tender: Tender | None = None
    cash_tendered: Decimal | None = None
    change_due: Decimal | None = None
    transmission: TransmitResult | None = None
    shares_total: int = 0
    shares_paid: int = 0
    unpaid_amount: Decimal = Decimal("0.00")
    my_share_unpaid: bool = False
    my_share_amount: Decimal = Decimal("0.00")
    shares: list[PaymentShareStatusRead] = []
