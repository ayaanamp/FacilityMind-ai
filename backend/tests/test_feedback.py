"""Test suite for Technician Feedback Loop (Key Feature 7)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_technician_feedback_loop_appends_to_kb(async_client: AsyncClient):
    """Test approving/correcting diagnosis and appending confirmed case to knowledge base."""
    # 1. Create a complaint
    comp_resp = await async_client.post(
        "/api/v1/complaints",
        json={
            "raw_complaint": "Diesel Generator fails to crank or start during grid power failure.",
            "location": "Power Substation Yard",
        },
    )
    assert comp_resp.status_code == 200
    complaint_id = comp_resp.json()["complaint_id"]

    # 2. Submit technician feedback (approval with notes)
    fb_payload = {
        "complaint_id": complaint_id,
        "accepted": True,
        "technician_name": "Chief Electrical Engineer Patel",
        "technician_feedback": "Verified starter battery charger failure on site and replaced 24V float charger.",
        "actual_cost": 5200,
    }

    fb_resp = await async_client.post("/api/v1/feedback", json=fb_payload)
    assert fb_resp.status_code == 200
    fb_data = fb_resp.json()
    assert fb_data["accepted"] is True
    assert fb_data["appended_to_kb"] is True
    assert fb_data["new_knowledge_record_id"] is not None

    # 3. Verify complaint status updated
    decision_resp = await async_client.get(f"/api/v1/complaints/{complaint_id}/decision")
    assert decision_resp.status_code == 200
    dec = decision_resp.json()
    assert dec["human_verified"] is True
    assert dec["status"] == "Verified & Closed"
    assert dec["technician_feedback"]["technician_name"] == "Chief Electrical Engineer Patel"
