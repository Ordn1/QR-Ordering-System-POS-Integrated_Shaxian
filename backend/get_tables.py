import asyncio
from app.database import SessionFactory
from app.models.table import Table
from sqlalchemy import select

async def main():
    async with SessionFactory() as session:
        result = await session.execute(select(Table))
        tables = result.scalars().all()
        for t in tables:
            print(f"Table {t.table_number}: {t.qr_token}")

if __name__ == "__main__":
    asyncio.run(main())
