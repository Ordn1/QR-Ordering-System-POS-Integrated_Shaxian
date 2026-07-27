from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import PRIORITY_STATUS, PriorityStatus


class PriorityVerificationLog(Base):
    __tablename__ = "priority_verification_log"
    __table_args__ = (
        sa.CheckConstraint(
            "declared_status <> 'standard'",
            name="chk_priority_verification_log_not_standard",
        ),
        sa.CheckConstraint(
            "id_last4 ~ '^[0-9]{4}$'",
            name="chk_priority_verification_log_id_last4_format",
        ),
    )

    log_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    session_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("sessions.session_id"),
        nullable=False,
    )
    declared_status: Mapped[PriorityStatus] = mapped_column(PRIORITY_STATUS, nullable=False)
    id_presented: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.false(),
    )
    id_last4: Mapped[str | None] = mapped_column(sa.CHAR(4))
    cardholder_name: Mapped[str | None] = mapped_column(sa.String(80))
    issuing_lgu: Mapped[str | None] = mapped_column(sa.String(50))
    verified_by: Mapped[str | None] = mapped_column(
        sa.String(8),
        sa.ForeignKey("staff_accounts.staff_id", ondelete="RESTRICT"),
    )
    verified_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    discount_eligible: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.false(),
    )
