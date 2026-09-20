"""Technician & Maintenance Staff management API endpoints."""

from backend.app.database.session import get_db
from backend.app.models.maintenance import TechnicianStaff
from backend.app.schemas.technician import (
    TechnicianCreate,
    TechnicianResponse,
    TechniciansSummaryResponse,
    TechnicianUpdate,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/technicians", tags=["Staff & Technicians"])

DEFAULT_STAFF = [
    {
        "name": "Ramesh Kumar",
        "phone": "+91 98765 43210",
        "role": "Senior HVAC Technician",
        "hourly_rate": 450,
        "per_job_rate": 900,
        "status": "Available",
        "total_jobs_completed": 14,
        "total_earnings": 12600,
        "joined_date": "2025-08-10",
    },
    {
        "name": "Suresh Sharma",
        "phone": "+91 98450 11223",
        "role": "Master Electrician",
        "hourly_rate": 400,
        "per_job_rate": 850,
        "status": "Available",
        "total_jobs_completed": 19,
        "total_earnings": 16150,
        "joined_date": "2025-06-15",
    },
    {
        "name": "Anand Patel",
        "phone": "+91 97123 88990",
        "role": "Plumbing & Piping Specialist",
        "hourly_rate": 350,
        "per_job_rate": 750,
        "status": "Available",
        "total_jobs_completed": 11,
        "total_earnings": 8250,
        "joined_date": "2025-09-01",
    },
    {
        "name": "Priya Nair",
        "phone": "+91 99001 55443",
        "role": "AV & Smart Classroom IT Tech",
        "hourly_rate": 500,
        "per_job_rate": 1000,
        "status": "Available",
        "total_jobs_completed": 8,
        "total_earnings": 8000,
        "joined_date": "2025-11-20",
    },
    {
        "name": "Vikram Singh",
        "phone": "+91 98234 66778",
        "role": "Network & Infrastructure Engineer",
        "hourly_rate": 550,
        "per_job_rate": 1200,
        "status": "Available",
        "total_jobs_completed": 6,
        "total_earnings": 7200,
        "joined_date": "2025-12-05",
    },
    {
        "name": "Manoj Verma",
        "phone": "+91 96554 22331",
        "role": "General Campus Handyman",
        "hourly_rate": 300,
        "per_job_rate": 600,
        "status": "Available",
        "total_jobs_completed": 22,
        "total_earnings": 13200,
        "joined_date": "2025-05-18",
    },
]


@router.get("", response_model=TechniciansSummaryResponse)
async def list_technicians(
    db: AsyncSession = Depends(get_db),
) -> TechniciansSummaryResponse:
    """List all registered technicians with money management summary."""
    stmt = select(TechnicianStaff).order_by(TechnicianStaff.name.asc())
    res = await db.execute(stmt)
    records = list(res.scalars().all())

    total_techs = len(records)
    active_on_duty = sum(1 for r in records if r.status == "On Job")
    total_labor_paid = sum(r.total_earnings for r in records)
    total_jobs = sum(r.total_jobs_completed for r in records)

    return TechniciansSummaryResponse(
        technicians=[TechnicianResponse.model_validate(r) for r in records],
        total_technicians=total_techs,
        active_on_duty=active_on_duty,
        total_labor_paid_inr=total_labor_paid,
        total_jobs_completed=total_jobs,
    )


@router.post("", response_model=TechnicianResponse)
async def create_technician(
    payload: TechnicianCreate,
    db: AsyncSession = Depends(get_db),
) -> TechnicianResponse:
    """Register a new technician / worker into the roster."""
    tech = TechnicianStaff(
        name=payload.name,
        phone=payload.phone,
        role=payload.role,
        hourly_rate=payload.hourly_rate,
        per_job_rate=payload.per_job_rate,
        status=payload.status,
        total_jobs_completed=0,
        total_earnings=0,
    )
    db.add(tech)
    await db.commit()
    await db.refresh(tech)
    return TechnicianResponse.model_validate(tech)


@router.put("/{tech_id}", response_model=TechnicianResponse)
async def update_technician(
    tech_id: int,
    payload: TechnicianUpdate,
    db: AsyncSession = Depends(get_db),
) -> TechnicianResponse:
    """Update technician profile, rate, or status."""
    stmt = select(TechnicianStaff).where(TechnicianStaff.id == tech_id)
    res = await db.execute(stmt)
    tech = res.scalar_one_or_none()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")

    if payload.name is not None:
        tech.name = payload.name
    if payload.phone is not None:
        tech.phone = payload.phone
    if payload.role is not None:
        tech.role = payload.role
    if payload.hourly_rate is not None:
        tech.hourly_rate = payload.hourly_rate
    if payload.per_job_rate is not None:
        tech.per_job_rate = payload.per_job_rate
    if payload.status is not None:
        tech.status = payload.status
    if payload.total_jobs_completed is not None:
        tech.total_jobs_completed = payload.total_jobs_completed
    if payload.total_earnings is not None:
        tech.total_earnings = payload.total_earnings

    await db.commit()
    await db.refresh(tech)
    return TechnicianResponse.model_validate(tech)


@router.delete("/{tech_id}")
async def delete_technician(
    tech_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Remove a technician from active roster."""
    stmt = select(TechnicianStaff).where(TechnicianStaff.id == tech_id)
    res = await db.execute(stmt)
    tech = res.scalar_one_or_none()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")

    await db.delete(tech)
    await db.commit()
    return {"success": True, "message": f"Technician {tech.name} removed from roster."}
