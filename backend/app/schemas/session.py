from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import Language, PriorityStatus, SessionType, UiMode


class SessionOpen(BaseModel):
    qr_token: UUID
    device_token: UUID | None = None


class DeclarationWrite(BaseModel):
    declared_priority_status: PriorityStatus


class PreferencesWrite(BaseModel):
    language_used: Language | None = None
    ui_mode_used: UiMode | None = None


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: int
    table_id: str
    table_number: int
    device_token: UUID
    is_host: bool
    device_count: int
    declared_priority_status: PriorityStatus
    session_type: SessionType
    group_mode: bool
    ui_mode_used: UiMode
    language_used: Language
    discount_eligible: bool
    trigger_count: int
    last_trigger_at: str | None
