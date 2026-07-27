from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BusinessRuleError, NotFoundError, PermissionError
from app.models import PriorityVerificationLog, Session, SessionDevice, Table
from app.models.enums import (
    Language,
    OccupancyStatus,
    PriorityStatus,
    SessionType,
    UiMode,
)

DISCOUNTABLE = (PriorityStatus.SENIOR, PriorityStatus.PWD)


def resolve_session_type(declared: PriorityStatus, group_mode: bool) -> SessionType:
    """Apply Database.md §6.1's write rule, where group overrides priority."""
    if group_mode:
        return SessionType.GROUP
    if declared is not PriorityStatus.STANDARD:
        return SessionType.PRIORITY
    return SessionType.STANDARD


async def open_session(
    db: AsyncSession, qr_token: UUID, device_token: UUID | None
) -> tuple[Session, SessionDevice, Table]:
    """Open or rejoin a table session from a scanned QR token."""
    table = await db.scalar(select(Table).where(Table.qr_token == qr_token))
    if table is None or not table.is_active:
        raise NotFoundError("That QR code is not recognised. Ask staff for help.")

    active = await db.scalar(
        select(Session)
        .where(Session.table_id == table.table_id, Session.ended_at.is_(None))
        .order_by(Session.started_at.desc())
    )

    if active is not None and _expired(active):
        active.ended_at = datetime.now(UTC)
        table.occupancy_status = OccupancyStatus.VACANT
        await db.flush()
        active = None

    if active is None:
        session = Session(table_id=table.table_id)
        db.add(session)
        await db.flush()

        device = SessionDevice(session_id=session.session_id, is_host=True)
        db.add(device)
        table.occupancy_status = OccupancyStatus.OCCUPIED
        await db.commit()
        await db.refresh(session)
        await db.refresh(device)
        return session, device, table

    if device_token is not None:
        known = await db.scalar(
            select(SessionDevice).where(
                SessionDevice.session_id == active.session_id,
                SessionDevice.device_token == device_token,
            )
        )
        if known is not None:
            return active, known, table

    device = SessionDevice(session_id=active.session_id, is_host=False)
    db.add(device)
    active.group_mode = True
    active.session_type = resolve_session_type(active.declared_priority_status, True)
    await db.commit()
    await db.refresh(active)
    await db.refresh(device)
    return active, device, table


def _expired(session: Session) -> bool:
    age = datetime.now(UTC) - session.started_at
    return age > timedelta(hours=settings.SESSION_MAX_AGE_HOURS)


async def authorize_device(db: AsyncSession, session_id: int, device_token: UUID) -> SessionDevice:
    """Verify this device owns this session, separately from any role check."""
    device = await db.scalar(
        select(SessionDevice).where(
            SessionDevice.session_id == session_id,
            SessionDevice.device_token == device_token,
        )
    )
    if device is None:
        raise PermissionError("This device is not part of that table session.")
    return device


async def get_session(db: AsyncSession, session_id: int) -> Session:
    session = await db.get(Session, session_id)
    if session is None:
        raise NotFoundError("That table session has ended. Scan the QR code again.")
    return session


async def declare_priority(
    db: AsyncSession, session_id: int, declared: PriorityStatus
) -> Session:
    """Record a self-declared priority status. Only an explicit customer tap reaches here."""
    session = await get_session(db, session_id)
    if session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    session.declared_priority_status = declared
    session.session_type = resolve_session_type(declared, session.group_mode)
    session.accessibility_accepted = declared is not PriorityStatus.STANDARD
    session.ui_mode_used = (
        UiMode.ACCESSIBLE if declared is not PriorityStatus.STANDARD else UiMode.STANDARD
    )

    existing = await db.scalar(
        select(PriorityVerificationLog).where(
            PriorityVerificationLog.session_id == session_id
        )
    )

    if declared is PriorityStatus.STANDARD:
        if existing is not None:
            await db.delete(existing)
    else:
        eligible = declared in DISCOUNTABLE
        if existing is None:
            db.add(
                PriorityVerificationLog(
                    session_id=session_id,
                    declared_status=declared,
                    id_presented=False,
                    discount_eligible=eligible,
                )
            )
        else:
            existing.declared_status = declared
            existing.discount_eligible = eligible

    await db.commit()
    await db.refresh(session)
    return session


async def set_preferences(
    db: AsyncSession,
    session_id: int,
    language: Language | None,
    ui_mode: UiMode | None,
) -> Session:
    session = await get_session(db, session_id)
    if language is not None:
        session.language_used = language
    if ui_mode is not None:
        session.ui_mode_used = ui_mode
    await db.commit()
    await db.refresh(session)
    return session


async def discount_eligible(db: AsyncSession, session_id: int) -> bool:
    """A discount needs a verification row flagged eligible, per Algorithms.md §4.5."""
    return bool(
        await db.scalar(
            select(PriorityVerificationLog.log_id).where(
                PriorityVerificationLog.session_id == session_id,
                PriorityVerificationLog.discount_eligible.is_(True),
            )
        )
    )


async def device_count(db: AsyncSession, session_id: int) -> int:
    return await db.scalar(
        select(func.count()).select_from(SessionDevice).where(
            SessionDevice.session_id == session_id
        )
    )
