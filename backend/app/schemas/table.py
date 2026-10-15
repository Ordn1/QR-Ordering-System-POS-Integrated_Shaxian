from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import OccupancyStatus, SessionType


class TableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    table_id: str
    table_number: int
    qr_token: UUID
    occupancy_status: OccupancyStatus
    device_count: int = 0
    session_type: SessionType | None = None
    group_mode: bool = False


class TableCatalogRead(BaseModel):
    tables: list[TableRead]
    detected_lan_ip: str
    detected_lan_url: str


TableCatalog = TableCatalogRead
