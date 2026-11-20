from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import EventType, Language
from app.schemas.fields import CONTROL_ID, MENU_CODE, SmallNonNegative, sized

Signal = Literal["dwell", "back", "abandon", "revisit", "zoom", "missed_tap"]
Offer = Literal["display", "taps", "crew"]

SERVER_ONLY = {EventType.DISPLAY_CHANGED, EventType.CREW_CALLED}
REQUIRED_DETAIL: dict[EventType, tuple[str, ...]] = {
    EventType.ZOOM_DETECTED: ("zoom_scale",),
    EventType.MISSED_TAP: ("target",),
    EventType.ASSIST_OFFERED: ("offer",),
    EventType.ASSIST_ACCEPTED: ("offer",),
    EventType.ASSIST_DECLINED: ("offer",),
    EventType.CODE_ENTERED: ("code", "matched"),
}


class RecommendationRequest(BaseModel):
    cart: list[str] = Field(default_factory=list, max_length=50)
    language: Language = Language.EN


class Suggestion(BaseModel):
    item_id: str
    name: str
    price: Decimal
    image_filename: str | None
    model_filename: str | None = None
    lift: Decimal
    confidence: Decimal


class RecommendationResponse(BaseModel):
    segment: str
    suggestions: list[Suggestion]


class EventWrite(BaseModel):
    event_type: EventType
    screen_id: str | None = Field(default=None, max_length=40)
    item_id: str | None = Field(default=None, pattern=r"^MNU-[0-9]{4}$")
    dwell_seconds: SmallNonNegative | None = None
    signals: list[Signal] | None = Field(default=None, max_length=8)
    zoom_scale: float | None = Field(default=None, ge=1, le=10)
    target: sized(40, CONTROL_ID) | None = None
    distance_px: int | None = Field(default=None, ge=0, le=500)
    offer: Offer | None = None
    code: sized(4, MENU_CODE) | None = None
    matched: bool | None = None

    @model_validator(mode="after")
    def check_detail(self) -> "EventWrite":
        if self.event_type in SERVER_ONLY:
            raise ValueError("That event is recorded by the server.")
        missing = [
            field
            for field in REQUIRED_DETAIL.get(self.event_type, ())
            if getattr(self, field) is None
        ]
        if missing:
            raise ValueError(f"{self.event_type.value} needs {', '.join(missing)}.")
        return self
