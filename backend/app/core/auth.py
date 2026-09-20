"""Authentication, password hashing, and token authorization utilities."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from backend.app.core.config import get_settings
from backend.app.database.session import get_db
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()
security = HTTPBearer(auto_error=False)


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Hash a plaintext password using salted PBKDF2-HMAC-SHA256."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations=100000,
    )
    return key.hex(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """Verify password against stored salt and hash in constant time."""
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, password_hash)


def create_access_token(data: dict[str, Any], expires_minutes: int | None = None) -> str:
    """Generate a signed, URL-safe HMAC-SHA256 authentication token."""
    expire_mins = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    exp_timestamp = int(time.time()) + (expire_mins * 60)

    payload = {
        **data,
        "exp": exp_timestamp,
        "iat": int(time.time()),
    }
    payload_json = json.dumps(payload, separators=(",", ":"))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")

    signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"{payload_b64}.{signature}"


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Validate and decode a signed authentication token."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, signature = parts

        expected_sig = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            return None

        # Fix base64 padding
        rem = len(payload_b64) % 4
        padded = payload_b64 + ("=" * ((4 - rem) % 4))
        payload_bytes = base64.urlsafe_b64decode(padded)
        payload = json.loads(payload_bytes.decode("utf-8"))

        if payload.get("exp", 0) < int(time.time()):
            return None  # Expired

        return payload
    except Exception:
        return None


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Dependency to validate that request is authenticated as an administrator."""
    from backend.app.models.maintenance import AdminUser

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required. Please login.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload["sub"]
    stmt = select(AdminUser).where(AdminUser.username == username)
    res = await db.execute(stmt)
    admin = res.scalar_one_or_none()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin user no longer exists or permissions revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return admin
