from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import EVENT_TYPE, EventType


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = (
        sa.Index("idx_events_session_time", "session_id", sa.text("occurred_at DESC")),
        sa.Index("idx_events_type", "event_type"),
    )

    event_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    session_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[EventType] = mapped_column(EVENT_TYPE, nullable=False)
    screen_id: Mapped[str | None] = mapped_column(sa.String(40))
    occurred_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
