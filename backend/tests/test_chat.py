"""Test suite for Gemini AI Chat Assistant endpoints (User, Admin, and General)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_gemini_chat_endpoint_simple_query(async_client: AsyncClient):
    payload = {
        "message": "What is the recommended fix for a leaking air conditioner?",
        "history": [],
    }
    response = await async_client.post("/api/v1/chat/gemini", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "source" in data
    assert "grounded_context" in data


@pytest.mark.asyncio
async def test_gemini_chat_endpoint_draft_complaint(async_client: AsyncClient):
    payload = {
        "message": "Please draft a complaint: projector in Room 204 has blinking red light and shut down",
        "history": [],
    }
    response = await async_client.post("/api/v1/chat/gemini", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "complaint_draft" in data


@pytest.mark.asyncio
async def test_user_chat_endpoint(async_client: AsyncClient):
    """Test scoped user AI chat endpoint."""
    payload = {
        "message": "How do I submit a complaint for a water purifier?",
        "history": [],
        "user_phone": "+91 98765 43210",
    }
    response = await async_client.post("/api/v1/chat/user", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "suggested_actions" in data


@pytest.mark.asyncio
async def test_admin_chat_endpoint(async_client: AsyncClient):
    """Test executive admin AI chat endpoint."""
    payload = {
        "message": "Give me a summary of open complaints and technician availability.",
        "history": [],
    }
    response = await async_client.post("/api/v1/chat/admin", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "grounded_context" in data


@pytest.mark.asyncio
async def test_user_chat_incident_drafting(async_client: AsyncClient):
    """Test that student reporting a breakdown receives a structured draft complaint."""
    payload = {
        "message": "Central AC in Science Wing Room 204 is making severe rattling sounds and blowing warm air",
        "history": [],
        "user_phone": "+91 98765 43210",
    }
    response = await async_client.post("/api/v1/chat/user", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "draft_complaint" in data
    assert data["draft_complaint"] is not None
    assert data["draft_complaint"]["equipment_type"] == "Air Conditioner"
    assert "Science Wing" in data["draft_complaint"]["location"]
    assert any(a["action_type"] == "draft_complaint" for a in data.get("suggested_actions", []))


@pytest.mark.asyncio
async def test_admin_chat_financial_and_stats_query(async_client: AsyncClient):
    """Test admin asking for financial outlay and technician roster."""
    payload = {
        "message": "What is our total spend on repairs and who are the available technicians?",
        "history": [],
    }
    response = await async_client.post("/api/v1/chat/admin", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "grounded_context" in data
    assert "total_spend" in data["grounded_context"]
    assert "available_technicians" in data["grounded_context"]

