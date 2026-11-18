from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import (
    PaymentMethod,
    PaymentStatus,
    PriorityStatus,
    SessionType,
    TxnStatus,
)
from app.schemas.fields import ALPHA, ALPHANUMERIC, sized


class PendingVerificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: int
    device_id: int
    declared_status: PriorityStatus


class VerificationWrite(BaseModel):
    log_id: int = Field(ge=1)
    outcome: Literal["verified", "rejected"]
    id_last4: str | None = Field(default=None, pattern=r"^[0-9]{4}$")
    cardholder_name: sized(80, ALPHA) | None = None
    issuing_lgu: sized(50, ALPHANUMERIC) | None = None

    @model_validator(mode="after")
    def details_for_verified(self) -> "VerificationWrite":
        if self.outcome == "verified" and not (
            self.id_last4 and self.cardholder_name and self.issuing_lgu
        ):
            raise ValueError(
                "Enter the last 4 ID digits, the cardholder's name and the issuing LGU."
            )
        return self


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
    pending_verifications: list[PendingVerificationRead] = Field(default_factory=list)


class StatusWrite(BaseModel):
    status: TxnStatus


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
    shares_total: int = 0
    shares_paid: int = 0
    unpaid_amount: Decimal = Decimal("0.00")
    my_share_unpaid: bool = False
    my_share_amount: Decimal = Decimal("0.00")
    shares: list[PaymentShareStatusRead] = []
