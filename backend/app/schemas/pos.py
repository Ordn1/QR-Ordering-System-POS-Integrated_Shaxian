from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import PriorityStatus
from app.schemas.fields import SmallPositive


class PosOrderLineWrite(BaseModel):
    item_id: str = Field(min_length=8, max_length=8, pattern=r"^MNU-[0-9]{4}$")
    quantity: SmallPositive


class PosOrderCreate(BaseModel):
    table_id: str = Field(min_length=8, max_length=8, pattern=r"^TBL-[0-9]{4}$")
    declared_priority_status: PriorityStatus = PriorityStatus.STANDARD
    id_last4: str | None = None
    cardholder_name: str | None = None
    issuing_lgu: str | None = None
    cash_tendered: Decimal
    items: list[PosOrderLineWrite] = Field(min_length=1)


class RegisterAck(BaseModel):
    receipt_no: str
    duplicate: bool


class TransmitResult(BaseModel):
    txn_id: int
    queue_number: int
    status: str
    attempts: int
    latency_ms: int
    receipt_no: str | None
    detail: str | None
    payload: dict[str, Any]
    occurred_at: str


class TransmissionRead(BaseModel):
    audit_id: int
    txn_id: int | None
    queue_number: int | None
    table_number: int | None
    status: str
    attempts: int
    latency_ms: int
    receipt_no: str | None
    detail: str | None
    payload_bytes: int
    payload: dict[str, Any]
    occurred_at: str


class BridgeStatus(BaseModel):
    endpoint: str
    store_code: str
    terminal_code: str
    simulated: bool
    total: int
    acknowledged: int
    last_ack_at: str | None
    average_latency_ms: int