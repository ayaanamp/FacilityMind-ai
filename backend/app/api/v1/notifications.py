"""Notifications REST API endpoints."""

from __future__ import annotations

from backend.app.database.session import get_db
from backend.app.models.maintenance import Notification
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    """Schema for returning notification item."""

    id: int
    organization_id: int | None = None
    recipient_phone: str | None = None
    complaint_id: int | None = None
    title: str
    message: str
    is_read: bool
    created_at: str

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    phone: str | None = Query(None, description="Optional phone number to filter user notifications"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    """List recent notifications, optionally filtered by user phone number or global for admin."""
    stmt = select(Notification).order_by(desc(Notification.id)).limit(limit)
    if phone:
        stmt = stmt.where(Notification.recipient_phone == phone)

    res = await db.execute(stmt)
    notifications = res.scalars().all()
    return list(notifications)


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark a notification as read."""
    stmt = select(Notification).where(Notification.id == notification_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")

    item.is_read = True
    await db.commit()
    return {"success": True, "notification_id": notification_id, "is_read": True}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    phone: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark all notifications (or all for a user phone) as read."""
    from sqlalchemy import update

    stmt = update(Notification).values(is_read=True)
    if phone:
        stmt = stmt.where(Notification.recipient_phone == phone)
    await db.execute(stmt)
    await db.commit()
    return {"success": True, "message": "All notifications marked as read"}
