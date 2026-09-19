"""Schemas for technician review and feedback loop."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TechnicianFeedbackCreate(BaseModel):
    """Technician feedback submission."""

    complaint_id: int = Field(..., description="ID of the complaint being reviewed")
    accepted: bool = Field(
        ..., description="True if AI diagnosis & recommendation is approved, False if corrected"
    )
    technician_name: str = Field(
        "Staff Technician", description="Name/Badge of the reviewing technician"
    )
    technician_feedback: str = Field("", description="Review notes, comments, or observations")
    corrected_diagnosis: str | None = Field(None, description="Corrected diagnosis if rejected")
    corrected_fix: str | None = Field(None, description="Corrected repair action if rejected")
    actual_cost: int | None = Field(None, description="Actual invoiced repair cost in INR (₹)")


class TechnicianFeedbackResponse(BaseModel):
    """Confirmation of recorded technician feedback and knowledge base ingestion."""

    id: int
    complaint_id: int
    accepted: bool
    technician_name: str
    technician_feedback: str
    appended_to_kb: bool
    new_knowledge_record_id: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
