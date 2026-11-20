import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0005_companions_assistance"
down_revision = "0004_menu_code"
branch_labels = None
depends_on = None

OLD_EVENTS = (
    "dwell_timeout",
    "back_navigation",
    "cart_abandon",
    "category_revisit",
    "recommendation_shown",
    "recommendation_accepted",
    "recommendation_dismissed",
)
NEW_EVENTS = (
    "zoom_detected",
    "missed_tap",
    "assist_offered",
    "assist_accepted",
    "assist_declined",
    "display_changed",
    "crew_called",
    "code_entered",
)

MENU_SIZE = postgresql.ENUM(name="menu_size_enum", create_type=False)
ASSISTANCE_REASON = postgresql.ENUM(name="assistance_reason_enum", create_type=False)


def upgrade() -> None:
    op.execute("CREATE TYPE menu_size_enum AS ENUM ('grid', 'list', 'large')")
    op.execute("CREATE TYPE assistance_reason_enum AS ENUM ('asked', 'offered')")
    for value in NEW_EVENTS:
        op.execute(f"ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column("session_devices", sa.Column("managed_by_device_id", sa.BigInteger))
    op.create_foreign_key(
        "fk_session_devices_managed_by",
        "session_devices",
        "session_devices",
        ["managed_by_device_id"],
        ["device_id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        "chk_session_devices_companion_not_host",
        "session_devices",
        "managed_by_device_id IS NULL OR NOT is_host",
    )
    op.create_check_constraint(
        "chk_session_devices_not_self_managed",
        "session_devices",
        "managed_by_device_id <> device_id",
    )
    op.execute(
        "CREATE INDEX idx_session_devices_managed_by ON session_devices (managed_by_device_id) "
        "WHERE managed_by_device_id IS NOT NULL"
    )
    op.add_column(
        "session_devices",
        sa.Column("menu_size", MENU_SIZE, nullable=False, server_default="grid"),
    )
    op.add_column(
        "session_devices",
        sa.Column("is_high_contrast", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "session_devices",
        sa.Column("has_steady_taps", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "session_devices",
        sa.Column("display_chosen_at", sa.TIMESTAMP(timezone=True)),
    )
    op.execute(
        """
        UPDATE session_devices AS device
        SET menu_size = 'list', has_steady_taps = TRUE
        FROM priority_verification_log AS log
        WHERE log.device_id = device.device_id
          AND log.declared_status IN ('senior', 'pwd')
        """
    )

    op.create_table(
        "assistance_requests",
        sa.Column(
            "request_id",
            sa.BigInteger,
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column(
            "session_id",
            sa.BigInteger,
            sa.ForeignKey("sessions.session_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "device_id",
            sa.BigInteger,
            sa.ForeignKey("session_devices.device_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", ASSISTANCE_REASON, nullable=False, server_default="asked"),
        sa.Column(
            "requested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("acknowledged_at", sa.TIMESTAMP(timezone=True)),
        sa.Column(
            "acknowledged_by",
            sa.String(8),
            sa.ForeignKey("staff_accounts.staff_id", ondelete="RESTRICT"),
        ),
        sa.CheckConstraint(
            "(acknowledged_at IS NULL) = (acknowledged_by IS NULL)",
            name="chk_assistance_requests_ack_pair",
        ),
        sa.CheckConstraint(
            "acknowledged_at IS NULL OR acknowledged_at >= requested_at",
            name="chk_assistance_requests_ack_after",
        ),
    )
    op.execute(
        "CREATE UNIQUE INDEX idx_assistance_requests_open ON assistance_requests (device_id) "
        "WHERE acknowledged_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX idx_assistance_requests_open")
    op.drop_table("assistance_requests")

    op.drop_column("session_devices", "display_chosen_at")
    op.drop_column("session_devices", "has_steady_taps")
    op.drop_column("session_devices", "is_high_contrast")
    op.drop_column("session_devices", "menu_size")
    op.execute("DROP INDEX idx_session_devices_managed_by")
    op.drop_constraint("chk_session_devices_not_self_managed", "session_devices", type_="check")
    op.drop_constraint("chk_session_devices_companion_not_host", "session_devices", type_="check")
    op.drop_constraint("fk_session_devices_managed_by", "session_devices", type_="foreignkey")
    op.drop_column("session_devices", "managed_by_device_id")

    op.execute("DROP TYPE assistance_reason_enum")
    op.execute("DROP TYPE menu_size_enum")

    new_values = ", ".join(f"'{value}'" for value in NEW_EVENTS)
    old_values = ", ".join(f"'{value}'" for value in OLD_EVENTS)
    op.execute(f"DELETE FROM analytics_events WHERE event_type::text IN ({new_values})")
    op.execute("ALTER TYPE event_type_enum RENAME TO event_type_enum_0005")
    op.execute(f"CREATE TYPE event_type_enum AS ENUM ({old_values})")
    op.execute(
        "ALTER TABLE analytics_events ALTER COLUMN event_type TYPE event_type_enum "
        "USING event_type::text::event_type_enum"
    )
    op.execute("DROP TYPE event_type_enum_0005")
