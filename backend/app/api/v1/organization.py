"""Organization profile, onboarding setup, equipment inventory, and workspace lifecycle API."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any

import httpx
from backend.app.core.auth import hash_password
from backend.app.core.config import get_settings
from backend.app.core.logging import logging
from backend.app.database.session import get_db
from backend.app.models.maintenance import (
    AdminUser,
    AgentRun,
    Complaint,
    Diagnosis,
    Equipment,
    MaintenanceRecord,
    Organization,
    Recommendation,
    TechnicianFeedback,
    TechnicianStaff,
)
from backend.app.rag.indexing import seed_database_and_index
from backend.app.rag.vector_store import vector_store
from backend.app.schemas.organization import (
    AdminCredentialsUpdateRequest,
    ApiKeyVerifyRequest,
    ApiKeyVerifyResponse,
    EquipmentCreate,
    EquipmentCsvImportRequest,
    EquipmentOut,
    OrganizationOut,
    OrganizationPublicOut,
    OrganizationSetupRequest,
    OrganizationStatusResponse,
    OrganizationUpdateRequest,
    WorkspaceStats,
)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("FacilityMind.OrganizationAPI")
settings = get_settings()

router = APIRouter(prefix="/organization", tags=["Organization & Onboarding"])

# Curated infrastructure category intelligence by facility domain
SUGGESTED_CATEGORIES_BY_TYPE: dict[str, list[str]] = {
    "School": [
        "Classrooms & Smart Boards",
        "Science & Computer Labs",
        "Library & Study Halls",
        "Administration & Staff Rooms",
        "Auditorium & Stage Lights",
        "Sports Facilities & Gymnasium",
        "Electrical & Power Distribution",
        "HVAC / Air Conditioning",
        "Drinking Water & RO Plants",
        "CCTV & Campus Security",
        "Networking & Wi-Fi Access Points",
        "Classroom Projectors & Displays",
        "Washrooms & Sanitary Plumbing",
        "Fire Safety & Extinguishers",
    ],
    "College": [
        "Academic Lecture Halls",
        "Research & Engineering Labs",
        "Central Library & Archives",
        "Student Hostels & Dormitories",
        "Cafeteria & Dining Hall",
        "Auditorium & Convention Center",
        "Server Room & IT Infrastructure",
        "Diesel Generator & Backup Power",
        "Passenger & Service Elevators",
        "HVAC / Central Chiller Plants",
        "High-Capacity Water Pumps",
        "CCTV Surveillance & Security Gates",
        "Three-Phase Electrical Panels",
        "Classroom AV & Projectors",
        "Fire Hydrants & Safety Systems",
        "Campus Lighting & Solar Grid",
    ],
    "University": [
        "Academic Lecture Halls",
        "Research & Engineering Labs",
        "Central Library & Archives",
        "Student Hostels & Dormitories",
        "Faculty Residences",
        "Cafeteria & Dining Hall",
        "Auditorium & Convention Center",
        "Server Room & IT Infrastructure",
        "Diesel Generator & Backup Power",
        "Passenger & Service Elevators",
        "HVAC / Central Chiller Plants",
        "High-Capacity Water Pumps",
        "CCTV Surveillance & Security Gates",
        "Three-Phase Electrical Panels",
        "Classroom AV & Projectors",
        "Fire Hydrants & Safety Systems",
        "Campus Lighting & Solar Grid",
    ],
    "IT Company": [
        "Workstations & Open Office",
        "Conference & Meeting Rooms",
        "Server Room & Network Racks",
        "HVAC / VRF Air Conditioning",
        "Access Control & Biometric Turnstiles",
        "Pantry & Cafeteria Equipment",
        "Restrooms & Sanitary Plumbing",
        "Online UPS & Battery Banks",
        "Backup Diesel Generator",
        "Passenger Elevators",
        "Printers & Multi-Function Scanners",
        "Fire Alarms & Emergency Sprinklers",
        "Executive Boardroom AV & Projectors",
    ],
    "Corporate Office": [
        "Workstations & Open Office",
        "Conference & Meeting Rooms",
        "Server Room & Network Racks",
        "HVAC / VRF Air Conditioning",
        "Access Control & Biometric Turnstiles",
        "Pantry & Cafeteria Equipment",
        "Restrooms & Sanitary Plumbing",
        "Online UPS & Battery Banks",
        "Backup Diesel Generator",
        "Passenger Elevators",
        "Printers & Multi-Function Scanners",
        "Fire Alarms & Emergency Sprinklers",
        "Executive Boardroom AV & Projectors",
    ],
    "Hospital": [
        "Patient Wards & ICU Rooms",
        "Operation Theatres & Surgical Suites",
        "Diagnostic & Imaging Labs (X-Ray/MRI)",
        "Emergency Room & Triage Area",
        "Pharmacy & Cold Storage Chillers",
        "Central Medical Gas & Oxygen Pipeline",
        "Cleanroom HVAC & HEPA Filtration",
        "Emergency Dual DG Backup & UPS",
        "Stretcher & Bed Elevators",
        "RO Water & Dialysis Supply",
        "Biomedical Waste Treatment",
        "Access Control & CCTV Security",
        "Fire & Smoke Evacuation Systems",
    ],
    "Hotel": [
        "Guest Rooms & Suites",
        "Lobby & Reception Area",
        "Commercial Kitchen & Cold Rooms",
        "Restaurant & Banquet Halls",
        "Guest & Service Elevators",
        "Central Chiller & HVAC Units",
        "Boilers & Hot Water Supply",
        "Swimming Pool & Filtration",
        "Laundry & Dry Cleaning Equipment",
        "Backup Diesel Generator",
        "Audio-Visual & Event Systems",
        "Parking & Security Gates",
    ],
    "Factory": [
        "Production Lines & Assembly Machinery",
        "Heavy Electric Motors & VFD Drives",
        "Air Compressors & Pneumatic Lines",
        "Industrial Diesel Generators",
        "Three-Phase Substations & Panels",
        "Overhead Cranes & Hoists",
        "Industrial Exhaust & Ventilation",
        "Cooling Towers & Water Circulation",
        "Raw Material & Finished Goods Warehouse",
        "Loading Docks & Forklift Bays",
        "Fire Suppression & Hazmat Safety",
        "Effluent Treatment Plant (ETP)",
    ],
    "Manufacturing": [
        "Production Lines & Assembly Machinery",
        "Heavy Electric Motors & VFD Drives",
        "Air Compressors & Pneumatic Lines",
        "Industrial Diesel Generators",
        "Three-Phase Substations & Panels",
        "Overhead Cranes & Hoists",
        "Industrial Exhaust & Ventilation",
        "Cooling Towers & Water Circulation",
        "Raw Material & Finished Goods Warehouse",
        "Loading Docks & Forklift Bays",
        "Fire Suppression & Hazmat Safety",
        "Effluent Treatment Plant (ETP)",
    ],
    "Warehouse": [
        "High-Bay Storage & Racking",
        "Loading Docks & Hydraulic Levelers",
        "Forklift Battery Charging Stations",
        "HVLS Industrial Ceiling Fans",
        "Security CCTV & Perimeter Gates",
        "Backup Generator & High-Mast Lights",
        "Fire Sprinklers & Smoke Beams",
        "Conveyors & Sorting Belts",
        "Restrooms & Driver Lounges",
    ],
    "Government Organization": [
        "Public Service Counters & Waiting Area",
        "Administrative Chambers & Courtrooms",
        "Records & Document Vault",
        "Central HVAC & Air Filtration",
        "Security Checkpoints & Baggage Scanners",
        "Public Elevators & Escalators",
        "Electrical Distribution & UPS",
        "Drinking Water Stations & Restrooms",
        "Emergency Diesel Generator",
        "Public Address & Sound Systems",
    ],
    "Retail": [
        "Retail Sales Floor & Display Lighting",
        "POS Terminals & Cash Registers",
        "HVAC & Temperature Control",
        "Customer Elevators & Escalators",
        "Customer Restrooms & Plumbing",
        "Stockroom & Inventory Racks",
        "Security CCTV & Anti-Theft Gates",
        "Backup Generator & Signage Lighting",
    ],
    "Apartment / Residential": [
        "Passenger Lifts & Elevators",
        "Hydro-Pneumatic Water Booster Pumps",
        "Common Area Lighting & Solar Panels",
        "DG Power Backup for Residences",
        "Swimming Pool & Filtration Plant",
        "Clubhouse & Gym Equipment",
        "Sewage Treatment Plant (STP)",
        "Automated Boom Barriers & Security",
        "Fire Hydrants & Hose Reels",
    ],
    "Other": [
        "General Facility Infrastructure",
        "Electrical & Power Distribution",
        "HVAC & Climate Control",
        "Water & Plumbing Systems",
        "Security & Access Control",
        "IT & Network Infrastructure",
        "Elevators & Vertical Transport",
        "Fire Safety & Emergency Equipment",
    ],
}


def _org_to_out(org: Organization) -> OrganizationOut:
    """Helper to convert ORM Organization to Pydantic schema."""
    cats = []
    blocks = []
    if org.categories_json:
        try:
            cats = json.loads(org.categories_json)
        except Exception:
            cats = []
    if hasattr(org, "blocks_json") and org.blocks_json:
        try:
            blocks = json.loads(org.blocks_json)
        except Exception:
            blocks = []

    return OrganizationOut(
        id=org.id,
        name=org.name,
        org_type=org.org_type,
        custom_org_type=org.custom_org_type,
        country=org.country,
        state=org.state,
        city=org.city,
        primary_location=org.primary_location,
        admin_name=org.admin_name,
        admin_email=org.admin_email,
        admin_role=org.admin_role,
        admin_phone=org.admin_phone,
        buildings_count=org.buildings_count,
        floors_count=org.floors_count,
        approx_users_count=org.approx_users_count,
        operating_hours=org.operating_hours,
        categories=cats,
        blocks=blocks,
        gemini_api_key_configured=org.gemini_api_key_configured or bool(settings.GEMINI_API_KEY),
        setup_completed=org.setup_completed,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


@router.get("/status", response_model=OrganizationStatusResponse)
async def get_organization_status(db: AsyncSession = Depends(get_db)) -> OrganizationStatusResponse:
    """Check whether the platform has been initialized by an organization."""
    org_res = await db.execute(select(Organization).order_by(Organization.id.desc()).limit(1))
    org = org_res.scalar_one_or_none()

    # Query counts
    complaints_count_res = await db.execute(select(func.count(Complaint.id)))
    complaints_count = complaints_count_res.scalar() or 0

    active_res = await db.execute(
        select(func.count(Complaint.id)).where(Complaint.status.not_in(["RESOLVED", "CLOSED", "Resolved"]))
    )
    active_count = active_res.scalar() or 0

    resolved_count = complaints_count - active_count

    eq_count_res = await db.execute(select(func.count(Equipment.id)))
    eq_count = eq_count_res.scalar() or 0

    rec_count_res = await db.execute(select(func.count(MaintenanceRecord.id)))
    rec_count = rec_count_res.scalar() or 0

    tech_count_res = await db.execute(select(func.count(TechnicianStaff.id)))
    tech_count = tech_count_res.scalar() or 0

    stats = WorkspaceStats(
        complaints_count=complaints_count,
        active_complaints_count=active_count,
        resolved_complaints_count=resolved_count,
        equipment_count=eq_count,
        maintenance_records_count=rec_count,
        technicians_count=tech_count,
    )

    if not org or not org.setup_completed:
        return OrganizationStatusResponse(
            setup_completed=False,
            is_fresh_install=True,
            organization=None,
            stats=stats,
            suggested_categories=SUGGESTED_CATEGORIES_BY_TYPE.get("College", []),
        )

    org_out = _org_to_out(org)
    suggested = SUGGESTED_CATEGORIES_BY_TYPE.get(org.org_type, SUGGESTED_CATEGORIES_BY_TYPE["Other"])

    return OrganizationStatusResponse(
        setup_completed=True,
        is_fresh_install=False,
        organization=org_out,
        stats=stats,
        suggested_categories=suggested,
    )


@router.get("/public", response_model=OrganizationPublicOut)
async def get_public_organization_profile(
    db: AsyncSession = Depends(get_db),
) -> OrganizationPublicOut:
    """Return public organization parameters for the User Portal (No admin secrets or API keys)."""
    org_res = await db.execute(select(Organization).order_by(Organization.id.desc()).limit(1))
    org = org_res.scalar_one_or_none()

    if not org:
        return OrganizationPublicOut(
            name="Facility Operations",
            org_type="Facility",
            primary_location="Main Campus",
            operating_hours="24/7 Operations",
            categories=SUGGESTED_CATEGORIES_BY_TYPE["Other"],
            blocks=["Main Block", "Academic Wing", "West Wing"],
            emergency_phone="+91 (080) 4122-3900",
            setup_completed=False,
        )

    cats = []
    blocks = []
    if org.categories_json:
        try:
            cats = json.loads(org.categories_json)
        except Exception:
            cats = []
    if hasattr(org, "blocks_json") and org.blocks_json:
        try:
            blocks = json.loads(org.blocks_json)
        except Exception:
            blocks = []
    if not blocks:
        blocks = ["Main Block", "Academic Wing", "West Wing", "Block A", "Block B"]

    return OrganizationPublicOut(
        name=org.name,
        org_type=org.org_type,
        primary_location=org.primary_location or "Main Campus",
        operating_hours=org.operating_hours or "24/7 Operations",
        categories=cats or SUGGESTED_CATEGORIES_BY_TYPE["Other"],
        blocks=blocks,
        emergency_phone=org.admin_phone or "+91 (080) 4122-3900",
        setup_completed=org.setup_completed,
    )


@router.get("/suggested-categories/{org_type:path}")
async def get_suggested_categories(org_type: str) -> dict[str, Any]:
    """Return intelligent category recommendations for a specific organization type."""
    normalized_query = org_type.strip().lower()

    # Match against dictionary
    matched_cats = None
    for key, val in SUGGESTED_CATEGORIES_BY_TYPE.items():
        if key.lower() == normalized_query or key.lower() in normalized_query or normalized_query in key.lower():
            matched_cats = val
            break

    if not matched_cats:
        matched_cats = SUGGESTED_CATEGORIES_BY_TYPE.get("Other", [])

    return {
        "org_type": org_type,
        "suggested_categories": matched_cats,
    }


@router.post("/setup", response_model=OrganizationOut)
async def setup_organization(
    payload: OrganizationSetupRequest,
    db: AsyncSession = Depends(get_db),
) -> OrganizationOut:
    """Initialize clean organization profile and create administrator credentials."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Categories setup
    categories = payload.categories
    if not categories:
        categories = SUGGESTED_CATEGORIES_BY_TYPE.get(payload.org_type, SUGGESTED_CATEGORIES_BY_TYPE["Other"])

    blocks = payload.blocks or ["Main Block", "Academic Wing", "Science Block"]

    has_api_key = bool(payload.gemini_api_key and len(payload.gemini_api_key.strip()) > 10)
    if has_api_key:
        settings.GEMINI_API_KEY = payload.gemini_api_key.strip()

    # 1. Update or create Organization record
    org_res = await db.execute(select(Organization).order_by(Organization.id.desc()).limit(1))
    org = org_res.scalar_one_or_none()

    if org:
        org.name = payload.organization_name
        org.org_type = payload.org_type
        org.custom_org_type = payload.custom_org_type
        org.country = payload.country
        org.state = payload.state
        org.city = payload.city
        org.primary_location = payload.primary_location
        org.admin_name = payload.admin_name
        org.admin_email = payload.admin_email or ""
        org.admin_role = payload.admin_role
        org.admin_phone = payload.admin_phone or ""
        org.buildings_count = payload.buildings_count
        org.floors_count = payload.floors_count
        org.approx_users_count = payload.approx_users_count
        org.operating_hours = payload.operating_hours
        org.categories_json = json.dumps(categories, ensure_ascii=False)
        org.blocks_json = json.dumps(blocks, ensure_ascii=False)
        org.gemini_api_key_configured = has_api_key or bool(settings.GEMINI_API_KEY)
        org.setup_completed = True
        org.updated_at = now_str
    else:
        org = Organization(
            name=payload.organization_name,
            org_type=payload.org_type,
            custom_org_type=payload.custom_org_type,
            country=payload.country,
            state=payload.state,
            city=payload.city,
            primary_location=payload.primary_location,
            admin_name=payload.admin_name,
            admin_email=payload.admin_email or "",
            admin_role=payload.admin_role,
            admin_phone=payload.admin_phone or "",
            buildings_count=payload.buildings_count,
            floors_count=payload.floors_count,
            approx_users_count=payload.approx_users_count,
            operating_hours=payload.operating_hours,
            categories_json=json.dumps(categories, ensure_ascii=False),
            blocks_json=json.dumps(blocks, ensure_ascii=False),
            gemini_api_key_configured=has_api_key or bool(settings.GEMINI_API_KEY),
            setup_completed=True,
            created_at=now_str,
            updated_at=now_str,
        )
        db.add(org)

    await db.commit()
    await db.refresh(org)

    # 2. Create or update AdminUser credentials
    admin_uname = payload.admin_username.strip()
    admin_stmt = select(AdminUser).order_by(AdminUser.id.asc()).limit(1)
    admin_res = await db.execute(admin_stmt)
    admin_user = admin_res.scalar_one_or_none()

    pw_hash, pw_salt = hash_password(payload.admin_password)

    if admin_user:
        admin_user.username = admin_uname
        admin_user.password_hash = pw_hash
        admin_user.salt = pw_salt
        admin_user.full_name = payload.admin_name
        admin_user.email = payload.admin_email or ""
        admin_user.phone = payload.admin_phone or ""
        admin_user.role = payload.admin_role or "Facility Manager"
        admin_user.organization_id = org.id
    else:
        admin_user = AdminUser(
            username=admin_uname,
            password_hash=pw_hash,
            salt=pw_salt,
            full_name=payload.admin_name,
            email=payload.admin_email or "",
            phone=payload.admin_phone or "",
            role=payload.admin_role or "Facility Manager",
            organization_id=org.id,
            created_at=now_str,
        )
        db.add(admin_user)

    await db.flush()

    # Clean up duplicate AdminUser records if any exist
    if admin_user and admin_user.id:
        dup_stmt = select(AdminUser).where(AdminUser.id != admin_user.id)
        dup_res = await db.execute(dup_stmt)
        for dup in dup_res.scalars().all():
            await db.delete(dup)

    await db.commit()

    # If demo data is explicitly requested, seed records
    if payload.load_demo_data:
        await seed_database_and_index(db)
    else:
        # Normal clean mode: ensure vector index is initialized cleanly
        vector_store.save()

    logger.info(f"Organization '{org.name}' ({org.org_type}) and Admin '{admin_uname}' created successfully.")
    return _org_to_out(org)


