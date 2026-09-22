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

    async def connect(self, websocket: WebSocket) -> None:
        """Accept connection and add to active pool."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total active: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove connection from active pool."""
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast_json(self, data: dict) -> None:
        """Broadcast JSON payload to all active clients, pruning dead connections."""
        async with self._lock:
            clients = list(self.active_connections)

        for client in clients:
            try:
                await client.send_json(data)
            except Exception as e:
                logger.debug(f"Failed to send to client ({e}), removing.")
                await self.disconnect(client)

    @property
    def count(self) -> int:
        return len(self.active_connections)

manager = ConnectionManager()
