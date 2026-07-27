import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

ENUMS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("occupancy_status_enum", ("vacant", "occupied", "reserved")),
    ("staff_role_enum", ("service_crew", "admin")),
    ("priority_status_enum", ("standard", "senior", "pwd", "pregnant")),
    ("session_type_enum", ("standard", "priority", "group")),
    ("ui_mode_enum", ("standard", "accessible")),
    ("language_enum", ("en", "fil", "bis")),
    (
        "txn_status_enum",
        ("pending", "preparing", "ready", "completed", "abandoned", "voided"),
    ),
    ("payment_method_enum", ("online", "cashier")),
    ("payment_status_enum", ("pending", "paid", "failed")),
    ("print_status_enum", ("success", "failed")),
    (
        "event_type_enum",
        (
            "dwell_timeout",
            "back_navigation",
            "cart_abandon",
            "scroll_reversal",
            "recommendation_shown",
            "recommendation_accepted",
            "recommendation_dismissed",
        ),
    ),
)

SEQUENCES: tuple[str, ...] = (
    "seq_tables",
    "seq_staff",
    "seq_categories",
    "seq_menu_items",
    "seq_apriori_rules",
)

TABLES_IN_ORDER: tuple[str, ...] = (
    "audit_log",
    "priority_verification_log",
    "analytics_events",
    "payments",
    "kitchen_queue",
    "transaction_items",
    "transactions",
    "session_devices",
    "sessions",
    "apriori_rules",
    "menu_items",
    "categories",
    "staff_accounts",
    "tables",
)


def enum(name: str) -> postgresql.ENUM:
    return postgresql.ENUM(name=name, create_type=False)


def key_default(prefix: str, sequence: str) -> sa.TextClause:
    return sa.text(f"('{prefix}-' || LPAD(nextval('{sequence}')::TEXT, 4, '0'))")


