"""Real-time event broadcasting and WebSocket connection management."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts real-time system events."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket client."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Unregister a disconnected WebSocket client."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast_event(self, event_type: str, payload: dict[str, Any]) -> None:
        """Broadcast an event to all connected WebSocket clients."""
        message = {
            "type": event_type,
            "data": payload,
            "timestamp": asyncio.get_event_loop().time(),
        }
        message_json = json.dumps(message)
        dead_connections: list[WebSocket] = []

        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.warning(f"Error sending message to WebSocket client: {e}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


# Global singleton connection manager
event_bus = ConnectionManager()
