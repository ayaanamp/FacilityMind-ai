"""Pydantic schemas for Complaint intake and management."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ComplaintCreate(BaseModel):
    """Schema for submitting a new maintenance complaint."""

    raw_complaint: str = Field(
        ..., min_length=5, description="Full raw complaint text reported by user or facility staff"
    )
    equipment_type: str | None = Field(None, description="Optional pre-selected equipment type")
    equipment_id: str | None = Field(
        None, description="Optional equipment identifier (e.g. AC-034)"
    )
    location: str | None = Field(
        None, description="Optional facility location (e.g. Computer Lab 3)"
    )
    severity: str | None = Field(
        "Medium", description="Initial severity indicator (Low, Medium, High, Critical)"
    )
    reporter_name: str | None = Field("Campus Member", description="Name of person reporting")
    reporter_dept: str | None = Field("General Facility", description="Class or department")
    noticed_at: str | None = Field(None, description="When issue was first observed")
    reporter_phone: str | None = Field(None, description="Contact phone number of reporter")


class ComplaintResponse(BaseModel):
    """Schema for returning a stored complaint record."""

    id: int
    raw_complaint: str
    equipment_type: str | None = None
    equipment_id: str | None = None
    location: str | None = None
    symptoms: str | None = None
    severity: str
    status: str
    reporter_name: str | None = "Campus Member"
    reporter_dept: str | None = "General Facility"
    noticed_at: str | None = None
    reporter_phone: str | None = None
    work_order_status: str | None = "Triage Pending"
    accuracy_rating: int | None = None
    assigned_technician_id: int | None = None
    assigned_technician_name: str | None = None
    labor_cost: int | None = 0
    parts_cost: int | None = 0
    total_actual_cost: int | None = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
