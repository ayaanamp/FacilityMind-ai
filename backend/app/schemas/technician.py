"""Pydantic schemas for Technician & Maintenance Staff management."""

from pydantic import BaseModel, ConfigDict, Field


class TechnicianCreate(BaseModel):
    """Schema for adding a new technician / maintenance worker."""

    name: str = Field(..., min_length=2, description="Technician full name")
    phone: str = Field(..., min_length=6, description="Contact phone number")
    role: str = Field("HVAC Specialist", description="Specialization or skill role")
    hourly_rate: int = Field(350, ge=0, description="Hourly wage in INR")
    per_job_rate: int = Field(800, ge=0, description="Standard per-job fee in INR")
    status: str = Field("Available", description="Current status: Available, On Job, Off Duty")


class TechnicianUpdate(BaseModel):
    """Schema for updating technician details."""

    name: str | None = None
    phone: str | None = None
    role: str | None = None
    hourly_rate: int | None = None
    per_job_rate: int | None = None
    status: str | None = None
    total_jobs_completed: int | None = None
    total_earnings: int | None = None


class TechnicianResponse(BaseModel):
    """Schema for returning technician data."""

    id: int
    name: str
    phone: str
    role: str
    hourly_rate: int
    per_job_rate: int
    total_jobs_completed: int
    total_earnings: int
    status: str
    joined_date: str

    model_config = ConfigDict(from_attributes=True)


class TechniciansSummaryResponse(BaseModel):
    """Summary of technician roster and labor money metrics."""

    technicians: list[TechnicianResponse]
    total_technicians: int
    active_on_duty: int
    total_labor_paid_inr: int
    total_jobs_completed: int