def upgrade() -> None:
    # Create
    for name, values in ENUMS:
        rendered = ", ".join(f"'{value}'" for value in values)
        op.execute(f"CREATE TYPE {name} AS ENUM ({rendered})")

    for sequence in SEQUENCES:
        op.execute(f"CREATE SEQUENCE {sequence} START 1")

    op.create_table(
        "tables",
        sa.Column(
            "table_id",
            sa.String(8),
            server_default=key_default("TBL", "seq_tables"),
            nullable=False,
        ),
        sa.Column("table_number", sa.SmallInteger(), nullable=False),
        sa.Column(
            "qr_token",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "occupancy_status",
            enum("occupancy_status_enum"),
            server_default="vacant",
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("table_id"),
        sa.UniqueConstraint("table_number"),
        sa.CheckConstraint("table_id ~ '^TBL-[0-9]{4}$'", name="chk_tables_id_format"),
        sa.CheckConstraint("table_number > 0", name="chk_tables_number_positive"),
    )

    op.create_table(
        "staff_accounts",
        sa.Column(
            "staff_id",
            sa.String(8),
            server_default=key_default("STF", "seq_staff"),
            nullable=False,
        ),
        sa.Column("username", sa.String(30), nullable=False),
        sa.Column("password_hash", sa.CHAR(60), nullable=False),
        sa.Column("full_name", sa.String(80), nullable=False),
        sa.Column("role", enum("staff_role_enum"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("last_login_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("staff_id"),
        sa.UniqueConstraint("username"),
        sa.CheckConstraint("staff_id ~ '^STF-[0-9]{4}$'", name="chk_staff_accounts_id_format"),
    )
    op.execute("CREATE UNIQUE INDEX idx_staff_username_lower ON staff_accounts (LOWER(username))")

    op.create_table(
        "categories",
        sa.Column(
            "cat_id",
            sa.String(8),
            server_default=key_default("CAT", "seq_categories"),
            nullable=False,
        ),
        sa.Column("name_en", sa.String(40), nullable=False),
        sa.Column("name_fil", sa.String(40), nullable=False),
        sa.Column("name_bis", sa.String(40), nullable=False),
        sa.Column("display_order", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.PrimaryKeyConstraint("cat_id"),
        sa.CheckConstraint("cat_id ~ '^CAT-[0-9]{4}$'", name="chk_categories_id_format"),
    )

    op.create_table(
        "menu_items",
        sa.Column(
            "item_id",
            sa.String(8),
            server_default=key_default("MNU", "seq_menu_items"),
            nullable=False,
        ),
        sa.Column("cat_id", sa.String(8), nullable=False),
        sa.Column("name_en", sa.String(60), nullable=False),
        sa.Column("name_fil", sa.String(60), nullable=False),
        sa.Column("name_bis", sa.String(60), nullable=False),
        sa.Column("description_en", sa.String(160), nullable=True),
        sa.Column("description_fil", sa.String(160), nullable=True),
        sa.Column("description_bis", sa.String(160), nullable=True),
        sa.Column("price", sa.Numeric(8, 2), nullable=False),
        sa.Column("calories", sa.SmallInteger(), nullable=True),
        sa.Column("allergens", sa.String(120), nullable=True),
        sa.Column("dietary_flags", sa.String(60), nullable=True),
        sa.Column("image_filename", sa.String(80), nullable=True),
        sa.Column("is_available", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("item_id"),
        sa.ForeignKeyConstraint(["cat_id"], ["categories.cat_id"], ondelete="RESTRICT"),
        sa.CheckConstraint("item_id ~ '^MNU-[0-9]{4}$'", name="chk_menu_items_id_format"),
        sa.CheckConstraint("price >= 0", name="chk_menu_items_price_non_negative"),
        sa.CheckConstraint("calories >= 0", name="chk_menu_items_calories_non_negative"),
    )

    op.create_table(
        "apriori_rules",
        sa.Column(
            "rule_id",
            sa.String(8),
            server_default=key_default("APR", "seq_apriori_rules"),
            nullable=False,
        ),
        sa.Column("session_type", enum("session_type_enum"), nullable=False),
        sa.Column("antecedents", postgresql.JSONB(), nullable=False),
        sa.Column("consequents", postgresql.JSONB(), nullable=False),
        sa.Column("support", sa.Numeric(6, 4), nullable=False),
        sa.Column("confidence", sa.Numeric(6, 4), nullable=False),
        sa.Column("lift", sa.Numeric(6, 4), nullable=False),
        sa.Column(
            "generated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("rule_id"),
        sa.CheckConstraint("rule_id ~ '^APR-[0-9]{4}$'", name="chk_apriori_rules_id_format"),
        sa.CheckConstraint("support >= 0 AND support <= 1", name="chk_apriori_rules_support_range"),
        sa.CheckConstraint(
            "confidence >= 0 AND confidence <= 1",
            name="chk_apriori_rules_confidence_range",
        ),
        sa.CheckConstraint("lift > 0", name="chk_apriori_rules_lift_positive"),
    )
    op.execute("CREATE INDEX idx_apriori_segment_lift ON apriori_rules (session_type, lift DESC)")
    op.execute("CREATE INDEX idx_apriori_antecedents ON apriori_rules USING GIN (antecedents)")

    op.create_table(
        "sessions",
        sa.Column("session_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("table_id", sa.String(8), nullable=False),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("ended_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "declared_priority_status",
            enum("priority_status_enum"),
            server_default="standard",
            nullable=False,
        ),
        sa.Column(
            "session_type",
            enum("session_type_enum"),
            server_default="standard",
            nullable=False,
        ),
        sa.Column("group_mode", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "ui_mode_used",
            enum("ui_mode_enum"),
            server_default="standard",
            nullable=False,
        ),
        sa.Column("language_used", enum("language_enum"), server_default="en", nullable=False),
        sa.Column(
            "accessibility_accepted",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("session_id"),
        sa.ForeignKeyConstraint(["table_id"], ["tables.table_id"]),
    )
    op.execute(
        "CREATE INDEX idx_sessions_table_active ON sessions (table_id) WHERE ended_at IS NULL"
    )

    op.create_table(
        "session_devices",
        sa.Column("device_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "device_token",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "joined_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(30), nullable=True),
        sa.Column("is_host", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.PrimaryKeyConstraint("device_id"),
        sa.UniqueConstraint("device_token"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"], ondelete="CASCADE"),
    )

    op.create_table(
        "transactions",
        sa.Column("txn_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "placed_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("gross_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("vatable_sales", sa.Numeric(10, 2), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "vat_exempt_sales",
            sa.Numeric(10, 2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("vat_amount", sa.Numeric(10, 2), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "discount_amount",
            sa.Numeric(10, 2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("net_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("item_count", sa.SmallInteger(), nullable=False),
        sa.Column("is_priority", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("queue_date", sa.Date(), server_default=sa.text("CURRENT_DATE"), nullable=False),
        sa.Column("queue_number", sa.SmallInteger(), nullable=False),
        sa.Column("status", enum("txn_status_enum"), server_default="pending", nullable=False),
        sa.Column("voided_by", sa.String(8), nullable=True),
        sa.Column("void_reason", sa.String(120), nullable=True),
        sa.Column("voided_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("txn_id"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"]),
        sa.ForeignKeyConstraint(
            ["voided_by"],
            ["staff_accounts.staff_id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("queue_date", "queue_number", name="uq_txn_queue_daily"),
        sa.CheckConstraint("gross_amount >= 0", name="chk_transactions_gross_non_negative"),
        sa.CheckConstraint("net_amount >= 0", name="chk_transactions_net_non_negative"),
        sa.CheckConstraint("item_count > 0", name="chk_transactions_item_count_positive"),
        sa.CheckConstraint("queue_number > 0", name="chk_transactions_queue_number_positive"),
    )
    op.execute("CREATE INDEX idx_txn_session ON transactions (session_id)")
    op.execute(
        "CREATE INDEX idx_txn_status ON transactions (status) "
        "WHERE status IN ('pending', 'preparing', 'ready')"
    )
    op.execute("CREATE INDEX idx_txn_placed_at ON transactions (placed_at DESC)")

    op.create_table(
        "transaction_items",
        sa.Column("txi_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("txn_id", sa.BigInteger(), nullable=False),
        sa.Column("item_id", sa.String(8), nullable=False),
        sa.Column("device_id", sa.BigInteger(), nullable=True),
        sa.Column("quantity", sa.SmallInteger(), nullable=False),
        sa.Column("unit_price", sa.Numeric(8, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_discounted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "discount_amount",
            sa.Numeric(8, 2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("txi_id"),
        sa.ForeignKeyConstraint(["txn_id"], ["transactions.txn_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item_id"], ["menu_items.item_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["device_id"], ["session_devices.device_id"]),
        sa.CheckConstraint("quantity > 0", name="chk_transaction_items_quantity_positive"),
        sa.CheckConstraint(
            "unit_price >= 0",
            name="chk_transaction_items_unit_price_non_negative",
        ),
        sa.CheckConstraint("subtotal >= 0", name="chk_transaction_items_subtotal_non_negative"),
    )
    op.execute("CREATE INDEX idx_txi_txn ON transaction_items (txn_id)")
    op.execute("CREATE INDEX idx_txi_item ON transaction_items (item_id)")

    op.create_table(
        "kitchen_queue",
        sa.Column("queue_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("txn_id", sa.BigInteger(), nullable=False),
        sa.Column("queue_position", sa.SmallInteger(), nullable=False),
        sa.Column(
            "priority_skips_used",
            sa.SmallInteger(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("updated_by", sa.String(8), nullable=True),
        sa.Column(
            "entered_queue_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("prep_started_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("queue_id"),
        sa.UniqueConstraint("txn_id"),
        sa.ForeignKeyConstraint(["txn_id"], ["transactions.txn_id"]),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["staff_accounts.staff_id"],
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("queue_position > 0", name="chk_kitchen_queue_position_positive"),
        sa.CheckConstraint(
            "priority_skips_used >= 0",
            name="chk_kitchen_queue_skips_non_negative",
        ),
    )
    op.execute(
        "CREATE INDEX idx_queue_active ON kitchen_queue (queue_position) "
        "WHERE completed_at IS NULL"
    )

    op.create_table(
        "payments",
        sa.Column("payment_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("txn_id", sa.BigInteger(), nullable=False),
        sa.Column("device_id", sa.BigInteger(), nullable=True),
        sa.Column("method", enum("payment_method_enum"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "discount_applied",
            sa.Numeric(10, 2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("aggregator_ref", sa.String(50), nullable=True),
        sa.Column(
            "status",
            enum("payment_status_enum"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("print_status", enum("print_status_enum"), nullable=True),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("payment_id"),
        sa.ForeignKeyConstraint(["txn_id"], ["transactions.txn_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["device_id"], ["session_devices.device_id"]),
        sa.CheckConstraint("amount > 0", name="chk_payments_amount_positive"),
    )

    op.create_table(
        "analytics_events",
        sa.Column("event_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column("event_type", enum("event_type_enum"), nullable=False),
        sa.Column("screen_id", sa.String(40), nullable=True),
        sa.Column(
            "occurred_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("event_id"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"], ondelete="CASCADE"),
    )
    op.execute(
        "CREATE INDEX idx_events_session_time ON analytics_events (session_id, occurred_at DESC)"
    )
    op.execute("CREATE INDEX idx_events_type ON analytics_events (event_type)")

    op.create_table(
        "priority_verification_log",
        sa.Column("log_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column("declared_status", enum("priority_status_enum"), nullable=False),
        sa.Column("id_presented", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("id_last4", sa.CHAR(4), nullable=True),
        sa.Column("cardholder_name", sa.String(80), nullable=True),
        sa.Column("issuing_lgu", sa.String(50), nullable=True),
        sa.Column("verified_by", sa.String(8), nullable=True),
        sa.Column("verified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("discount_eligible", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.PrimaryKeyConstraint("log_id"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"]),
        sa.ForeignKeyConstraint(
            ["verified_by"],
            ["staff_accounts.staff_id"],
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "declared_status <> 'standard'",
            name="chk_priority_verification_log_not_standard",
        ),
        sa.CheckConstraint(
            "id_last4 ~ '^[0-9]{4}$'",
            name="chk_priority_verification_log_id_last4_format",
        ),
    )

    op.create_table(
        "audit_log",
        sa.Column("audit_id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("staff_id", sa.String(8), nullable=True),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.String(20), nullable=True),
        sa.Column("before_state", postgresql.JSONB(), nullable=True),
        sa.Column("after_state", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column(
            "occurred_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("audit_id"),
        sa.ForeignKeyConstraint(
            ["staff_id"],
            ["staff_accounts.staff_id"],
            ondelete="RESTRICT",
        ),
    )
    op.execute("CREATE INDEX idx_audit_staff_time ON audit_log (staff_id, occurred_at DESC)")
    op.execute("CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id)")
    op.execute("REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM shaxian_app")


def downgrade() -> None:
    # Delete
    op.execute("GRANT UPDATE, DELETE, TRUNCATE ON audit_log TO shaxian_app")

    for table in TABLES_IN_ORDER:
        op.drop_table(table)

    for sequence in SEQUENCES:
        op.execute(f"DROP SEQUENCE {sequence}")

    for name, _ in reversed(ENUMS):
        op.execute(f"DROP TYPE {name}")
