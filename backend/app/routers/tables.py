from fastapi import APIRouter, Response

from app.core.deps import AdminStaff, AnyStaff, DbSession
from app.core.exceptions import NotFoundError
from app.models import Table
from app.schemas.table import TableCatalogRead, TableCreate, TableRead, TableUpdate
from app.services import table as table_service

router = APIRouter(prefix="/api/v1/tables", tags=["tables"])


@router.get("", response_model=TableCatalogRead)
async def list_tables(
    db: DbSession, staff: AnyStaff, include_inactive: bool = False
) -> TableCatalogRead:
    return await table_service.list_tables(db, include_inactive=include_inactive)


@router.post("", response_model=TableRead, status_code=201)
async def create_table(
    payload: TableCreate, db: DbSession, staff: AdminStaff
) -> TableRead:
    return await table_service.create_table(db, payload, staff_id=staff.staff_id)


@router.patch("/{table_id}", response_model=TableRead)
async def update_table(
    table_id: str, payload: TableUpdate, db: DbSession, staff: AdminStaff
) -> TableRead:
    return await table_service.update_table(
        db, table_id, payload, staff_id=staff.staff_id
    )


@router.delete("/{table_id}", status_code=204)
async def delete_table(
    table_id: str, db: DbSession, staff: AdminStaff
) -> None:
    await table_service.delete_table(db, table_id, staff_id=staff.staff_id)


@router.post("/{table_id}/reset", response_model=TableRead)
async def reset_table(table_id: str, db: DbSession, staff: AnyStaff) -> TableRead:
    return await table_service.reset_table_session(
        db, table_id, staff_id=staff.staff_id
    )


@router.post("/{table_id}/regenerate", response_model=TableRead)
async def regenerate_table_qr(
    table_id: str, db: DbSession, staff: AdminStaff
) -> TableRead:
    return await table_service.regenerate_table_qr(
        db, table_id, staff_id=staff.staff_id
    )


@router.get("/{table_id}/qr")
async def get_table_qr(table_id: str, db: DbSession, base_url: str | None = None) -> Response:
    table = await db.get(Table, table_id)
    if not table:
        raise NotFoundError("Table not found.")

    clean_base = (base_url or table_service.detect_lan_url()).rstrip("/")
    target_url = f"{clean_base}/t/{table.qr_token}"
    png_bytes = table_service.generate_qr_png(target_url)

    return Response(content=png_bytes, media_type="image/png")