"""WebSocket endpoint for real-time live synchronization."""

from backend.app.core.events import event_bus
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket) -> None:
    """Real-time event stream for complaint status updates, notifications, and telemetry."""
    await event_bus.connect(websocket)
    try:
        while True:
            # Keep connection alive; clients can send ping/heartbeats or filter subscriptions
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        event_bus.disconnect(websocket)
    except Exception:
        event_bus.disconnect(websocket)
