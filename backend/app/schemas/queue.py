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


class QueueEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    queue_position: int
    queue_number: int
    priority_skips_used: int
    is_priority: bool
    declared_priority_status: PriorityStatus
    session_type: SessionType
    table_number: int
    status: TxnStatus
    item_count: int
    gross_amount: Decimal
    vat_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    entered_queue_at: datetime
    prep_started_at: datetime | None


class StatusWrite(BaseModel):
    status: TxnStatus


class OrderStatusRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    queue_number: int
    status: TxnStatus
    is_priority: bool
    queue_position: int | None
    net_amount: Decimal
    payment_status: PaymentStatus
