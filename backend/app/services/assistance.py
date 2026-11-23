from datetime import UTC, datetime, timedelta
from math import ceil

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError, RateLimitError
from app.models import (
    AnalyticsEvent,
    AssistanceRequest,
    Session,
    SessionDevice,
    StaffAccount,
    Table,
)
from app.models.enums import AssistanceReason, EventType, SessionEndReason
from app.schemas.assistance import AssistanceQueueRead, AssistanceRead
from app.services import session as session_service

COOLDOWN = timedelta(seconds=60)
SHOWN_FOR = timedelta(minutes=10)


def _seconds_left(request: AssistanceRequest, now: datetime) -> int:
    if request.acknowledged_at is None:
        return 0
    return max(0, ceil((request.acknowledged_at + COOLDOWN - now).total_seconds()))


def to_read(request: AssistanceRequest) -> AssistanceRead:
    return AssistanceRead(
        request_id=request.request_id,
        reason=request.reason,
        status="open" if request.acknowledged_at is None else "acknowledged",
        requested_at=request.requested_at,
        acknowledged_at=request.acknowledged_at,
        retry_after_seconds=_seconds_left(request, datetime.now(UTC)),
    )


async def _latest(db: AsyncSession, device_id: int) -> AssistanceRequest | None:
    return await db.scalar(
        select(AssistanceRequest)
        .where(AssistanceRequest.device_id == device_id)
        .order_by(AssistanceRequest.request_id.desc())
        .limit(1)
    )


async def request_help(
    db: AsyncSession, session_id: int, device: SessionDevice, reason: AssistanceReason
) -> tuple[AssistanceRequest, bool]:
    """Ask for a crew member. One open request per phone, and a short wait after an answer."""
    session = await session_service.get_session(db, session_id)
    if not session_service.diners_present(session, datetime.now(UTC)):
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    await db.execute(
        select(SessionDevice.device_id)
        .where(SessionDevice.device_id == device.device_id)
        .with_for_update()
    )
    latest = await _latest(db, device.device_id)
    if latest is not None and latest.acknowledged_at is None:
        await db.commit()
        return latest, False
    if latest is not None:
        wait = _seconds_left(latest, datetime.now(UTC))
        if wait:
            raise RateLimitError(
                f"A crew member is on the way. You can ask again in {wait} seconds."
            )

    request = AssistanceRequest(session_id=session_id, device_id=device.device_id, reason=reason)
    db.add(request)
    await db.flush()
    db.add(
        AnalyticsEvent(
            session_id=session_id,
            event_type=EventType.CREW_CALLED,
            screen_id=None,
            metadata_={"reason": reason.value, "request_id": request.request_id},
        )
    )
    await db.commit()
    await db.refresh(request)
    return request, True


async def current_request(
    db: AsyncSession, session_id: int, device: SessionDevice
) -> AssistanceRequest | None:
    latest = await _latest(db, device.device_id)
    if latest is None or latest.session_id != session_id:
        return None
    if latest.acknowledged_at is None:
        return latest
    if datetime.now(UTC) - latest.acknowledged_at <= SHOWN_FOR:
        return latest
    return None


async def open_requests(db: AsyncSession) -> list[AssistanceQueueRead]:
    """Tables still waiting for a crew member, oldest first, including diners who already paid."""
    now = datetime.now(UTC)
    oldest = now - timedelta(hours=settings.SESSION_MAX_AGE_HOURS)
    settled_since = now - timedelta(minutes=settings.SESSION_SETTLED_MINUTES)
    rows = (
        await db.execute(
            select(AssistanceRequest, Table.table_number)
            .join(Session, Session.session_id == AssistanceRequest.session_id)
            .join(Table, Table.table_id == Session.table_id)
            .where(
                AssistanceRequest.acknowledged_at.is_(None),
                or_(
                    Session.ended_at.is_(None),
                    and_(
                        Session.end_reason == SessionEndReason.COMPLETED,
                        Session.ended_at >= settled_since,
                    ),
                ),
                Session.started_at >= oldest,
            )
            .order_by(AssistanceRequest.requested_at)
        )
    ).all()
    labels = await session_service.device_labels(db, {request.session_id for request, _ in rows})
    return [
        AssistanceQueueRead(
            request_id=request.request_id,
            session_id=request.session_id,
            table_number=table_number,
            device_id=request.device_id,
            device_number=labels[request.device_id].device_number,
            display_name=labels[request.device_id].display_name,
            reason=request.reason,
            requested_at=request.requested_at,
        )
        for request, table_number in rows
    ]


async def acknowledge(db: AsyncSession, request_id: int, staff_id: str) -> AssistanceRequest:
    """One crew member walks to the table, so every open call from that table is answered."""
    request = await db.scalar(
        select(AssistanceRequest)
        .where(AssistanceRequest.request_id == request_id)
        .with_for_update()
    )
    if request is None:
        raise NotFoundError("That call for help is no longer listed.")
    if request.acknowledged_at is not None:
        staff = await db.get(StaffAccount, request.acknowledged_by)
        table_number = await db.scalar(
            select(Table.table_number)
            .join(Session, Session.table_id == Table.table_id)
            .where(Session.session_id == request.session_id)
        )
        raise ConflictError(f"{staff.full_name} is already on the way to Table {table_number}.")

    await db.execute(
        update(AssistanceRequest)
        .where(
            AssistanceRequest.session_id == request.session_id,
            AssistanceRequest.acknowledged_at.is_(None),
        )
        .values(acknowledged_at=datetime.now(UTC), acknowledged_by=staff_id)
    )
    await db.commit()
    await db.refresh(request)
    return request
