from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import ASSISTANCE_REASON, AssistanceReason


class AssistanceRequest(Base):
    __tablename__ = "assistance_requests"
    __table_args__ = (
        sa.CheckConstraint(
            "(acknowledged_at IS NULL) = (acknowledged_by IS NULL)",
            name="chk_assistance_requests_ack_pair",
        ),
        sa.CheckConstraint(
            "acknowledged_at IS NULL OR acknowledged_at >= requested_at",
            name="chk_assistance_requests_ack_after",
        ),
        sa.Index(
            "idx_assistance_requests_open",
            "device_id",
            unique=True,
            postgresql_where=sa.text("acknowledged_at IS NULL"),
        ),
    )

    request_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    session_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
    )
    device_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("session_devices.device_id", ondelete="CASCADE"),
        nullable=False,
    )
    reason: Mapped[AssistanceReason] = mapped_column(
        ASSISTANCE_REASON,
        nullable=False,
        server_default=AssistanceReason.ASKED.value,
    )
    requested_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    acknowledged_by: Mapped[str | None] = mapped_column(
        sa.String(8),
        sa.ForeignKey("staff_accounts.staff_id", ondelete="RESTRICT"),
    )
