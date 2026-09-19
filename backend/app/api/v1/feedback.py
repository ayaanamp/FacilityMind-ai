"""Technician feedback and continuous learning loop endpoint."""

from datetime import UTC, datetime

from backend.app.core.logging import logging
from backend.app.database.session import get_db
from backend.app.models.maintenance import (
    Complaint,
    Diagnosis,
    MaintenanceRecord,
    Recommendation,
    TechnicianFeedback,
)
from backend.app.rag.indexing import index_record
from backend.app.rag.vector_store import vector_store
from backend.app.schemas.feedback import (
    TechnicianFeedbackCreate,
    TechnicianFeedbackResponse,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("FacilityMind.Feedback")
router = APIRouter(prefix="/feedback", tags=["Technician Feedback Loop"])


@router.post("", response_model=TechnicianFeedbackResponse)
async def submit_technician_feedback(
    payload: TechnicianFeedbackCreate,
    db: AsyncSession = Depends(get_db),
) -> TechnicianFeedbackResponse:
    """Submit technician verification/correction and append confirmed case to knowledge base."""
    # 1. Fetch complaint and relations
    complaint_stmt = select(Complaint).where(Complaint.id == payload.complaint_id)
    complaint_res = await db.execute(complaint_stmt)
    complaint = complaint_res.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    diag_stmt = select(Diagnosis).where(Diagnosis.complaint_id == payload.complaint_id)
    diag_res = await db.execute(diag_stmt)
    diagnosis = diag_res.scalar_one_or_none()

    rec_stmt = select(Recommendation).where(Recommendation.complaint_id == payload.complaint_id)
    rec_res = await db.execute(rec_stmt)
    recommendation = rec_res.scalar_one_or_none()

    # 2. Record feedback entry
    feedback = TechnicianFeedback(
        complaint_id=payload.complaint_id,
        accepted=payload.accepted,
        technician_name=payload.technician_name,
        technician_feedback=payload.technician_feedback,
        corrected_diagnosis=payload.corrected_diagnosis,
        corrected_fix=payload.corrected_fix,
        actual_cost=payload.actual_cost,
        appended_to_kb=False,
    )
    db.add(feedback)

    # 3. Update complaint status and work order tracking
    complaint.status = "Verified & Closed" if payload.accepted else "Technician Corrected"
    complaint.work_order_status = "Completed" if payload.accepted else "In Review"
    if payload.actual_cost is not None:
        complaint.total_actual_cost = int(payload.actual_cost)

    new_kb_id = None

    # 4. Compulsory Add-on: Append confirmed case to Knowledge Base & Vector Index
    confirmed_diagnosis = (
        payload.corrected_diagnosis
        if not payload.accepted and payload.corrected_diagnosis
        else (diagnosis.primary_cause if diagnosis else "General servicing")
    )
    confirmed_fix = (
        payload.corrected_fix
        if not payload.accepted and payload.corrected_fix
        else (recommendation.action if recommendation else "Verified inspection")
    )
    confirmed_cost = (
        payload.actual_cost
        if payload.actual_cost
        else (recommendation.estimated_cost_min if recommendation else 1200)
    )

    # Generate new unique record id
    max_id_res = await db.execute(
        select(MaintenanceRecord.id).order_by(MaintenanceRecord.id.desc()).limit(1)
    )
    max_id = max_id_res.scalar() or 2000
    new_kb_id = max_id + 1

    new_record = MaintenanceRecord(
        id=new_kb_id,
        equipment_type=complaint.equipment_type or "General Facility",
        equipment_id=complaint.equipment_id or f"EQ-{new_kb_id}",
        location=complaint.location or "Campus Facility",
        complaint=complaint.raw_complaint,
        symptoms=complaint.symptoms or complaint.raw_complaint,
        diagnosis=confirmed_diagnosis,
        root_cause=confirmed_diagnosis,
        recommended_fix=confirmed_fix,
        estimated_cost=confirmed_cost,
        repair_time=recommendation.repair_time_hours if recommendation else 1.5,
        urgency=complaint.severity or "Medium",
        technician_type=payload.technician_name,
        date=datetime.now(UTC).strftime("%Y-%m-%d"),
        technician_notes=f"Confirmed by {payload.technician_name}. Note: {payload.technician_feedback}",
        status="Verified & Closed",
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(feedback)

    # Index into live vector store
    await index_record(
        record_id=new_kb_id,
        equipment_type=new_record.equipment_type,
        equipment_id=new_record.equipment_id,
        location=new_record.location,
        complaint=new_record.complaint,
        symptoms=new_record.symptoms,
        diagnosis=new_record.diagnosis,
        root_cause=new_record.root_cause,
        recommended_fix=new_record.recommended_fix,
        estimated_cost=new_record.estimated_cost,
        repair_time=new_record.repair_time,
        urgency=new_record.urgency,
        technician_type=new_record.technician_type,
        date=new_record.date,
        technician_notes=new_record.technician_notes,
    )
    vector_store.save()

    feedback.appended_to_kb = True
    await db.commit()

    logger.info(f"Appended confirmed case #{new_kb_id} to knowledge base and vector store.")

    return TechnicianFeedbackResponse(
        id=feedback.id,
        complaint_id=feedback.complaint_id,
        accepted=feedback.accepted,
        technician_name=feedback.technician_name,
        technician_feedback=feedback.technician_feedback,
        appended_to_kb=True,
        new_knowledge_record_id=new_kb_id,
        created_at=feedback.created_at,
    )
