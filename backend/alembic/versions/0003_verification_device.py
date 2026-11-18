import sqlalchemy as sa

from alembic import op

revision = "0003_verification_device"
down_revision = "0002_menu_showcase"
branch_labels = None
depends_on = None

TABLE = "priority_verification_log"
DEVICE_FK = "fk_priority_verification_log_device"
ONE_PER_DEVICE = "uq_priority_verification_log_session_device"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("device_id", sa.BigInteger(), nullable=True))

    # Backfill
    op.execute(
        f"""
        UPDATE {TABLE} AS log
        SET device_id = (
            SELECT device.device_id
            FROM session_devices AS device
            WHERE device.session_id = log.session_id
            ORDER BY device.is_host DESC, device.joined_at, device.device_id
            LIMIT 1
        )
        """
    )

    op.alter_column(TABLE, "device_id", nullable=False)
    op.create_foreign_key(DEVICE_FK, TABLE, "session_devices", ["device_id"], ["device_id"])
    op.create_unique_constraint(ONE_PER_DEVICE, TABLE, ["session_id", "device_id"])

    op.execute("ALTER TYPE event_type_enum RENAME VALUE 'scroll_reversal' TO 'category_revisit'")


def downgrade() -> None:
    op.execute("ALTER TYPE event_type_enum RENAME VALUE 'category_revisit' TO 'scroll_reversal'")

    op.drop_constraint(ONE_PER_DEVICE, TABLE, type_="unique")
    op.drop_constraint(DEVICE_FK, TABLE, type_="foreignkey")
    op.drop_column(TABLE, "device_id")
