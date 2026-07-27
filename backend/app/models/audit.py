from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (
        sa.Index("idx_audit_staff_time", "staff_id", sa.text("occurred_at DESC")),
        sa.Index("idx_audit_entity", "entity_type", "entity_id"),
    )

    audit_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    staff_id: Mapped[str | None] = mapped_column(
        sa.String(8),
        sa.ForeignKey("staff_accounts.staff_id", ondelete="RESTRICT"),
    )
    action: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    entity_type: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(sa.String(20))
    before_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    after_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(INET)
    occurred_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
