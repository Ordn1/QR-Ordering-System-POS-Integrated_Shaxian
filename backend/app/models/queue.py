from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class KitchenQueue(Base):
    __tablename__ = "kitchen_queue"
    __table_args__ = (
        sa.CheckConstraint("queue_position > 0", name="chk_kitchen_queue_position_positive"),
        sa.CheckConstraint(
            "priority_skips_used >= 0",
            name="chk_kitchen_queue_skips_non_negative",
        ),
        sa.Index(
            "idx_queue_active",
            "queue_position",
            postgresql_where=sa.text("completed_at IS NULL"),
        ),
    )

    queue_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    txn_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("transactions.txn_id"),
        nullable=False,
        unique=True,
    )
    queue_position: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False)
    priority_skips_used: Mapped[int] = mapped_column(
        sa.SmallInteger,
        nullable=False,
        server_default=sa.text("0"),
    )
    updated_by: Mapped[str | None] = mapped_column(
        sa.String(8),
        sa.ForeignKey("staff_accounts.staff_id", ondelete="RESTRICT"),
    )
    entered_queue_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    prep_started_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
