from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import STAFF_ROLE, StaffRole
from app.models.keys import key_check, key_default


class StaffAccount(Base):
    __tablename__ = "staff_accounts"
    __table_args__ = (key_check("staff_accounts", "staff_id", "STF"),)

    staff_id: Mapped[str] = mapped_column(
        sa.String(8),
        primary_key=True,
        server_default=key_default("STF", "seq_staff"),
    )
    username: Mapped[str] = mapped_column(sa.String(30), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(sa.CHAR(60), nullable=False)
    full_name: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    role: Mapped[StaffRole] = mapped_column(STAFF_ROLE, nullable=False)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    last_login_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
