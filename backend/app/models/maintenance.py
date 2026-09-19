"""Database models for FacilityMind AI platform."""

from backend.app.database.base import Base
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class MaintenanceRecord(Base):
    """Historical maintenance case records in knowledge base."""

    __tablename__ = "maintenance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    equipment_type: Mapped[str] = mapped_column(String(100), index=True)
    equipment_id: Mapped[str] = mapped_column(String(50), index=True)
    location: Mapped[str] = mapped_column(String(150), index=True)
    complaint: Mapped[str] = mapped_column(Text)
    symptoms: Mapped[str] = mapped_column(Text)
    diagnosis: Mapped[str] = mapped_column(Text)
    root_cause: Mapped[str] = mapped_column(Text)
    recommended_fix: Mapped[str] = mapped_column(Text)
    estimated_cost: Mapped[int] = mapped_column(Integer, default=0)
    repair_time: Mapped[float] = mapped_column(Float, default=1.0)
    urgency: Mapped[str] = mapped_column(String(30), default="Medium")
    technician_type: Mapped[str] = mapped_column(String(100), default="General Technician")
    date: Mapped[str] = mapped_column(String(30))
    technician_notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(50), default="Resolved")


class Complaint(Base):
    """Active or triaged maintenance complaints submitted by users/staff."""

    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    raw_complaint: Mapped[str] = mapped_column(Text, nullable=False)
    equipment_type: Mapped[str | None] = mapped_column(String(100), default="General Facility")
    equipment_id: Mapped[str | None] = mapped_column(String(50), default=None)
    location: Mapped[str | None] = mapped_column(String(150), default="Main Campus")
    symptoms: Mapped[str | None] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(30), default="Medium")
    status: Mapped[str] = mapped_column(String(50), default="Analyzed")
    reporter_name: Mapped[str | None] = mapped_column(String(100), default="Campus Member")
    reporter_dept: Mapped[str | None] = mapped_column(String(100), default="General Facility")
    noticed_at: Mapped[str | None] = mapped_column(String(50), default=None)
    work_order_status: Mapped[str] = mapped_column(String(50), default="Triage Pending")
    accuracy_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reporter_phone: Mapped[str | None] = mapped_column(String(30), default=None)
    assigned_technician_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assigned_technician_name: Mapped[str | None] = mapped_column(String(100), default=None)
    labor_cost: Mapped[int | None] = mapped_column(Integer, default=0)
    parts_cost: Mapped[int | None] = mapped_column(Integer, default=0)
    total_actual_cost: Mapped[int | None] = mapped_column(Integer, default=0)

    diagnosis = relationship(
        "Diagnosis", back_populates="complaint", uselist=False, cascade="all, delete-orphan"
    )
    recommendation = relationship(
        "Recommendation", back_populates="complaint", uselist=False, cascade="all, delete-orphan"
    )
    agent_runs = relationship("AgentRun", back_populates="complaint", cascade="all, delete-orphan")
    feedback = relationship(
        "TechnicianFeedback", back_populates="complaint", cascade="all, delete-orphan"
    )


class TechnicianStaff(Base):
    """Technicians, workers, and maintenance personnel roster with salary and cost tracking."""

    __tablename__ = "technicians"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    phone: Mapped[str] = mapped_column(String(30), default="")
    role: Mapped[str] = mapped_column(String(100), default="HVAC Specialist")
    hourly_rate: Mapped[int] = mapped_column(Integer, default=350)
    per_job_rate: Mapped[int] = mapped_column(Integer, default=800)
    total_jobs_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_earnings: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="Available")  # Available, On Job, Off Duty
    joined_date: Mapped[str] = mapped_column(String(30), default="2026-01-15")


class Diagnosis(Base):
    """AI and evidence-backed diagnosis produced for a complaint."""

    __tablename__ = "diagnoses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    complaint_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("complaints.id", ondelete="CASCADE"), unique=True
    )
    primary_cause: Mapped[str] = mapped_column(Text, nullable=False)
    possible_causes_json: Mapped[str] = mapped_column(Text, default="[]")
    confidence_level: Mapped[str] = mapped_column(String(50), default="Moderate Evidence")
    supporting_cases_json: Mapped[str] = mapped_column(Text, default="[]")
    reasoning_summary: Mapped[str] = mapped_column(Text, default="")
    is_fallback: Mapped[bool] = mapped_column(Boolean, default=False)

    complaint = relationship("Complaint", back_populates="diagnosis")


class Recommendation(Base):
    """Actionable repair prescription, cost, duration, and rationale."""

    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    complaint_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("complaints.id", ondelete="CASCADE"), unique=True
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    repair_steps_json: Mapped[str] = mapped_column(Text, default="[]")
    estimated_cost_min: Mapped[int] = mapped_column(Integer, default=1000)
    estimated_cost_max: Mapped[int] = mapped_column(Integer, default=2500)
    repair_time_hours: Mapped[float] = mapped_column(Float, default=1.5)
    urgency: Mapped[str] = mapped_column(String(30), default="Medium")
    technician_required: Mapped[str] = mapped_column(String(100), default="Technician")
    required_tools_json: Mapped[str] = mapped_column(Text, default="[]")
    replacement_parts_json: Mapped[str] = mapped_column(Text, default="[]")
    explanation_text: Mapped[str] = mapped_column(Text, default="")

    complaint = relationship("Complaint", back_populates="recommendation")


class AgentRun(Base):
    """Audit log of individual agent execution steps within an orchestration."""

    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    complaint_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("complaints.id", ondelete="CASCADE"), nullable=True
    )
    agent_name: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(30), default="Completed")
    execution_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    output_summary: Mapped[str] = mapped_column(Text, default="")

    complaint = relationship("Complaint", back_populates="agent_runs")


class TechnicianFeedback(Base):
    """Technician review, acceptance, diagnosis corrections, and closed-loop learning."""

    __tablename__ = "technician_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    complaint_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("complaints.id", ondelete="CASCADE")
    )
    accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    technician_name: Mapped[str] = mapped_column(String(100), default="On-Duty Technician")
    technician_feedback: Mapped[str] = mapped_column(Text, default="")
    corrected_diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrected_fix: Mapped[str | None] = mapped_column(Text, nullable=True)
    actual_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    appended_to_kb: Mapped[bool] = mapped_column(Boolean, default=False)

    complaint = relationship("Complaint", back_populates="feedback")
