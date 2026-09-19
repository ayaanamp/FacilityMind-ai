"""Test health check and system diagnostic endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_endpoint(async_client: AsyncClient):
    """Verify health check endpoint returns 200 OK with deep telemetry."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["environment"] == "testing"
    assert "version" in data
    assert "database" in data["services"]
    assert "vector_store" in data["services"]
    assert "llm_service" in data["services"]
    assert "agent_orchestrator" in data["services"]


@pytest.mark.asyncio
async def test_openapi_schema_accessible(async_client: AsyncClient):
    """Verify OpenAPI documentation schema endpoint is accessible."""
    response = await async_client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "openapi" in data
    assert "paths" in data
    assert "/api/v1/health" in data["paths"]
    assert "/api/v1/complaints" in data["paths"]
    assert "/api/v1/analyze" in data["paths"]
    assert "/api/v1/dashboard" in data["paths"]
