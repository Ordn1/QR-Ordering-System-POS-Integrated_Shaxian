import asyncio

from sqlalchemy import func, select

from app.database import SessionFactory, engine
from app.models import Table
from seeds.analytics import seed_analytics
from seeds.history import seed_history
from seeds.menu import seed_menu
from seeds.rules import seed_rules
from seeds.staff import DEV_ACCOUNTS, seed_staff
from seeds.tables import seed_tables


async def main() -> None:
    async with SessionFactory() as session:
        existing = await session.scalar(select(func.count()).select_from(Table))
        if existing:
            raise SystemExit(
                "Database already contains seed data. Rebuild from empty first:\n"
                "  alembic downgrade base && alembic upgrade head && python -m seeds.run"
            )

        tables = await seed_tables(session)
        staff = await seed_staff(session)
        items = await seed_menu(session)
        rules = await seed_rules(session, items)
        transactions, ordering_sessions = await seed_history(session, tables, staff, items)
        events = await seed_analytics(session, ordering_sessions, transactions)

        # Commit
        await session.commit()

        report(tables, items, rules, transactions, events)

    await engine.dispose()


def report(tables, items, rules, transactions, events) -> None:
    print(f"tables            {len(tables)}")
    print(f"staff accounts    {len(DEV_ACCOUNTS)}")
    print(f"menu items        {len(items)}")
    print(f"apriori rules     {len(rules)}")
    print(f"transactions      {len(transactions)}")
    print(f"analytics events  {events}")

    print("\nDev credentials — never real, never deployed:")
    for username, password, _, role in DEV_ACCOUNTS:
        print(f"  {role.value:13} {username:7} {password}")

    print("\nTable URLs for the demo:")
    for table in tables:
        print(f"  Table {table.table_number:2}  /t/{table.qr_token}")


if __name__ == "__main__":
    asyncio.run(main())
