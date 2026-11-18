import asyncio

from sqlalchemy import func, select

from app.database import SessionFactory, engine
from app.models import Table
from app.services import apriori as apriori_service
from seeds.history import seed_history
from seeds.menu import seed_menu
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
        transactions, _ = await seed_history(session, tables, staff, items)

        # Commit
        await session.commit()

        # Mine
        segments = await apriori_service.generate(session)

        report(tables, items, transactions, segments)

    await engine.dispose()


def report(tables, items, transactions, segments) -> None:
    print(f"tables            {len(tables)}")
    print(f"staff accounts    {len(DEV_ACCOUNTS)}")
    print(f"menu items        {len(items)}")
    print(f"transactions      {len(transactions)}  (generated history, not real diners)")

    print(
        f"\napriori rules mined from that history "
        f"(min_support={apriori_service.MIN_SUPPORT}, min_lift={apriori_service.MIN_LIFT}):"
    )
    print(f"  {'segment':10} {'baskets':>8} {'itemsets':>9} {'rules':>6}")
    for segment in segments:
        print(f"  {segment.segment:10} {segment.baskets:>8} {segment.itemsets:>9} {segment.rules:>6}")
    if any(segment.baskets and not segment.rules for segment in segments):
        print(
            "  A segment mined no rules. Add history (BUSINESS_DAYS / PER_DAY in "
            "seeds/history.py) rather than lowering the support floor."
        )

    print("\nNo analytics events are seeded: the recommendation funnel fills from real sessions.")

    print("\nDev credentials — never real, never deployed:")
    for username, password, _, role in DEV_ACCOUNTS:
        print(f"  {role.value:13} {username:7} {password}")

    print("\nTable URLs for the demo:")
    for table in tables:
        print(f"  Table {table.table_number:2}  /t/{table.qr_token}")


if __name__ == "__main__":
    asyncio.run(main())
