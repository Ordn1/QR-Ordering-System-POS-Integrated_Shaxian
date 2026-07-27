from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header

from app.core.deps import DbSession
from app.core.exceptions import AuthenticationError
from app.models import SessionDevice
from app.services import session as session_service

DEVICE_HEADER = "X-Device-Token"


async def get_current_device(
    session_id: int,
    db: DbSession,
    x_device_token: Annotated[str | None, Header(alias=DEVICE_HEADER)] = None,
) -> SessionDevice:
    if not x_device_token:
        raise AuthenticationError("Scan the QR code on your table to start ordering.")

    try:
        token = UUID(x_device_token)
    except ValueError as exc:
        raise AuthenticationError("Scan the QR code on your table to start ordering.") from exc

    return await session_service.authorize_device(db, session_id, token)


CurrentDevice = Annotated[SessionDevice, Depends(get_current_device)]
