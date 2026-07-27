from fastapi import APIRouter

from app.core.customer import CurrentDevice
from app.core.deps import AdminStaff, DbSession
from app.schemas.analytics import AnalyticsSummary, VerificationRow
from app.schemas.recommendation import (
    EventWrite,
    RecommendationRequest,
    RecommendationResponse,
    Suggestion,
)
from app.services import analytics as analytics_service
from app.services import recommendation as recommendation_service
from app.services import session as session_service

router = APIRouter(prefix="/api/v1", tags=["recommendations"])


@router.post("/recommendations/{session_id}", response_model=RecommendationResponse)
async def recommend(
    session_id: int,
    payload: RecommendationRequest,
    db: DbSession,
    device: CurrentDevice,
) -> RecommendationResponse:
    ordering_session = await session_service.get_session(db, session_id)
    suggestions = await recommendation_service.recommend(
        db, ordering_session.session_type, payload.cart, payload.language.value
    )
    return RecommendationResponse(
        segment=ordering_session.session_type.value,
        suggestions=[Suggestion(**suggestion) for suggestion in suggestions],
    )


@router.get("/analytics/summary", response_model=AnalyticsSummary)
async def analytics_summary(db: DbSession, staff: AdminStaff) -> AnalyticsSummary:
    return AnalyticsSummary(
        headline=await analytics_service.headline(db),
        sales_by_day=await analytics_service.sales_by_day(db),
        top_items=await analytics_service.top_items(db),
        segment_mix=await analytics_service.segment_mix(db),
        priority_mix=await analytics_service.priority_mix(db),
        recommendation_funnel=await analytics_service.recommendation_funnel(db),
    )


@router.get("/analytics/verifications", response_model=list[VerificationRow])
async def verification_audit(db: DbSession, staff: AdminStaff) -> list[VerificationRow]:
    """The priority-declaration audit trail. Admin only, per Security.md §5.7."""
    return await analytics_service.verification_log(db)


@router.post("/analytics/{session_id}/events", status_code=204)
async def record_event(
    session_id: int, payload: EventWrite, db: DbSession, device: CurrentDevice
) -> None:
    metadata = {
        key: value
        for key, value in (
            ("item_id", payload.item_id),
            ("dwell_seconds", payload.dwell_seconds),
            ("signals", payload.signals),
        )
        if value is not None
    }
    await analytics_service.record(
        db, session_id, payload.event_type, payload.screen_id, metadata or None
    )
