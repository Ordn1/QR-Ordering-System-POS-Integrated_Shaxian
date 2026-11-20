from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import (
    Language,
    MenuSize,
    PaymentStatus,
    PriorityStatus,
    SessionType,
    UiMode,
)
from app.schemas.fields import ALPHANUMERIC, SmallPositive, sized

DisplayName = sized(30, ALPHANUMERIC)

DiscountStatus = Literal["none", "pending", "verified", "rejected"]
DisplaySource = Literal["pinch", "button", "offer"]


class SessionOpen(BaseModel):
    qr_token: UUID
    device_token: UUID | None = None


class DeclarationWrite(BaseModel):
    declared_priority_status: PriorityStatus


class PreferencesWrite(BaseModel):
    language_used: Language | None = None
    menu_size: MenuSize | None = None
    is_high_contrast: bool | None = None
    has_steady_taps: bool | None = None
    source: DisplaySource = "button"
    screen_id: str | None = Field(default=None, max_length=40)


class DeviceProfileWrite(BaseModel):
    display_name: DisplayName | None = None


class SessionCartLineWrite(BaseModel):
    item_id: str = Field(min_length=8, max_length=8, pattern=r"^MNU-[0-9]{4}$")
    quantity: SmallPositive
    for_device_id: int | None = Field(default=None, ge=1)


class CompanionWrite(BaseModel):
    display_name: DisplayName
    declared_status: PriorityStatus

    @field_validator("declared_status")
    @classmethod
    def discountable(cls, value: PriorityStatus) -> PriorityStatus:
        if value not in (PriorityStatus.SENIOR, PriorityStatus.PWD):
            raise ValueError("Only a senior citizen or a person with disability can be added.")
        return value


class CompanionRead(BaseModel):
    device_id: int
    display_name: str | None
    declared_status: PriorityStatus
    discount_status: "DiscountStatus"
    has_ordered: bool


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
    device_number: int | None
    display_name: str | None = None
    is_host: bool
    is_me: bool
    is_companion: bool = False
    managed_by_device_id: int | None = None
    managed_by_number: int | None = None
    managed_by_me: bool = False
    declared_status: PriorityStatus | None = None
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
    device_id: int
    device_token: UUID
    display_name: str | None = None
    is_host: bool
    device_count: int
    declared_priority_status: PriorityStatus
    session_type: SessionType
    group_mode: bool
    ui_mode_used: UiMode
    menu_size: MenuSize = MenuSize.GRID
    is_high_contrast: bool = False
    has_steady_taps: bool = False
    display_chosen: bool = False
    companions: list[CompanionRead] = Field(default_factory=list)
    language_used: Language
    discount_eligible: bool
    discount_status: DiscountStatus = "none"
    trigger_count: int
    last_trigger_at: str | None