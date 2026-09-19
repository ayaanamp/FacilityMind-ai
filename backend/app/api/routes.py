"""Unified API router configuration aggregating all platform endpoints."""

from backend.app.api.v1 import (
    analysis,
    cases,
    chat,
    complaints,
    dashboard,
    feedback,
    health,
    maintenance,
    technicians,
)
from fastapi import APIRouter

api_router = APIRouter()

# Register all versioned v1 sub-routers
api_router.include_router(health.router)
api_router.include_router(dashboard.router)
api_router.include_router(complaints.router)
api_router.include_router(analysis.router)
api_router.include_router(maintenance.router)
api_router.include_router(cases.router)
api_router.include_router(feedback.router)
api_router.include_router(technicians.router)
api_router.include_router(chat.router)

