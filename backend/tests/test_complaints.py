"""Test suite for Complaint submission, multi-agent pipeline, and decision generation."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_analyze_complaint(async_client: AsyncClient):
    """Test full multi-agent decision workflow on a realistic complaint."""
    payload = {
        "raw_complaint": "The AC in Computer Lab 3 is not cooling properly and is making a loud rattling noise.",
        "location": "Computer Lab 3",
        "severity": "Medium",
    }

    response = await async_client.post("/api/v1/complaints", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "complaint_id" in data
    assert data["status"] == "Analyzed"

    # 1. Verify Analysis Agent Output
    analysis = data["analysis"]
    assert "Air Conditioner" in analysis["equipment_type"]
    assert "Computer Lab 3" in analysis["location"]
    assert len(analysis["symptoms"]) > 5

    # 2. Verify Retrieval Agent Output
    similar_cases = data["similar_cases"]
    assert len(similar_cases) > 0
    assert "similarity_percentage" in similar_cases[0]
    assert similar_cases[0]["similarity_percentage"] > 0

    # 3. Verify Diagnosis Agent Output
    diagnosis = data["diagnosis"]
    assert len(diagnosis["primary_cause"]) > 3
    assert diagnosis["confidence_level"] in [
        "High Evidence",
        "Moderate Evidence",
        "Limited Evidence",
    ]

    # 4. Verify Recommendation Agent Output
    rec = data["recommendation"]
    assert len(rec["action"]) > 3
    assert rec["estimated_cost_min"] > 0
    assert rec["estimated_cost_max"] >= rec["estimated_cost_min"]
    assert rec["repair_time_hours"] > 0
    assert len(rec["repair_steps"]) >= 3

    # 5. Verify Explanation Agent Output
    exp = data["explanation"]
    assert len(exp["explanation_points"]) >= 3
    assert len(exp["full_text"]) > 20

    # 6. Verify Agent Runs Audit Trail
    agent_runs = data["agent_runs"]
    assert len(agent_runs) >= 5
    agent_names = [r["agent_name"] for r in agent_runs]
    assert "Complaint Analysis Agent" in agent_names
    assert "Historical Retrieval Agent" in agent_names
    assert "Diagnosis Agent" in agent_names
    assert "Recommendation Agent" in agent_names
    assert "Explanation Agent" in agent_names


@pytest.mark.asyncio
async def test_get_complaint_decision_by_id(async_client: AsyncClient):
    """Test retrieving existing decision report by complaint ID."""
    # First create
    create_resp = await async_client.post(
        "/api/v1/complaints",
        json={"raw_complaint": "Elevator door is stuck on Floor 2 and buzzer is sounding."},
    )
    assert create_resp.status_code == 200
    complaint_id = create_resp.json()["complaint_id"]

    # Fetch decision
    get_resp = await async_client.get(f"/api/v1/complaints/{complaint_id}/decision")
    assert get_resp.status_code == 200
    decision_data = get_resp.json()
    assert decision_data["complaint_id"] == complaint_id
    assert "Elevator" in decision_data["analysis"]["equipment_type"]
