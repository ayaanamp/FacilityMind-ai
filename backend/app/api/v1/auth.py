"""Administrator authentication REST API endpoints."""

from __future__ import annotations

import datetime
from typing import Any

from backend.app.core.auth import create_access_token, get_current_admin, verify_password
from backend.app.database.session import get_db
from backend.app.models.maintenance import AdminUser
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["Admin Authentication"])


class AdminLoginRequest(BaseModel):
    """Schema for administrator credential login."""

    username: str = Field(..., min_length=2, description="Admin username")
    password: str = Field(..., min_length=3, description="Admin password")


class AdminUserOut(BaseModel):
    """Public profile of authenticated administrator."""

    id: int
    username: str
    full_name: str
    email: str
    phone: str
    role: str
    organization_id: int | None = None
    last_login: str | None = None


class LoginResponse(BaseModel):
    """Authentication token response payload."""

    access_token: str
    token_type: str = "Bearer"
    user: AdminUserOut


@router.post("/login", response_model=LoginResponse)
async def login_admin(
    payload: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Authenticate administrator with secure password validation and issue signed session token."""
    username_clean = payload.username.strip()
    from sqlalchemy import func, or_

    stmt = (
        select(AdminUser)
        .where(
            or_(
                func.lower(AdminUser.username) == func.lower(username_clean),
                func.lower(AdminUser.email) == func.lower(username_clean),
                func.lower(AdminUser.full_name) == func.lower(username_clean),
            )
        )
        .order_by(AdminUser.id.asc())
        .limit(1)
    )
    res = await db.execute(stmt)
    admin = res.scalar_one_or_none()

    if not admin:
        # Check if database is fresh (0 admin users) - auto-initialize initial manager
        count_res = await db.execute(select(func.count(AdminUser.id)))
        if (count_res.scalar() or 0) == 0:
            from backend.app.core.auth import hash_password
            salt, pw_hash = hash_password(payload.password if len(payload.password) >= 3 else "admin123")
            now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            admin = AdminUser(
                username=username_clean if username_clean else "admin",
                password_hash=pw_hash,
                salt=salt,
                full_name="Facility Administrator",
                email="admin@campus.edu",
                phone="+91 98765 43210",
                role="Facility Director",
                is_active=True,
                created_at=now_str,
                last_login=now_str,
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password. Please verify your credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if not verify_password(payload.password, admin.password_hash, admin.salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password for administrator account.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account has been deactivated.",
        )

    # Update last login timestamp
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    admin.last_login = now_str
    await db.commit()

    token = create_access_token(
        data={"sub": admin.username, "user_id": admin.id, "role": admin.role}
    )

    user_out = AdminUserOut(
        id=admin.id,
        username=admin.username,
        full_name=admin.full_name,
        email=admin.email,
        phone=admin.phone,
        role=admin.role,
        organization_id=admin.organization_id,
        last_login=admin.last_login,
    )

    return LoginResponse(access_token=token, token_type="Bearer", user=user_out)


@router.get("/me", response_model=AdminUserOut)
async def get_current_admin_profile(
    current_admin: AdminUser = Depends(get_current_admin),
) -> AdminUserOut:
    """Return currently authenticated administrator profile."""
    return AdminUserOut(
        id=current_admin.id,
        username=current_admin.username,
        full_name=current_admin.full_name,
        email=current_admin.email,
        phone=current_admin.phone,
        role=current_admin.role,
        organization_id=current_admin.organization_id,
        last_login=current_admin.last_login,
    )


@router.post("/logout")
async def logout_admin() -> dict[str, Any]:
    """Logout endpoint to acknowledge session termination."""
    return {"success": True, "message": "Successfully logged out."}
