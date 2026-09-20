"""Test suite for Complaint submission, tracking, lifecycle transitions, timeline, and decision generation."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_analyze_complaint(async_client: AsyncClient):
    """Test full multi-agent decision workflow on a realistic complaint."""
    payload = {
        "raw_complaint": "The AC in Computer Lab 3 is not cooling properly and is making a loud rattling noise.",
        "location": "Computer Lab 3",
        "severity": "Medium",
        "reporter_phone": "+91 98765 43210",
        "reporter_name": "Dr. Sarah",
    }

    response = await async_client.post("/api/v1/complaints", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "complaint_id" in data
    assert data["status"] in ["UNDER_REVIEW", "Analyzed"]

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
async def test_complaint_tracking_and_timeline(async_client: AsyncClient):
    """Test public tracking endpoint and timeline events for a complaint."""
    # Create complaint
    create_resp = await async_client.post(
        "/api/v1/complaints",
        json={
            "raw_complaint": "Elevator door is stuck on Floor 2 and buzzer is sounding.",
            "location": "Main Building Elevator #1",
            "reporter_phone": "+91 99887 76655",
            "reporter_name": "Prof. Rao",
        },
    )
    assert create_resp.status_code == 200
    cid = create_resp.json()["complaint_id"]

    # Track by ID
    track_resp = await async_client.get(f"/api/v1/complaints/track/{cid}")
    assert track_resp.status_code == 200
    track_data = track_resp.json()
    assert track_data["id"] == cid
    assert track_data["tracking_code"].startswith("FM-")
    assert len(track_data["timeline_events"]) >= 2

    # Track by tracking code
    tcode = track_data["tracking_code"]
    track_code_resp = await async_client.get(f"/api/v1/complaints/track/{tcode}")
    assert track_code_resp.status_code == 200
    assert track_code_resp.json()["id"] == cid

    # Get user complaints by phone
    user_my_resp = await async_client.get("/api/v1/complaints/user/my?phone=%2B91 99887 76655")
    assert user_my_resp.status_code == 200
    assert len(user_my_resp.json()) >= 1

    # Resolve complaint
    resolve_resp = await async_client.post(
        f"/api/v1/complaints/{cid}/resolve",
        json={
            "resolution_notes": "Door optical safety sensor realigned and debris removed from floor track.",
            "labor_cost": 500,
            "parts_cost": 200,
            "assigned_technician_name": "Arun Kumar",
        },
    )
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "RESOLVED"

    # Verify timeline updated with resolution
    timeline_resp = await async_client.get(f"/api/v1/complaints/{cid}/timeline")
    assert timeline_resp.status_code == 200
    events = timeline_resp.json()
    assert any(e["event_type"] == "RESOLVED" for e in events)

    # Reopen complaint
    reopen_resp = await async_client.post(
        f"/api/v1/complaints/{cid}/reopen",
        json={"reason": "Door still jamming intermittently during peak load.", "actor_name": "Prof. Rao"},
    )
    assert reopen_resp.status_code == 200
    assert reopen_resp.json()["status"] == "REOPENED"


@pytest.mark.asyncio
async def test_get_complaint_decision_by_id(async_client: AsyncClient):
    """Test retrieving existing decision report by complaint ID."""
    create_resp = await async_client.post(
        "/api/v1/complaints",
        json={"raw_complaint": "Classroom 104 projector lamp is flickering violently and turns off after 5 minutes."},
    )
    assert create_resp.status_code == 200
    complaint_id = create_resp.json()["complaint_id"]

    get_resp = await async_client.get(f"/api/v1/complaints/{complaint_id}/decision")
    assert get_resp.status_code == 200
    decision_data = get_resp.json()
    assert decision_data["complaint_id"] == complaint_id
    assert "Projector" in decision_data["analysis"]["equipment_type"]
