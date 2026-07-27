import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._tables: dict[int, set[WebSocket]] = defaultdict(set)
        self._kitchen: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def join_table(self, session_id: int, socket: WebSocket) -> None:
        async with self._lock:
            self._tables[session_id].add(socket)

    async def leave_table(self, session_id: int, socket: WebSocket) -> None:
        async with self._lock:
            self._tables[session_id].discard(socket)
            if not self._tables[session_id]:
                self._tables.pop(session_id, None)

    async def join_kitchen(self, socket: WebSocket) -> None:
        async with self._lock:
            self._kitchen.add(socket)

    async def leave_kitchen(self, socket: WebSocket) -> None:
        async with self._lock:
            self._kitchen.discard(socket)

    async def to_table(self, session_id: int, payload: dict) -> None:
        await self._send(list(self._tables.get(session_id, ())), payload)

    async def to_kitchen(self, payload: dict) -> None:
        await self._send(list(self._kitchen), payload)

    async def _send(self, sockets: list[WebSocket], payload: dict) -> None:
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except RuntimeError:
                continue


manager = ConnectionManager()
