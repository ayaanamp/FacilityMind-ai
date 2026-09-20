"""Test suite for Admin Authentication, Session Token Validation, and Dynamic Analytics."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_auth_and_session(async_client: AsyncClient):
    """Test full setup, admin login, me endpoint, and logout."""
    # 1. Setup organization with admin credentials
    setup_payload = {
        "admin_name": "Chief Engineer Robert",
        "admin_username": "chief_robert",
        "admin_password": "SuperSecretPassword123!",
        "admin_email": "robert@campus.edu",
        "admin_role": "Chief Engineer",
        "admin_phone": "+91 99887 76655",
        "organization_name": "Apex Engineering Institute",
        "org_type": "University / College Campus",
        "country": "India",
        "state": "Maharashtra",
        "city": "Pune",
        "primary_location": "Main Campus Quad",
        "buildings_count": 5,
        "floors_count": 6,
        "approx_users_count": 2500,
        "operating_hours": "08:00 AM - 10:00 PM",
        "categories": ["HVAC", "Electrical", "Smart Classrooms", "Plumbing"],
        "blocks": ["Block A (Academic)", "Block B (Engineering Labs)", "Admin Tower"],
        "load_demo_data": False,
    }
    setup_res = await async_client.post("/api/v1/organization/setup", json=setup_payload)
    assert setup_res.status_code == 200

    # 2. Try login with wrong password
    bad_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "chief_robert", "password": "WrongPassword"},
    )
    assert bad_login.status_code == 401

    # 3. Login with correct credentials
    good_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "chief_robert", "password": "SuperSecretPassword123!"},
    )
    assert good_login.status_code == 200
    login_data = good_login.json()
    assert "access_token" in login_data
    token = login_data["access_token"]
    assert login_data["user"]["username"] == "chief_robert"

    # 4. Access /auth/me with Bearer token
    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["username"] == "chief_robert"
    assert me_data["full_name"] == "Chief Engineer Robert"

    # 5. Logout
    logout_res = await async_client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True


@pytest.mark.asyncio
async def test_analytics_endpoint(async_client: AsyncClient):
    """Test /api/v1/analytics endpoint returns real structured stats."""
    res = await async_client.get("/api/v1/analytics")
    assert res.status_code == 200
    data = res.json()
    assert "total_complaints" in data
    assert "total_spend_inr" in data
    assert "pending_estimated_spend_inr" in data
    assert "category_spending" in data
    assert "location_metrics" in data
    assert "monthly_spending" in data
    assert "worker_workloads" in data
