import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import StaffAccount
from app.models.enums import StaffRole

DEV_ACCOUNTS: tuple[tuple[str, str, str, StaffRole], ...] = (
    ("admin", "admin-demo-2026", "Ma. Teresa Dela Cruz", StaffRole.ADMIN),
    ("crew1", "crew1-demo-2026", "Juan Ramos Jr.", StaffRole.SERVICE_CREW),
    ("crew2", "crew2-demo-2026", "Andrea Peña", StaffRole.SERVICE_CREW),
)


def hash_password(plaintext: str) -> str:
    return bcrypt.hashpw(
        plaintext.encode("utf-8"),
        bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS),
    ).decode("utf-8")


async def seed_staff(session: AsyncSession) -> list[StaffAccount]:
    accounts = [
        StaffAccount(
            username=username,
            password_hash=hash_password(password),
            full_name=full_name,
            role=role,
        )
        for username, password, full_name, role in DEV_ACCOUNTS
    ]
    session.add_all(accounts)
    await session.flush()
    return accounts
