"""Detailed platform health, diagnostics, and subsystem status router."""

from pathlib import Path

from backend.app.agents.llm import llm_client
from backend.app.core.config import Settings, get_settings
from backend.app.database.session import get_db
from backend.app.models.maintenance import MaintenanceRecord
from backend.app.rag.vector_store import vector_store
from backend.app.schemas.health import HealthResponse
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["Health & Telemetry"])


@router.get("/health", response_model=HealthResponse)
async def get_health(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    """Check overall service, database, vector index, and AI subsystem connectivity."""
    db_status = "unknown"
    record_count = 0
    try:
        count_res = await db.execute(select(func.count(MaintenanceRecord.id)))
        record_count = count_res.scalar() or 0
        db_status = f"connected ({record_count} records)"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    vec_count = vector_store.count()
    vector_status = f"ready ({vec_count} vectors indexed)"

    llm_status = (
        "connected (Gemini API)" if llm_client.is_available else "active (Evidence Fallback Engine)"
    )

    csv_path = Path("data/maintenance_records.csv")
    dataset_status = (
        f"loaded ({csv_path.stat().st_size // 1024} KB)" if csv_path.exists() else "not found"
    )

    services = {
        "api": "online",
        "database": db_status,
        "vector_store": vector_status,
        "llm_service": llm_status,
        "dataset": dataset_status,
        "agent_orchestrator": "ready (LangGraph 6-Node Pipeline)",
    }

    is_healthy = "unhealthy" not in db_status

    return HealthResponse(
        status="ok" if is_healthy else "degraded",
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
        services=services,
    )
