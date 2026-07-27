import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import OCCUPANCY_STATUS, OccupancyStatus
from app.models.keys import key_check, key_default


class Table(Base):
    __tablename__ = "tables"
    __table_args__ = (
        key_check("tables", "table_id", "TBL"),
        sa.CheckConstraint("table_number > 0", name="chk_tables_number_positive"),
    )

    table_id: Mapped[str] = mapped_column(
        sa.String(8),
        primary_key=True,
        server_default=key_default("TBL", "seq_tables"),
    )
    table_number: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False, unique=True)
    qr_token: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        unique=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    occupancy_status: Mapped[OccupancyStatus] = mapped_column(
        OCCUPANCY_STATUS,
        nullable=False,
        server_default=OccupancyStatus.VACANT.value,
    )
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
