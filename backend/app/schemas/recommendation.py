from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import EventType, Language
from app.schemas.fields import SmallNonNegative


class RecommendationRequest(BaseModel):
    cart: list[str] = Field(default_factory=list, max_length=50)
    language: Language = Language.EN


class Suggestion(BaseModel):
    item_id: str
    name: str
    price: Decimal
    image_filename: str | None
    lift: Decimal
    confidence: Decimal


class RecommendationResponse(BaseModel):
    segment: str
    suggestions: list[Suggestion]


class EventWrite(BaseModel):
    event_type: EventType
    screen_id: str | None = Field(default=None, max_length=40)
    item_id: str | None = Field(default=None, max_length=8)
    dwell_seconds: SmallNonNegative | None = None
    signals: list[str] | None = Field(default=None, max_length=8)
