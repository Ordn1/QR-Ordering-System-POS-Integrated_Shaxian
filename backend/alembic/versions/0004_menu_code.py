import sqlalchemy as sa

from alembic import op

revision = "0004_menu_code"
down_revision = "0003_verification_device"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("menu_code", sa.String(4)))
    op.add_column("menu_items", sa.Column("name_zh", sa.String(30)))
    op.create_unique_constraint("uq_menu_items_menu_code", "menu_items", ["menu_code"])
    op.create_check_constraint(
        "chk_menu_items_menu_code_format",
        "menu_items",
        "menu_code ~ '^[A-Z][0-9]{1,2}[a-z+]?$'",
    )


def downgrade() -> None:
    op.drop_constraint("chk_menu_items_menu_code_format", "menu_items", type_="check")
    op.drop_constraint("uq_menu_items_menu_code", "menu_items", type_="unique")
    op.drop_column("menu_items", "name_zh")
    op.drop_column("menu_items", "menu_code")
