from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Table

TABLE_COUNT = 12


async def seed_tables(
    session: AsyncSession, qr_tokens: dict[int, UUID] | None = None
) -> list[Table]:
    tokens = qr_tokens or {}
    tables = [
        Table(table_number=number, qr_token=tokens[number])
        if number in tokens
        else Table(table_number=number)
        for number in range(1, TABLE_COUNT + 1)
    ]
    session.add_all(tables)
    await session.flush()
    return tables
