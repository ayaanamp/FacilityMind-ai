"""Test suite for Command Center Dashboard metrics."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_metrics_endpoint(async_client: AsyncClient):
    """Verify aggregated dashboard statistics."""
    response = await async_client.get("/api/v1/dashboard")
    assert response.status_code == 200
    metrics = response.json()

    assert "total_historical_records" in metrics
    assert "active_complaints" in metrics
    assert "urgency_distribution" in metrics
    assert "equipment_breakdown" in metrics
    assert "monthly_trends" in metrics

    urg = metrics["urgency_distribution"]
    assert "Low" in urg and "Medium" in urg and "High" in urg and "Critical" in urg
