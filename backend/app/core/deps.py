from collections.abc import AsyncIterator
from typing import Annotated

import jwt
from fastapi import Cookie, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError
from app.core.security import COOKIE_NAME, decode_access_token
from app.database import SessionFactory
from app.models import StaffAccount
from app.services import auth as auth_service


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_staff(
    db: DbSession,
    shaxian_session: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> StaffAccount:
    if not shaxian_session:
        raise AuthenticationError("Your session has ended. Sign in to continue.")

    try:
        payload = decode_access_token(shaxian_session)
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Your session has ended. Sign in to continue.") from exc

    staff = await db.scalar(
        select(StaffAccount).where(StaffAccount.staff_id == payload["sub"])
    )
    if staff is None or not staff.is_active:
        raise AuthenticationError("That account is no longer active.")

    return staff


CurrentStaff = Annotated[StaffAccount, Depends(get_current_staff)]


async def require_admin(staff: CurrentStaff) -> StaffAccount:
    return auth_service.require_admin(staff)


async def require_staff(staff: CurrentStaff) -> StaffAccount:
    return auth_service.require_staff(staff)


AdminStaff = Annotated[StaffAccount, Depends(require_admin)]
AnyStaff = Annotated[StaffAccount, Depends(require_staff)]