@router.get("/settings", response_model=OrganizationOut)
async def get_organization_settings(db: AsyncSession = Depends(get_db)) -> OrganizationOut:
    """Get current organization configuration."""
    org_res = await db.execute(select(Organization).order_by(Organization.id.desc()).limit(1))
    org = org_res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="No organization configured yet. Please complete onboarding.")
    return _org_to_out(org)


@router.put("/settings", response_model=OrganizationOut)
async def update_organization_settings(
    payload: OrganizationUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> OrganizationOut:
    """Update organization settings, categories, and administrator details."""
    org_res = await db.execute(select(Organization).order_by(Organization.id.desc()).limit(1))
    org = org_res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="No organization found to update.")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if payload.name is not None:
        org.name = payload.name
    if payload.org_type is not None:
        org.org_type = payload.org_type
    if payload.custom_org_type is not None:
        org.custom_org_type = payload.custom_org_type
    if payload.country is not None:
        org.country = payload.country
    if payload.state is not None:
        org.state = payload.state
    if payload.city is not None:
        org.city = payload.city
    if payload.primary_location is not None:
        org.primary_location = payload.primary_location
    if payload.admin_name is not None:
        org.admin_name = payload.admin_name
    if payload.admin_email is not None:
        org.admin_email = payload.admin_email
    if payload.admin_role is not None:
        org.admin_role = payload.admin_role
    if payload.admin_phone is not None:
        org.admin_phone = payload.admin_phone
    if payload.buildings_count is not None:
        org.buildings_count = payload.buildings_count
    if payload.floors_count is not None:
        org.floors_count = payload.floors_count
    if payload.approx_users_count is not None:
        org.approx_users_count = payload.approx_users_count
    if payload.operating_hours is not None:
        org.operating_hours = payload.operating_hours
    if payload.categories is not None:
        org.categories_json = json.dumps(payload.categories, ensure_ascii=False)
    if payload.blocks is not None:
        org.blocks_json = json.dumps(payload.blocks, ensure_ascii=False)
    if payload.gemini_api_key and len(payload.gemini_api_key.strip()) > 10:
        settings.GEMINI_API_KEY = payload.gemini_api_key.strip()
        org.gemini_api_key_configured = True
    org.updated_at = now_str

    # Sync AdminUser record
    admin_stmt = select(AdminUser).order_by(AdminUser.id.asc()).limit(1)
    admin_res = await db.execute(admin_stmt)
    admin_user = admin_res.scalar_one_or_none()

    if admin_user:
        if payload.admin_name is not None:
            admin_user.full_name = payload.admin_name
        if payload.admin_email is not None:
            admin_user.email = payload.admin_email
        if payload.admin_phone is not None:
            admin_user.phone = payload.admin_phone
        if payload.admin_role is not None:
            admin_user.role = payload.admin_role
        if payload.admin_username and payload.admin_username.strip():
            admin_user.username = payload.admin_username.strip()
        if payload.admin_password and len(payload.admin_password.strip()) >= 3:
            pw_hash, pw_salt = hash_password(payload.admin_password.strip())
            admin_user.password_hash = pw_hash
            admin_user.salt = pw_salt
    else:
        uname = payload.admin_username.strip() if payload.admin_username else "admin"
        pword = payload.admin_password.strip() if payload.admin_password else "admin"
        pw_hash, pw_salt = hash_password(pword)
        new_admin = AdminUser(
            username=uname,
            password_hash=pw_hash,
            salt=pw_salt,
            full_name=payload.admin_name or "Administrator",
            email=payload.admin_email or "",
            phone=payload.admin_phone or "",
            role=payload.admin_role or "Facility Manager",
            organization_id=org.id,
            created_at=now_str,
        )
        db.add(new_admin)

    await db.commit()
    await db.refresh(org)
    logger.info(f"Organization settings updated for '{org.name}'.")
    return _org_to_out(org)


