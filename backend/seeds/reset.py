"""Reset the database between Alpha test runs.

    python -m seeds.reset            keep the QR codes already printed for each table
    python -m seeds.reset --new-qr   issue new QR tokens, then reprint the table markers

Rebuilds the schema from empty, so every test order, session, kitchen queue, payment,
analytics event and audit entry is cleared. Then reseeds the menu, tables, staff and
order history, and mines the standard, priority and group Apriori rules from it.

Stop the backend first. It keeps carts in memory that would outlive the reset.
"""

import argparse
import asyncio
from pathlib import Path
from uuid import UUID

from alembic import command
from alembic.config import Config
from sqlalchemy import select, text

from app.database import SessionFactory, engine
from app.models import Table
from seeds.history import require_known_dishes
from seeds.run import populate
from seeds.tables import TABLE_COUNT

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"

OTHER_CONNECTIONS = text(
    "SELECT count(*) FROM pg_stat_activity "
    "WHERE datname = current_database() "
    "AND backend_type = 'client backend' "
    "AND pid <> pg_backend_pid()"
)
TABLES_EXIST = text("SELECT to_regclass('public.tables') IS NOT NULL")


async def other_connections() -> int:
    async with SessionFactory() as session:
        count = await session.scalar(OTHER_CONNECTIONS)
    await engine.dispose()
    return count


async def printed_tokens() -> dict[int, UUID]:
    async with SessionFactory() as session:
        tokens: dict[int, UUID] = {}
        if await session.scalar(TABLES_EXIST):
            rows = await session.execute(select(Table.table_number, Table.qr_token))
            tokens = {number: token for number, token in rows}
    await engine.dispose()
    return tokens


async def reseed(tokens: dict[int, UUID]) -> None:
    async with SessionFactory() as session:
        await populate(session, tokens)
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset the database for the next Alpha test run.")
    parser.add_argument(
        "--new-qr",
        action="store_true",
        help="issue new table QR tokens instead of keeping the printed ones",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="reset even while other connections to the database are open",
    )
    args = parser.parse_args()

    require_known_dishes()

    busy = asyncio.run(other_connections())
    if busy and not args.force:
        raise SystemExit(
            f"{busy} other connection(s) to this database are open. Stop the backend "
            "(and close psql or pgAdmin), then run this again, or pass --force."
        )

    tokens = {} if args.new_qr else asyncio.run(printed_tokens())
    dropped = sorted(number for number in tokens if number > TABLE_COUNT)

    config = Config(str(ALEMBIC_INI))
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    asyncio.run(reseed(tokens))

    print()
    if tokens:
        print("QR tokens kept: the table markers already printed still work.")
    else:
        print("New QR tokens issued. Export and reprint them: python export_qr_codes.py")
    if dropped:
        print(f"Tables {', '.join(map(str, dropped))} are not part of the seed and were removed.")


if __name__ == "__main__":
    main()
