"""Health check response schemas."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """System health check response."""

    status: str = Field(..., description="Overall system status (e.g. 'ok', 'degraded')")
    environment: str = Field(..., description="Active runtime environment")
    version: str = Field(..., description="Application version")
    services: dict[str, str] = Field(
        default_factory=dict,
        description="Health status of constituent subsystems (database, ai, etc.)",
    )
