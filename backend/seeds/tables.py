from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Table

TABLE_COUNT = 12


async def seed_tables(session: AsyncSession) -> list[Table]:
    tables = [Table(table_number=number) for number in range(1, TABLE_COUNT + 1)]
    session.add_all(tables)
    await session.flush()
    return tables
