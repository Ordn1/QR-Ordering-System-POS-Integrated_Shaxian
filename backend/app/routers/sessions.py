from fastapi import APIRouter

from app.core.customer import CurrentDevice
from app.core.deps import DbSession
from app.models import Session, SessionDevice, Table
from app.schemas.session import (
    DeclarationWrite,
    PreferencesWrite,
    SessionOpen,
    SessionRead,
)
from app.services import analytics as analytics_service
from app.services import session as session_service

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


async def to_read(
    db: DbSession, session: Session, device: SessionDevice, table: Table
) -> SessionRead:
    triggers = await analytics_service.trigger_history(db, session.session_id)
    return SessionRead(
        session_id=session.session_id,
        table_id=session.table_id,
        table_number=table.table_number,
        device_token=device.device_token,
        is_host=device.is_host,
        device_count=await session_service.device_count(db, session.session_id),
        declared_priority_status=session.declared_priority_status,
        session_type=session.session_type,
        group_mode=session.group_mode,
        ui_mode_used=session.ui_mode_used,
        language_used=session.language_used,
        discount_eligible=await session_service.discount_eligible(db, session.session_id),
        trigger_count=triggers[0],
        last_trigger_at=triggers[1],
    )


@router.post("", response_model=SessionRead, status_code=201)
async def open_session(payload: SessionOpen, db: DbSession) -> SessionRead:
    session, device, table = await session_service.open_session(
        db, payload.qr_token, payload.device_token
    )
    return await to_read(db, session, device, table)


@router.get("/{session_id}", response_model=SessionRead)
async def read_session(session_id: int, db: DbSession, device: CurrentDevice) -> SessionRead:
    session = await session_service.get_session(db, session_id)
    table = await db.get(Table, session.table_id)
    return await to_read(db, session, device, table)


@router.patch("/{session_id}/declaration", response_model=SessionRead)
async def declare(
    session_id: int, payload: DeclarationWrite, db: DbSession, device: CurrentDevice
) -> SessionRead:
    session = await session_service.declare_priority(
        db, session_id, payload.declared_priority_status
    )
    table = await db.get(Table, session.table_id)
    return await to_read(db, session, device, table)


@router.patch("/{session_id}/preferences", response_model=SessionRead)
async def preferences(
    session_id: int, payload: PreferencesWrite, db: DbSession, device: CurrentDevice
) -> SessionRead:
    session = await session_service.set_preferences(
        db, session_id, payload.language_used, payload.ui_mode_used
    )
    table = await db.get(Table, session.table_id)
    return await to_read(db, session, device, table)
