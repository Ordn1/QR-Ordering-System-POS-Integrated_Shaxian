import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import (
    LANGUAGE,
    PRIORITY_STATUS,
    SESSION_TYPE,
    UI_MODE,
    Language,
    PriorityStatus,
    SessionType,
    UiMode,
)


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        sa.Index(
            "idx_sessions_table_active",
            "table_id",
            postgresql_where=sa.text("ended_at IS NULL"),
        ),
    )

    session_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    table_id: Mapped[str] = mapped_column(
        sa.String(8),
        sa.ForeignKey("tables.table_id"),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    ended_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    declared_priority_status: Mapped[PriorityStatus] = mapped_column(
        PRIORITY_STATUS,
        nullable=False,
        server_default=PriorityStatus.STANDARD.value,
    )
    session_type: Mapped[SessionType] = mapped_column(
        SESSION_TYPE,
        nullable=False,
        server_default=SessionType.STANDARD.value,
    )
    group_mode: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.false(),
    )
    ui_mode_used: Mapped[UiMode] = mapped_column(
        UI_MODE,
        nullable=False,
        server_default=UiMode.STANDARD.value,
    )
    language_used: Mapped[Language] = mapped_column(
        LANGUAGE,
        nullable=False,
        server_default=Language.EN.value,
    )
    accessibility_accepted: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.false(),
    )

    devices: Mapped[list["SessionDevice"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class SessionDevice(Base):
    __tablename__ = "session_devices"

    device_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    session_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
    )
    device_token: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        unique=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    joined_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    display_name: Mapped[str | None] = mapped_column(sa.String(30))
    is_host: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.false())

    session: Mapped[Session] = relationship(back_populates="devices")
