from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import OccupancyStatus, SessionType
from app.schemas.fields import SmallPositive


class TableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    table_id: str
    table_number: int
    qr_token: UUID
    occupancy_status: OccupancyStatus
    is_active: bool = True
    created_at: datetime | None = None
    device_count: int = 0
    session_type: SessionType | None = None
    group_mode: bool = False


class TableCreate(BaseModel):
    table_number: SmallPositive
    occupancy_status: OccupancyStatus = OccupancyStatus.VACANT
    is_active: bool = True


class TableUpdate(BaseModel):
    table_number: SmallPositive
    occupancy_status: OccupancyStatus = OccupancyStatus.VACANT
    is_active: bool = True


class TableCatalogRead(BaseModel):
    tables: list[TableRead]
    detected_lan_ip: str
    detected_lan_url: str


TableCatalog = TableCatalogRead