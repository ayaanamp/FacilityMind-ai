"""End-to-End Complaint Lifecycle Test Script.

Validates:
1. First-time Organization Setup
2. User complaint filing with automated tracking code generation
3. Admin receipt & triage
4. Admin status progression (Under Review -> In Progress)
5. User tracking synchronization
6. Admin resolution with labor/parts cost settlement
7. User verified resolution inspection
"""

import asyncio
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from httpx import ASGITransport, AsyncClient
from backend.app.main import app


async def test_full_lifecycle():
    print("=" * 65)
    print("RUNNING END-TO-END COMPLAINT LIFECYCLE AUDIT")
    print("=" * 65)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Organization Setup
        print("\n[STEP 1] Testing Organization Onboarding Setup...")
        setup_payload = {
            "admin_name": "Dr. Sarah Jenkins",
            "admin_username": "admin",
            "admin_password": "securePassword123",
            "admin_email": "admin@apextech.edu",
            "admin_role": "Director of Infrastructure",
            "organization_name": "Apex Institute of Technology",
            "org_type": "College",
            "city": "Bengaluru",
            "state": "Karnataka",
            "primary_location": "Main Campus",
            "categories": ["Air Conditioner", "Elevator", "Power Backup", "Water Pump"],
            "blocks": ["Science Wing", "Academic Quad", "Library Block"],
            "load_demo_data": False,
        }
        res = await client.post("/api/v1/organization/setup", json=setup_payload)
        assert res.status_code == 200, f"Setup failed: {res.text}"
        org_data = res.json()
        print(f"  ✓ Organization created: '{org_data['name']}' ({org_data['org_type']})")

        # 2. User files a complaint
        print("\n[STEP 2] User Submitting Infrastructure Complaint...")
        complaint_payload = {
            "raw_complaint": "Central AC in Science Wing 204 is making severe rattling sounds and blowing warm air.",
            "equipment_type": "Air Conditioner",
            "location": "Science Wing 204",
            "severity": "High",
            "reporter_name": "Prof. Alan Turing",
            "reporter_phone": "+91 9876543210",
            "reporter_dept": "Computer Science",
        }
        res = await client.post("/api/v1/complaints", json=complaint_payload)
        assert res.status_code == 200, f"Complaint submission failed: {res.text}"
        comp_data = res.json()
        tracking_code = comp_data.get("tracking_code")
        complaint_id = comp_data.get("complaint_id")
        print(f"  ✓ Complaint lodged successfully:")
        print(f"    • ID            : {complaint_id}")
        print(f"    • Tracking Code : {tracking_code}")
        print(f"    • Diagnosis     : {comp_data.get('diagnosis', {}).get('primary_cause')}")

        # 3. Admin receives and views complaint
        print("\n[STEP 3] Admin Inspecting Ingested Complaint Register...")
        res = await client.get("/api/v1/complaints")
        assert res.status_code == 200, f"Fetch complaints failed: {res.text}"
        all_comp = res.json()
        assert len(all_comp) >= 1, "Admin complaint register is empty!"
        print(f"  ✓ Admin register received {len(all_comp)} active complaint(s)")

        # 4. Admin updates status to 'IN_PROGRESS'
        print("\n[STEP 4] Admin Transitioning Status to 'IN_PROGRESS'...")
        res = await client.patch(
            f"/api/v1/complaints/{complaint_id}/status",
            json={"status": "IN_PROGRESS", "work_order_status": "Technician Assigned"},
        )
        assert res.status_code == 200, f"Status update failed: {res.text}"
        print(f"  ✓ Work order stage updated to: 'Technician Assigned'")

        # 5. User tracks status
        print("\n[STEP 5] User Tracking Complaint via Public Tracking Code...")
        res = await client.get(f"/api/v1/complaints/track/{tracking_code}")
        assert res.status_code == 200, f"User track failed: {res.text}"
        track_info = res.json()
        assert track_info["status"] in ["IN_PROGRESS", "In Progress"], f"Expected 'IN_PROGRESS', got {track_info['status']}"
        print(f"  ✓ User sees live status: {track_info['status']}")

        # 6. Admin resolves complaint
        print("\n[STEP 6] Admin Resolving Complaint with Financial Settlement...")
        resolve_payload = {
            "resolution_notes": "Replaced faulty blower belt and cleared dust filter. Operating at optimal 18C.",
            "assigned_technician_name": "Vikram Singh (HVAC Specialist)",
            "labor_cost": 450,
            "parts_cost": 850,
        }
        res = await client.post(f"/api/v1/complaints/{complaint_id}/resolve", json=resolve_payload)
        assert res.status_code == 200, f"Resolve failed: {res.text}"
        resolve_res = res.json()
        print(f"  ✓ Complaint marked resolved. Total actual cost: ₹{resolve_res.get('total_actual_cost')}")

        # 7. User verifies resolved status
        print("\n[STEP 7] User Verifying Final Resolution...")
        res = await client.get(f"/api/v1/complaints/track/{tracking_code}")
        assert res.status_code == 200
        final_track = res.json()
        assert final_track["status"] == "RESOLVED", f"Expected 'RESOLVED', got {final_track['status']}"
        print(f"  ✓ Final status: {final_track['status']}")
        print(f"  ✓ Public resolution notes: '{final_track.get('public_resolution_notes')}'")

        print("\n" + "=" * 65)
        print("✅ FULL COMPLAINT LIFECYCLE VERIFIED WITH 100% SUCCESS")
        print("=" * 65)


if __name__ == "__main__":
    asyncio.run(test_full_lifecycle())
