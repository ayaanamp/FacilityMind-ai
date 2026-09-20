"""Pydantic schemas for Complaint intake, tracking, timeline, and resolution lifecycle."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TimelineEventResponse(BaseModel):
    """Schema for individual audit/timeline event."""

    id: int
    complaint_id: int
    event_type: str
    actor_name: str
    actor_role: str
    message: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class ComplaintCreate(BaseModel):
    """Schema for submitting a new maintenance complaint."""

    raw_complaint: str = Field(
        ..., min_length=5, description="Full raw complaint text reported by user or facility staff"
    )
    title: str | None = Field(None, description="Optional brief title/subject")
    equipment_type: str | None = Field(None, description="Optional pre-selected equipment type")
    equipment_id: str | None = Field(
        None, description="Optional equipment identifier (e.g. AC-034)"
    )
    location: str | None = Field(
        None, description="Optional facility location (e.g. Computer Lab 3)"
    )
    building: str | None = Field(None, description="Building name")
    floor: str | None = Field(None, description="Floor level")
    room: str | None = Field(None, description="Room number or area")
    severity: str | None = Field(
        "Medium", description="Initial severity indicator (Low, Medium, High, Critical)"
    )
    reporter_name: str | None = Field("Campus Member", description="Name of person reporting")
    reporter_dept: str | None = Field("General Facility", description="Class or department")
    noticed_at: str | None = Field(None, description="When issue was first observed")
    reporter_phone: str | None = Field(None, description="Contact phone number of reporter")


class ComplaintResolveRequest(BaseModel):
    """Schema for resolving a complaint with required resolution notes and cost settlement."""

    resolution_notes: str = Field(..., min_length=5, description="Clear description of work done and how issue was solved")
    assigned_technician_id: int | None = Field(None, description="Technician ID who executed the work")
    assigned_technician_name: str | None = Field(None, description="Technician name")
    labor_cost: int | None = Field(0, description="Labor cost in local currency")
    parts_cost: int | None = Field(0, description="Parts and replacement cost")
    other_cost: int | None = Field(0, description="Miscellaneous expenses")
    internal_admin_notes: str | None = Field(None, description="Internal notes visible only to admins")


class ComplaintReopenRequest(BaseModel):
    """Schema for reopening a complaint."""

    reason: str = Field(..., min_length=5, description="Reason for reopening the ticket")
    actor_name: str | None = Field("Complainant", description="Person reopening")


class ComplaintTrackResponse(BaseModel):
    """Sanitized response schema for complainant public tracking."""

    id: int
    tracking_code: str
    title: str | None = None
    raw_complaint: str
    equipment_type: str | None = None
    equipment_id: str | None = None
    location: str | None = None
    building: str | None = None
    floor: str | None = None
    room: str | None = None
    severity: str
    status: str
    work_order_status: str | None = None
    reporter_name: str | None = None
    reporter_dept: str | None = None
    noticed_at: str | None = None
    created_at: str | None = None
    resolved_at: str | None = None
    public_resolution_notes: str | None = None
    assigned_technician_name: str | None = None
    timeline_events: list[TimelineEventResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ComplaintResponse(BaseModel):
    """Full schema for returning a stored complaint record."""

    id: int
    tracking_code: str | None = None
    title: str | None = None
    raw_complaint: str
    equipment_type: str | None = None
    equipment_id: str | None = None
    location: str | None = None
    building: str | None = None
    floor: str | None = None
    room: str | None = None
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
    other_cost: int | None = 0
    total_actual_cost: int | None = 0
    public_resolution_notes: str | None = None
    internal_admin_notes: str | None = None
    resolved_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    timeline_events: list[TimelineEventResponse] = []

    model_config = ConfigDict(from_attributes=True)
