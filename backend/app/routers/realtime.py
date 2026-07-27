from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

import jwt

from app.core.security import COOKIE_NAME, decode_access_token
from app.database import SessionFactory
from app.models import SessionDevice, StaffAccount
from app.websocket.manager import manager

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/orders/{session_id}")
async def table_socket(websocket: WebSocket, session_id: int, device: str = "") -> None:
    try:
        token = UUID(device)
    except ValueError:
        await websocket.close(code=4401)
        return

    async with SessionFactory() as db:
        owner = await db.scalar(
            select(SessionDevice).where(
                SessionDevice.session_id == session_id,
                SessionDevice.device_token == token,
            )
        )

    if owner is None:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    await manager.join_table(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.leave_table(session_id, websocket)


@router.websocket("/ws/kitchen")
async def kitchen_socket(websocket: WebSocket) -> None:
    cookie = websocket.cookies.get(COOKIE_NAME)
    if not cookie:
        await websocket.close(code=4401)
        return

    try:
        payload = decode_access_token(cookie)
    except jwt.PyJWTError:
        await websocket.close(code=4401)
        return

    async with SessionFactory() as db:
        staff = await db.scalar(
            select(StaffAccount).where(StaffAccount.staff_id == payload["sub"])
        )

    if staff is None or not staff.is_active:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    await manager.join_kitchen(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.leave_kitchen(websocket)
