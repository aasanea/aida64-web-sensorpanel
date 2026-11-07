"""WebSocket Connection Manager and Streamer."""

import asyncio
from typing import Set, Optional
from fastapi import WebSocket
from loguru import logger

class ConnectionManager:
    """Manages active WebSocket connections and broadcasting."""

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._send_locks = {}
        self.audio_subscribers = set()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept connection and add to active pool."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
            self._send_locks[websocket] = asyncio.Lock()
        logger.info(f"WebSocket client connected. Total active: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove connection from active pool."""
        async with self._lock:
            self.active_connections.discard(websocket)
            self._send_locks.pop(websocket, None)
            self.audio_subscribers.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast_json(self, data: dict, *, audio_only=False) -> None:
        """Broadcast JSON payload to all active clients, pruning dead connections."""
        async with self._lock:
            clients = list(self.audio_subscribers if audio_only else self.active_connections)

        async def deliver(client):
            try:
                await asyncio.wait_for(self.send_json(client, data), timeout=0.25)
            except Exception as e:
                logger.debug(f"Failed to send to client ({e}), removing.")
                await self.disconnect(client)
        await asyncio.gather(*(deliver(client) for client in clients))

    async def send_json(self, client, data):
        lock = self._send_locks.get(client)
        if lock:
            async with lock:
                await client.send_json(data)

    async def send_text(self, client, data):
        lock = self._send_locks.get(client)
        if lock:
            async with lock:
                await client.send_text(data)

    @property
    def count(self) -> int:
        return len(self.active_connections)

manager = ConnectionManager()
