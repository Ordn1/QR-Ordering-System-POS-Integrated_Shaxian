from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, PermissionError
from app.core.security import verify_password
from app.models import StaffAccount
from app.models.enums import StaffRole

CREDENTIALS_REJECTED = "That username and password do not match."


async def authenticate(db: AsyncSession, username: str, password: str) -> StaffAccount:
    """Verify credentials and stamp the login, or raise AuthenticationError."""
    staff = await db.scalar(
        select(StaffAccount).where(func.lower(StaffAccount.username) == username.lower())
    )

    if staff is None or not verify_password(password, staff.password_hash):
        raise AuthenticationError(CREDENTIALS_REJECTED)

    if not staff.is_active:
        raise AuthenticationError("That account has been deactivated.")

    staff.last_login_at = datetime.now(UTC)
    await db.commit()

    return staff


def require_role(staff: StaffAccount, *allowed: StaffRole) -> StaffAccount:
    """Enforce a role at the service layer, where hiding a button is not security."""
    if staff.role not in allowed:
        raise PermissionError("Your account does not have access to that.")
    return staff


def require_admin(staff: StaffAccount) -> StaffAccount:
    return require_role(staff, StaffRole.ADMIN)


def require_staff(staff: StaffAccount) -> StaffAccount:
    return require_role(staff, StaffRole.ADMIN, StaffRole.SERVICE_CREW)
