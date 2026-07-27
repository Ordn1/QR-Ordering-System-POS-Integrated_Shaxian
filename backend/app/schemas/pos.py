from typing import Any

from pydantic import BaseModel


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
