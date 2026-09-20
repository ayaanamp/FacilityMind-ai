"""Test suite for Dynamic Organization Profile, First-Run Onboarding, and Equipment Inventory."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_organization_status_fresh_install(async_client: AsyncClient):
    """Test /api/v1/organization/status returns clean status on fresh install."""
    response = await async_client.get("/api/v1/organization/status")
    assert response.status_code == 200
    data = response.json()
    assert "setup_completed" in data
    assert "suggested_categories" in data
    assert "stats" in data


@pytest.mark.asyncio
async def test_suggested_categories_endpoint(async_client: AsyncClient):
    """Test /api/v1/organization/suggested-categories/{org_type} returns domain specific categories."""
    response = await async_client.get("/api/v1/organization/suggested-categories/Hospital%20%2F%20Healthcare")
    assert response.status_code == 200
    data = response.json()
    assert "suggested_categories" in data
    categories = data["suggested_categories"]
    assert isinstance(categories, list)
    assert len(categories) > 0
    assert any("Oxygen" in c or "Medical" in c or "ICU" in c for c in categories)


@pytest.mark.asyncio
async def test_organization_setup_and_settings(async_client: AsyncClient):
    """Test full setup flow and retrieval of updated organization settings."""
    setup_payload = {
        "admin_name": "Dr. Sarah Jenkins",
        "admin_username": "admin_sarah",
        "admin_password": "SecurePassword123!",
        "admin_email": "sarah.jenkins@hospital.org",
        "admin_role": "Chief Operations Officer",
        "admin_phone": "+91 98765 12345",
        "organization_name": "St. Jude Healthcare & Research Institute",
        "org_type": "Hospital / Healthcare",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "primary_location": "Main Medical Block",
        "buildings_count": 4,
        "floors_count": 8,
        "approx_users_count": 1500,
        "operating_hours": "24/7 Operations",
        "categories": ["Medical Gas & Oxygen Pipeline", "Patient Wards & ICU Rooms", "Cleanroom HVAC & HEPA Filtration"],
        "load_demo_data": False,
    }

    response = await async_client.post("/api/v1/organization/setup", json=setup_payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["name"] == "St. Jude Healthcare & Research Institute"
    assert res_data["setup_completed"] is True

    # Check status endpoint reflects setup completion
    status_res = await async_client.get("/api/v1/organization/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["setup_completed"] is True
    assert status_data["organization"]["name"] == "St. Jude Healthcare & Research Institute"

    # Check settings endpoint
    settings_res = await async_client.get("/api/v1/organization/settings")
    assert settings_res.status_code == 200
    settings_data = settings_res.json()
    assert settings_data["admin_name"] == "Dr. Sarah Jenkins"
    assert settings_data["org_type"] == "Hospital / Healthcare"


@pytest.mark.asyncio
async def test_equipment_crud_and_csv_import(async_client: AsyncClient):
    """Test creating, listing, CSV importing, and deleting equipment inventory."""
    # 1. Create asset
    item_payload = {
        "equipment_name": "Central Chiller Unit 1",
        "equipment_type": "Central Chiller HVAC",
        "equipment_id": "CH-01",
        "location": "Utility Plant Basement",
        "building": "Service Tower",
        "floor": "B1",
        "status": "Operational",
        "criticality": "Critical",
    }
    create_res = await async_client.post("/api/v1/organization/equipment", json=item_payload)
    assert create_res.status_code == 200
    item = create_res.json()
    assert item["equipment_id"] == "CH-01"
    item_id = item["id"]

    # 2. List equipment
    list_res = await async_client.get("/api/v1/organization/equipment")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert any(i["equipment_id"] == "CH-01" for i in items)

    # 3. Import CSV
    csv_payload = {
        "csv_content": "equipment_name,equipment_type,equipment_id,location,status,criticality\nOxygen Booster 1,Medical Gas,O2-01,ICU Ward 3,Operational,Critical\nLift 4,Elevator,LIFT-04,Block B,Degraded,High",
    }
    csv_res = await async_client.post("/api/v1/organization/equipment/import-csv", json=csv_payload)
    assert csv_res.status_code == 200
    csv_data = csv_res.json()
    assert csv_data["imported_count"] == 2

    # 4. Delete equipment
    del_res = await async_client.delete(f"/api/v1/organization/equipment/{item_id}")
    assert del_res.status_code == 200
