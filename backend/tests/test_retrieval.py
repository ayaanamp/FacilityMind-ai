"""Test suite for RAG retrieval and semantic search."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_similar_cases_endpoint(async_client: AsyncClient):
    """Test searching historical cases endpoint with semantic query."""
    response = await async_client.get(
        "/api/v1/cases/similar",
        params={"q": "water pump low pressure top floor", "equipment_type": "Water Pump"},
    )
    assert response.status_code == 200
    cases = response.json()
    assert len(cases) > 0
    assert "Water Pump" in cases[0]["equipment_type"]
    assert "similarity_percentage" in cases[0]


@pytest.mark.asyncio
async def test_maintenance_catalog_and_filters(async_client: AsyncClient):
    """Test maintenance catalog search and filters."""
    response = await async_client.get("/api/v1/maintenance", params={"limit": 10})
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "records" in data
    assert len(data["records"]) > 0

    eq_resp = await async_client.get("/api/v1/equipment")
    assert eq_resp.status_code == 200
    eq_list = eq_resp.json()
    assert len(eq_list) > 0

    loc_resp = await async_client.get("/api/v1/locations")
    assert loc_resp.status_code == 200
    loc_list = loc_resp.json()
    assert len(loc_list) > 0
