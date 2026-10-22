from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Language, PaymentStatus, PriorityStatus, SessionType, UiMode
from app.schemas.fields import SmallPositive


class SessionOpen(BaseModel):
    qr_token: UUID
    device_token: UUID | None = None


class DeclarationWrite(BaseModel):
    declared_priority_status: PriorityStatus


class PreferencesWrite(BaseModel):
    language_used: Language | None = None
    ui_mode_used: UiMode | None = None


class SessionCartLineWrite(BaseModel):
    item_id: str = Field(min_length=8, max_length=8, pattern=r"^MNU-[0-9]{4}$")
    quantity: SmallPositive


class SessionCartWrite(BaseModel):
    items: list[SessionCartLineWrite] = Field(default_factory=list)
    language: Language = Language.EN


class DeviceCartLineRead(BaseModel):
    item_id: str
    name: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class DeviceShareRead(BaseModel):
    device_id: int
    device_number: int
    is_host: bool
    is_me: bool
    subtotal: Decimal
    payment_status: PaymentStatus | None = None
    lines: list[DeviceCartLineRead]


class TableCartRead(BaseModel):
    session_id: int
    device_count: int
    table_total: Decimal
    my_share_total: Decimal
    unpaid_total: Decimal = Decimal("0.00")
    active_txn_id: int | None = None
    shares: list[DeviceShareRead]


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