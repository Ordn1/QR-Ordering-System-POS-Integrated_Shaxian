from fastapi import APIRouter, Query

from app.core.customer import CurrentDevice
from app.core.deps import DbSession
from app.models import Session, SessionDevice, Table
from app.models.enums import Language, PriorityStatus, UiMode
from app.schemas.session import (
    DeclarationWrite,
    DeviceProfileWrite,
    PreferencesWrite,
    SessionCartWrite,
    SessionOpen,
    SessionRead,
    TableCartRead,
)
from app.services import analytics as analytics_service
from app.services import session as session_service
from app.websocket import events

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


async def to_read(
    db: DbSession, session: Session, device: SessionDevice, table: Table
) -> SessionRead:
    triggers = await analytics_service.trigger_history(db, session.session_id)
    mine = await session_service.device_declaration(db, session.session_id, device.device_id)
    my_status = mine.declared_status if mine is not None else PriorityStatus.STANDARD
    standard_display = session_service.display_is_default(device)
    return SessionRead(
        session_id=session.session_id,
        table_id=session.table_id,
        table_number=table.table_number,
        device_id=device.device_id,
        device_token=device.device_token,
        display_name=device.display_name,
        is_host=device.is_host,
        device_count=await session_service.device_count(db, session.session_id),
        declared_priority_status=my_status,
        session_type=session.session_type,
        group_mode=session.group_mode,
        ui_mode_used=UiMode.STANDARD if standard_display else UiMode.ACCESSIBLE,
        menu_size=device.menu_size,
        is_high_contrast=device.is_high_contrast,
        has_steady_taps=device.has_steady_taps,
        display_chosen=device.display_chosen_at is not None,
        language_used=session.language_used,
        discount_eligible=bool(mine is not None and mine.discount_eligible),
        discount_status=session_service.discount_status([mine] if mine is not None else []),
        trigger_count=triggers[0],
        last_trigger_at=triggers[1],
    )


@router.post("", response_model=SessionRead, status_code=201)
async def open_session(payload: SessionOpen, db: DbSession) -> SessionRead:
    session, device, table = await session_service.open_session(
        db, payload.qr_token, payload.device_token
    )
    read_model = await to_read(db, session, device, table)
    if session.group_mode:
        await events.publish_session_changed(session.session_id)
    return read_model


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
        db, session_id, device, payload.declared_priority_status
    )
    table = await db.get(Table, session.table_id)
    read_model = await to_read(db, session, device, table)
    await events.publish_session_changed(session.session_id)
    return read_model


@router.patch("/{session_id}/preferences", response_model=SessionRead)
async def preferences(
    session_id: int, payload: PreferencesWrite, db: DbSession, device: CurrentDevice
) -> SessionRead:
    changes = payload.model_dump(
        include={"menu_size", "is_high_contrast", "has_steady_taps"}, exclude_none=True
    )
    session = await session_service.set_preferences(
        db,
        session_id,
        device,
        payload.language_used,
        changes,
        payload.source,
        payload.screen_id,
    )
    table = await db.get(Table, session.table_id)
    return await to_read(db, session, device, table)


@router.patch("/{session_id}/device", response_model=SessionRead)
async def update_device_profile(
    session_id: int, payload: DeviceProfileWrite, db: DbSession, device: CurrentDevice
) -> SessionRead:
    updated_device = await session_service.update_device_profile(
        db, session_id, device, payload.display_name
    )
    session = await session_service.get_session(db, session_id)
    table = await db.get(Table, session.table_id)
    read_model = await to_read(db, session, updated_device, table)
    await events.publish_session_changed(session_id)
    await events.publish_cart_changed(session_id)
    return read_model


@router.delete("/{session_id}/devices/{target_device_id}", response_model=SessionRead)
async def remove_device(
    session_id: int,
    target_device_id: int,
    db: DbSession,
    device: CurrentDevice,
) -> SessionRead:
    session = await session_service.remove_session_device(
        db, session_id, device, target_device_id
    )
    table = await db.get(Table, session.table_id)
    read_model = await to_read(db, session, device, table)
    await events.publish_session_changed(session_id)
    await events.publish_cart_changed(session_id)
    return read_model


@router.get("/{session_id}/cart", response_model=TableCartRead)
async def read_table_cart(
    session_id: int,
    db: DbSession,
    device: CurrentDevice,
    language: Language = Query(default=Language.EN),
) -> TableCartRead:
    return await session_service.get_table_cart(
        db, session_id, device.device_id, language.value
    )


@router.patch("/{session_id}/cart", response_model=TableCartRead)
async def sync_device_cart(
    session_id: int,
    payload: SessionCartWrite,
    db: DbSession,
    device: CurrentDevice,
) -> TableCartRead:
    await session_service.write_payer_carts(
        db,
        session_id,
        device,
        [(line.item_id, line.quantity, None) for line in payload.items],
    )
    await events.publish_cart_changed(session_id)
    return await session_service.get_table_cart(
        db, session_id, device.device_id, payload.language.value
    )