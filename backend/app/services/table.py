from datetime import UTC, datetime
import io
import socket
import uuid

import qrcode
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import Session, Table
from app.models.enums import OccupancyStatus
from app.schemas.table import TableCatalogRead, TableRead
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


async def list_tables(db: AsyncSession) -> TableCatalogRead:
    tables = (
        await db.scalars(
            select(Table).where(Table.is_active.is_(True)).order_by(Table.table_number.asc())
        )
    ).all()

    results: list[TableRead] = []
    for table in tables:
        active_session = await db.scalar(
            select(Session)
            .where(Session.table_id == table.table_id, Session.ended_at.is_(None))
            .order_by(Session.started_at.desc())
        )
        if active_session:
            cnt = await session_service.device_count(db, active_session.session_id)
            results.append(
                TableRead(
                    table_id=table.table_id,
                    table_number=table.table_number,
                    qr_token=table.qr_token,
                    occupancy_status=table.occupancy_status,
                    device_count=cnt,
                    session_type=active_session.session_type,
                    group_mode=active_session.group_mode,
                )
            )
        else:
            results.append(
                TableRead(
                    table_id=table.table_id,
                    table_number=table.table_number,
                    qr_token=table.qr_token,
                    occupancy_status=table.occupancy_status,
                    device_count=0,
                    session_type=None,
                    group_mode=False,
                )
            )

    return TableCatalogRead(
        tables=results,
        detected_lan_ip=detect_lan_ip(),
        detected_lan_url=detect_lan_url(),
    )


async def reset_table_session(db: AsyncSession, table_id: str) -> TableRead:
    table = await db.get(Table, table_id)
    if not table or not table.is_active:
        raise NotFoundError("Table not found.")

    active_sessions = (
        await db.scalars(
            select(Session).where(Session.table_id == table_id, Session.ended_at.is_(None))
        )
    ).all()
    for s in active_sessions:
        s.ended_at = datetime.now(UTC)

    table.occupancy_status = OccupancyStatus.VACANT
    await db.commit()
    await db.refresh(table)

    return TableRead(
        table_id=table.table_id,
        table_number=table.table_number,
        qr_token=table.qr_token,
        occupancy_status=table.occupancy_status,
        device_count=0,
        session_type=None,
        group_mode=False,
    )


async def regenerate_table_qr(db: AsyncSession, table_id: str) -> TableRead:
    table = await db.get(Table, table_id)
    if not table or not table.is_active:
        raise NotFoundError("Table not found.")

    table.qr_token = uuid.uuid4()
    await db.commit()
    await db.refresh(table)

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
            device_count=cnt,
            session_type=active_session.session_type,
            group_mode=active_session.group_mode,
        )

    return TableRead(
        table_id=table.table_id,
        table_number=table.table_number,
        qr_token=table.qr_token,
        occupancy_status=table.occupancy_status,
        device_count=0,
        session_type=None,
        group_mode=False,
    )


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
