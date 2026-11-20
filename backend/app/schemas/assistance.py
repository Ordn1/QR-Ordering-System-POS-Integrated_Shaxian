from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.enums import AssistanceReason


class AssistanceWrite(BaseModel):
    reason: AssistanceReason = AssistanceReason.ASKED


class AssistanceRead(BaseModel):
    request_id: int
    reason: AssistanceReason
    status: Literal["open", "acknowledged"]
    requested_at: datetime
    acknowledged_at: datetime | None = None
    retry_after_seconds: int = 0


class AssistanceQueueRead(BaseModel):
    request_id: int
    session_id: int
    table_number: int
    device_id: int
    device_number: int | None = None
    display_name: str | None = None
    reason: AssistanceReason
    requested_at: datetime
