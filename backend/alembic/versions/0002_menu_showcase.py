import sqlalchemy as sa

from alembic import op

revision = "0002_menu_showcase"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("model_filename", sa.String(80)))
    op.add_column(
        "menu_items",
        sa.Column("is_hot", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("menu_items", "is_hot")
    op.drop_column("menu_items", "model_filename")