@router.put("/admin-credentials")
async def update_admin_credentials(
    payload: AdminCredentialsUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Update admin username, full name, and password with PBKDF2 hashing."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Update Organization admin_name if present
    org_res = await db.execute(select(Organization).order_by(Organization.id.desc()).limit(1))
    org = org_res.scalar_one_or_none()
    if org and payload.admin_name:
        org.admin_name = payload.admin_name.strip()
        org.updated_at = now_str

    # Update or create AdminUser
    admin_stmt = select(AdminUser).order_by(AdminUser.id.asc()).limit(1)
    admin_res = await db.execute(admin_stmt)
    admin_user = admin_res.scalar_one_or_none()

    new_username = payload.admin_username.strip()
    new_name = payload.admin_name.strip()

    if admin_user:
        admin_user.username = new_username
        admin_user.full_name = new_name
        if payload.admin_password and len(payload.admin_password.strip()) >= 3:
            pw_hash, pw_salt = hash_password(payload.admin_password.strip())
            admin_user.password_hash = pw_hash
            admin_user.salt = pw_salt
    else:
        pw = payload.admin_password.strip() if payload.admin_password else "admin"
        pw_hash, pw_salt = hash_password(pw)
        admin_user = AdminUser(
            username=new_username,
            password_hash=pw_hash,
            salt=pw_salt,
            full_name=new_name,
            role="Facility Administrator",
            organization_id=org.id if org else None,
            created_at=now_str,
        )
        db.add(admin_user)

    await db.flush()

    # Clean up duplicate AdminUser records if any exist
    if admin_user and admin_user.id:
        dup_stmt = select(AdminUser).where(AdminUser.id != admin_user.id)
        dup_res = await db.execute(dup_stmt)
        for dup in dup_res.scalars().all():
            await db.delete(dup)

    await db.commit()
    return {
        "success": True,
        "message": "Admin credentials updated successfully.",
        "admin_name": new_name,
        "admin_username": new_username,
    }


@router.post("/verify-key", response_model=ApiKeyVerifyResponse)
async def verify_gemini_api_key(payload: ApiKeyVerifyRequest) -> ApiKeyVerifyResponse:
    """Test validity of a Gemini API key without printing or storing secret."""
    key = payload.api_key.strip()
    if not key or len(key) < 15:
        return ApiKeyVerifyResponse(valid=False, message="Invalid API key format.")

    test_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    test_payload = {
        "contents": [{"role": "user", "parts": [{"text": "Hello"}]}],
        "generationConfig": {"maxOutputTokens": 3},
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(test_url, json=test_payload)
            if resp.status_code == 200:
                return ApiKeyVerifyResponse(
                    valid=True,
                    message="API key successfully validated with Google Gemini 2.5 Flash.",
                )
            else:
                return ApiKeyVerifyResponse(
                    valid=False,
                    message=f"Gemini API returned code {resp.status_code}. Please verify the key.",
                )
    except Exception as e:
        return ApiKeyVerifyResponse(
            valid=False,
            message=f"Could not connect to Gemini API: {str(e)}",
        )


@router.post("/demo-seed")
async def seed_demo_workspace(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Explicitly load demo maintenance cases and equipment for testing/evaluation."""
    count = await seed_database_and_index(db)
    return {
        "success": True,
        "records_indexed": count,
        "message": f"Demo workspace loaded with {count} historical maintenance records.",
    }


@router.post("/reset")
async def reset_workspace_data(
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Factory reset all organization complaints, work orders, diagnoses, and vector index."""
    confirm = payload.get("confirmation") or payload.get("confirm_text")
    if confirm != "CONFIRM_RESET":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation text must equal 'CONFIRM_RESET' to perform workspace reset.",
        )

    # Delete all operational data
    await db.execute(Complaint.__table__.delete())
    await db.execute(Diagnosis.__table__.delete())
    await db.execute(Recommendation.__table__.delete())
    await db.execute(AgentRun.__table__.delete())
    await db.execute(TechnicianFeedback.__table__.delete())
    await db.execute(Equipment.__table__.delete())
    await db.execute(MaintenanceRecord.__table__.delete())
    await db.commit()

    # Clear vector store
    vector_store.clear()

    logger.warning("Workspace factory reset executed. All operational records cleared.")
    return {
        "success": True,
        "message": "Organization workspace successfully reset to clean state.",
    }


# ============================================================
# EQUIPMENT ASSET INVENTORY ENDPOINTS
# ============================================================

@router.get("/equipment", response_model=list[EquipmentOut])
async def list_equipment(
    category: str | None = None,
    location: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[EquipmentOut]:
    """List all registered infrastructure equipment in the organization."""
    stmt = select(Equipment).order_by(Equipment.id.desc())
    if category:
        stmt = stmt.where(Equipment.equipment_type == category)
    if location:
        stmt = stmt.where(Equipment.location.ilike(f"%{location}%"))

    res = await db.execute(stmt)
    items = res.scalars().all()
    return [
        EquipmentOut(
            id=item.id,
            organization_id=item.organization_id,
            equipment_name=item.equipment_name,
            equipment_type=item.equipment_type,
            equipment_id=item.equipment_id,
            location=item.location,
            building=item.building or "",
            floor=item.floor or "",
            department=item.department or "",
            manufacturer=item.manufacturer or "",
            model=item.model or "",
            serial_number=item.serial_number or "",
            installation_date=item.installation_date or "",
            status=item.status,
            criticality=item.criticality,
            created_at=item.created_at or "",
        )
        for item in items
    ]


@router.post("/equipment", response_model=EquipmentOut)
async def create_equipment(
    payload: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
) -> EquipmentOut:
    """Register a new infrastructure equipment asset in the inventory."""
    now_str = datetime.now().strftime("%Y-%m-%d")

    # Get active organization
    org_res = await db.execute(select(Organization.id).order_by(Organization.id.desc()).limit(1))
    org_id = org_res.scalar_one_or_none()

    item = Equipment(
        organization_id=org_id,
        equipment_name=payload.equipment_name,
        equipment_type=payload.equipment_type,
        equipment_id=payload.equipment_id,
        location=payload.location,
        building=payload.building or "",
        floor=payload.floor or "",
        department=payload.department or "",
        manufacturer=payload.manufacturer or "",
        model=payload.model or "",
        serial_number=payload.serial_number or "",
        installation_date=payload.installation_date or now_str,
        status=payload.status,
        criticality=payload.criticality,
        created_at=now_str,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    logger.info(f"Registered equipment '{item.equipment_name}' ({item.equipment_id}) at {item.location}.")

    return EquipmentOut(
        id=item.id,
        organization_id=item.organization_id,
        equipment_name=item.equipment_name,
        equipment_type=item.equipment_type,
        equipment_id=item.equipment_id,
        location=item.location,
        building=item.building,
        floor=item.floor,
        department=item.department,
        manufacturer=item.manufacturer,
        model=item.model,
        serial_number=item.serial_number,
        installation_date=item.installation_date,
        status=item.status,
        criticality=item.criticality,
        created_at=item.created_at,
    )


@router.delete("/equipment/{equipment_id_pk}")
async def delete_equipment(
    equipment_id_pk: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Remove an equipment item from the inventory."""
    stmt = select(Equipment).where(Equipment.id == equipment_id_pk)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Equipment item not found")

    await db.delete(item)
    await db.commit()
    return {"success": True, "message": f"Equipment '{item.equipment_name}' removed from inventory."}


@router.post("/equipment/import-csv")
async def import_equipment_csv(
    payload: EquipmentCsvImportRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Bulk import equipment inventory from CSV content string."""
    text_content = payload.csv_content.strip()
    if not text_content:
        raise HTTPException(status_code=400, detail="CSV content cannot be empty.")

    reader = csv.DictReader(io.StringIO(text_content))

    org_res = await db.execute(select(Organization.id).order_by(Organization.id.desc()).limit(1))
    org_id = org_res.scalar_one_or_none()

    imported = 0
    now_str = datetime.now().strftime("%Y-%m-%d")

    for row in reader:
        name = row.get("equipment_name") or row.get("name") or row.get("Equipment Name")
        eq_type = row.get("equipment_type") or row.get("type") or row.get("Category") or "General Facility"
        eq_id = row.get("equipment_id") or row.get("id") or f"EQ-{1000 + imported}"
        loc = row.get("location") or row.get("Location") or "Main Facility"

        if name:
            item = Equipment(
                organization_id=org_id,
                equipment_name=name.strip(),
                equipment_type=eq_type.strip(),
                equipment_id=eq_id.strip(),
                location=loc.strip(),
                building=row.get("building", ""),
                floor=row.get("floor", ""),
                department=row.get("department", ""),
                manufacturer=row.get("manufacturer", ""),
                model=row.get("model", ""),
                serial_number=row.get("serial_number", ""),
                installation_date=row.get("installation_date", now_str),
                status=row.get("status", "Operational"),
                criticality=row.get("criticality", "Medium"),
                created_at=now_str,
            )
            db.add(item)
            imported += 1

    if imported > 0:
        await db.commit()

    return {
        "success": True,
        "imported_count": imported,
        "message": f"Successfully imported {imported} equipment assets into inventory.",
    }
