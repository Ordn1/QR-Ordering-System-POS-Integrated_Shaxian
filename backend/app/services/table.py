from datetime import UTC, datetime
import io
import socket
import uuid

import qrcode
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models import AuditLog, Session, Table
from app.models.enums import OccupancyStatus
from app.schemas.table import TableCatalogRead, TableCreate, TableRead, TableUpdate
from app.services import session as session_service


def detect_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def detect_lan_url(port: int = 5173) -> str:
    ip = detect_lan_ip()
    return f"http://{ip}:{port}"


async def _to_table_read(db: AsyncSession, table: Table) -> TableRead:
    active_session = await db.scalar(
        select(Session)
        .where(Session.table_id == table.table_id, Session.ended_at.is_(None))
        .order_by(Session.started_at.desc())
    )
    if active_session:
        cnt = await session_service.device_count(db, active_session.session_id)
        return TableRead(
            table_id=table.table_id,
            table_number=table.table_number,
            qr_token=table.qr_token,
            occupancy_status=table.occupancy_status,
            is_active=table.is_active,
            created_at=table.created_at,
            device_count=cnt,
            session_type=active_session.session_type,
            group_mode=active_session.group_mode,
        )
    return TableRead(
        table_id=table.table_id,
        table_number=table.table_number,
        qr_token=table.qr_token,
        occupancy_status=table.occupancy_status,
        is_active=table.is_active,
        created_at=table.created_at,
        device_count=0,
        session_type=None,
        group_mode=False,
    )


# Read
async def list_tables(
    db: AsyncSession, *, include_inactive: bool = False
) -> TableCatalogRead:
    statement = select(Table).order_by(Table.table_number.asc())
    if not include_inactive:
        statement = statement.where(Table.is_active.is_(True))
    tables = (await db.scalars(statement)).all()

    results: list[TableRead] = []
    for table in tables:
        results.append(await _to_table_read(db, table))

    return TableCatalogRead(
        tables=results,
        detected_lan_ip=detect_lan_ip(),
        detected_lan_url=detect_lan_url(),
    )


async def get_table(db: AsyncSession, table_id: str) -> Table:
    table = await db.get(Table, table_id)
    if table is None:
        raise NotFoundError("Table not found.")
    return table


# Validate
async def guard_table_number(
    db: AsyncSession, table_number: int, *, exclude: str | None = None
) -> None:
    statement = select(Table.table_id).where(Table.table_number == table_number)
    if exclude:
        statement = statement.where(Table.table_id != exclude)
    if await db.scalar(statement):
        raise ConflictError(f"Table {table_number} already exists.")


# Create
async def create_table(
    db: AsyncSession, payload: TableCreate, staff_id: str | None = None
) -> TableRead:
    """Create a physical dining table with a unique QR token."""
    await guard_table_number(db, payload.table_number)

    table = Table(
        table_number=payload.table_number,
        occupancy_status=payload.occupancy_status,
        is_active=payload.is_active,
    )
    db.add(table)
    await db.flush()

    db.add(
        AuditLog(
            staff_id=staff_id,
            action="table_create",
            entity_type="table",
            entity_id=table.table_id,
            after_state={
                "table_number": table.table_number,
                "occupancy_status": table.occupancy_status.value,
                "is_active": table.is_active,
            },
        )
    )

    # Commit
    await db.commit()
    await db.refresh(table)
    return await _to_table_read(db, table)


# Update
async def update_table(
    db: AsyncSession,
    table_id: str,
    payload: TableUpdate,
    staff_id: str | None = None,
) -> TableRead:
    """Update a table's number, occupancy status, or active service state."""
    table = await get_table(db, table_id)
    await guard_table_number(db, payload.table_number, exclude=table_id)

    before = {
        "table_number": table.table_number,
        "occupancy_status": table.occupancy_status.value,
        "is_active": table.is_active,
    }

    table.table_number = payload.table_number
    table.occupancy_status = payload.occupancy_status
    table.is_active = payload.is_active

    if payload.occupancy_status == OccupancyStatus.VACANT or not payload.is_active:
        active_sessions = (
            await db.scalars(
                select(Session).where(
                    Session.table_id == table_id, Session.ended_at.is_(None)
                )
            )
        ).all()
        now = datetime.now(UTC)
        for s in active_sessions:
            s.ended_at = now
            session_service.clear_table_cart(s.session_id)

    db.add(
        AuditLog(
            staff_id=staff_id,
            action="table_update",
            entity_type="table",
            entity_id=table.table_id,
            before_state=before,
            after_state={
                "table_number": table.table_number,
                "occupancy_status": table.occupancy_status.value,
                "is_active": table.is_active,
            },
        )
    )

    # Commit
    await db.commit()
    await db.refresh(table)
    return await _to_table_read(db, table)


# Delete
async def delete_table(
    db: AsyncSession, table_id: str, staff_id: str | None = None
) -> None:
    """Delete a table if it has no session history; otherwise instruct retiring it."""
    table = await get_table(db, table_id)

    session_count = await db.scalar(
        select(func.count())
        .select_from(Session)
        .where(Session.table_id == table_id)
    )
    if session_count:
        raise BusinessRuleError(
            f"Table {table.table_number} has ordering session history and cannot be deleted. "
            "Mark it retired instead."
        )

    db.add(
        AuditLog(
            staff_id=staff_id,
            action="table_delete",
            entity_type="table",
            entity_id=table.table_id,
            before_state={
                "table_number": table.table_number,
                "occupancy_status": table.occupancy_status.value,
                "is_active": table.is_active,
            },
        )
    )
    await db.delete(table)
    await db.commit()


# Update
async def reset_table_session(
    db: AsyncSession, table_id: str, staff_id: str | None = None
) -> TableRead:
    table = await get_table(db, table_id)

    active_sessions = (
        await db.scalars(
            select(Session).where(Session.table_id == table_id, Session.ended_at.is_(None))
        )
    ).all()
    now = datetime.now(UTC)
    for s in active_sessions:
        s.ended_at = now
        session_service.clear_table_cart(s.session_id)

    old_status = table.occupancy_status.value
    table.occupancy_status = OccupancyStatus.VACANT

    db.add(
        AuditLog(
            staff_id=staff_id,
            action="table_reset",
            entity_type="table",
            entity_id=table.table_id,
            before_state={"occupancy_status": old_status},
            after_state={"occupancy_status": OccupancyStatus.VACANT.value},
        )
    )

    await db.commit()
    await db.refresh(table)
    return await _to_table_read(db, table)


# Update
async def regenerate_table_qr(
    db: AsyncSession, table_id: str, staff_id: str | None = None
) -> TableRead:
    table = await get_table(db, table_id)

    table.qr_token = uuid.uuid4()
    db.add(
        AuditLog(
            staff_id=staff_id,
            action="table_qr_rotate",
            entity_type="table",
            entity_id=table.table_id,
            after_state={"table_number": table.table_number, "qr_rotated": True},
        )
    )
    await db.commit()
    await db.refresh(table)
    return await _to_table_read(db, table)


def generate_qr_png(target_url: str) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(target_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()