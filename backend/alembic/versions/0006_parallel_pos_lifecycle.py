import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0006_parallel_pos_lifecycle"
down_revision = "0005_companions_assistance"
branch_labels = None
depends_on = None

END_REASON = postgresql.ENUM(name="session_end_reason_enum", create_type=False)
TENDER = postgresql.ENUM(name="tender_enum", create_type=False)


def upgrade() -> None:
    # Create
    op.execute(
        "CREATE TYPE session_end_reason_enum AS ENUM "
        "('completed', 'timeout', 'new_customer_override', 'staff_reset')"
    )
    op.execute("CREATE TYPE tender_enum AS ENUM ('cash', 'gcash', 'card')")

    op.add_column("menu_items", sa.Column("pos_code", sa.String(10)))

    # Backfill
    op.execute("UPDATE menu_items SET pos_code = menu_code WHERE menu_code IS NOT NULL")

    op.create_unique_constraint("uq_menu_items_pos_code", "menu_items", ["pos_code"])
    op.create_check_constraint(
        "chk_menu_items_pos_code_format",
        "menu_items",
        "pos_code ~ '^[A-Za-z0-9+-]{1,10}$'",
    )

    op.add_column("sessions", sa.Column("end_reason", END_REASON))
    op.create_check_constraint(
        "chk_sessions_end_reason_ended",
        "sessions",
        "end_reason IS NULL OR ended_at IS NOT NULL",
    )

    op.add_column("payments", sa.Column("tender", TENDER))


def downgrade() -> None:
    # Delete
    op.drop_column("payments", "tender")

    op.drop_constraint("chk_sessions_end_reason_ended", "sessions", type_="check")
    op.drop_column("sessions", "end_reason")

    op.drop_constraint("chk_menu_items_pos_code_format", "menu_items", type_="check")
    op.drop_constraint("uq_menu_items_pos_code", "menu_items", type_="unique")
    op.drop_column("menu_items", "pos_code")

    op.execute("DROP TYPE tender_enum")
    op.execute("DROP TYPE session_end_reason_enum")
