import sqlalchemy as sa

REFERENCE_KEYS: tuple[tuple[str, str, str], ...] = (
    ("tables", "TBL", "seq_tables"),
    ("staff_accounts", "STF", "seq_staff"),
    ("categories", "CAT", "seq_categories"),
    ("menu_items", "MNU", "seq_menu_items"),
    ("apriori_rules", "APR", "seq_apriori_rules"),
)


def key_default(prefix: str, sequence: str) -> sa.TextClause:
    return sa.text(f"('{prefix}-' || LPAD(nextval('{sequence}')::TEXT, 4, '0'))")


def key_check(table: str, column: str, prefix: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(
        f"{column} ~ '^{prefix}-[0-9]{{4}}$'",
        name=f"chk_{table}_id_format",
    )
