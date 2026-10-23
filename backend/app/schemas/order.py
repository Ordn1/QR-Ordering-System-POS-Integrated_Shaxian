from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    PaymentMethod,
    PaymentStatus,
    PriorityStatus,
    SessionType,
    TxnStatus,
)
from app.schemas.fields import freetext


class TransactionVoidWrite(BaseModel):
    reason: freetext(120)


class TransactionItemDetailRead(BaseModel):
    item_id: str
    name: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    is_discounted: bool
    discount_amount: Decimal


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    placed_at: datetime
    queue_date: date
    queue_number: int
    table_number: int | None = None
    session_type: SessionType
    declared_priority_status: PriorityStatus = PriorityStatus.STANDARD
    status: TxnStatus
    is_priority: bool
    item_count: int
    gross_amount: Decimal
    vatable_sales: Decimal
    vat_exempt_sales: Decimal
    vat_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    voided_by: str | None = None
    void_reason: str | None = None
    voided_at: datetime | None = None


class TransactionDetailRead(TransactionRead):
    payment_method: PaymentMethod = PaymentMethod.CASHIER
    payment_status: PaymentStatus = PaymentStatus.PENDING
    lines: list[TransactionItemDetailRead] = []