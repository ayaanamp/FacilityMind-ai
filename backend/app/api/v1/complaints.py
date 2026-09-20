"""Complaints, Tracking, Lifecycle, and Decision intake REST API endpoints."""

from __future__ import annotations

import contextlib
import datetime
import json

from backend.app.agents.orchestrator import orchestrator
from backend.app.core.events import event_bus
from backend.app.database.session import get_db
from backend.app.models.maintenance import (
    AgentRun,
    Complaint,
    ComplaintTimelineEvent,
    Diagnosis,
    MaintenanceRecord,
    Notification,
    Recommendation,
    TechnicianFeedback,
    TechnicianStaff,
)
from backend.app.schemas.agent import (
    AgentRunItem,
    ComplaintAnalysisOutput,
    DiagnosisOutput,
    ExplanationOutput,
    RecommendationOutput,
)
from backend.app.schemas.complaint import (
    ComplaintCreate,
    ComplaintReopenRequest,
    ComplaintResolveRequest,
    ComplaintResponse,
    ComplaintTrackResponse,
    TimelineEventResponse,
)
from backend.app.schemas.decision import DecisionReportResponse, SimilarCaseItem
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/complaints", tags=["Complaints & Decisions"])


def _format_now() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@router.post("", response_model=DecisionReportResponse)
async def create_and_analyze_complaint(
    payload: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
) -> DecisionReportResponse:
    """Submit a complaint, assign tracking code, execute multi-agent AI, log timeline events, and broadcast."""
    now_str = _format_now()

    # 1. Create initial complaint entry in DB
    complaint = Complaint(
        raw_complaint=payload.raw_complaint,
        title=payload.title or (payload.raw_complaint[:60] + "..." if len(payload.raw_complaint) > 60 else payload.raw_complaint),
        equipment_type=payload.equipment_type or "General Facility",
        equipment_id=payload.equipment_id,
        location=payload.location or "Main Campus",
        building=payload.building or "",
        floor=payload.floor or "",
        room=payload.room or "",
        severity=payload.severity or "Medium",
        status="SUBMITTED",
        reporter_name=payload.reporter_name or "Campus Member",
        reporter_dept=payload.reporter_dept or "General Facility",
        noticed_at=payload.noticed_at,
        reporter_phone=payload.reporter_phone,
        work_order_status="Triage Pending",
        created_at=now_str,
        updated_at=now_str,
    )
    db.add(complaint)
    await db.commit()
    await db.refresh(complaint)

    # Assign readable tracking code
    complaint.tracking_code = f"FM-{complaint.id:04d}"

    # Add initial SUBMITTED timeline event
    evt_sub = ComplaintTimelineEvent(
        complaint_id=complaint.id,
        event_type="SUBMITTED",
        actor_name=complaint.reporter_name or "Complainant",
        actor_role="User",
        message=f"Complaint #{complaint.tracking_code} submitted via portal.",
        created_at=now_str,
    )
    db.add(evt_sub)

    # 2. Execute Multi-Agent Orchestrator
    state = await orchestrator.execute_pipeline(
        raw_complaint=payload.raw_complaint,
        complaint_id=complaint.id,
        equipment_hint=payload.equipment_type,
        location_hint=payload.location,
        severity_hint=payload.severity,
    )

    analysis: ComplaintAnalysisOutput = state.get("analysis")
    diagnosis: DiagnosisOutput = state.get("diagnosis")
    rec: RecommendationOutput = state.get("recommendation")
    explanation: ExplanationOutput = state.get("explanation")
    similar_cases_raw = state.get("similar_cases", [])
    agent_runs_raw = state.get("agent_runs", [])

    # Preserve user's manually entered parameters
    complaint.equipment_type = payload.equipment_type or analysis.equipment_type
    complaint.equipment_id = payload.equipment_id or analysis.equipment_id
    complaint.location = payload.location or analysis.location
    complaint.symptoms = payload.raw_complaint or analysis.symptoms
    complaint.severity = payload.severity or analysis.severity
    complaint.status = "UNDER_REVIEW"
    complaint.work_order_status = "AI Triaged"
    complaint.updated_at = _format_now()

    # Add AI_ANALYZED timeline event
    evt_ai = ComplaintTimelineEvent(
        complaint_id=complaint.id,
        event_type="AI_ANALYZED",
        actor_name="FacilityMind AI Engine",
        actor_role="System",
        message=f"Multi-Agent diagnosis completed: {diagnosis.primary_cause}. Confidence: {diagnosis.confidence_level}.",
        created_at=_format_now(),
    )
    db.add(evt_ai)

    # Save Diagnosis record
    diag_record = Diagnosis(
        complaint_id=complaint.id,
        primary_cause=diagnosis.primary_cause,
        possible_causes_json=json.dumps(diagnosis.possible_causes),
        confidence_level=diagnosis.confidence_level,
        supporting_cases_json=json.dumps(diagnosis.supporting_cases),
        reasoning_summary=diagnosis.reasoning_summary,
        is_fallback=diagnosis.is_fallback,
    )
    db.add(diag_record)

    # Save Recommendation record
    rec_record = Recommendation(
        complaint_id=complaint.id,
        action=rec.action,
        repair_steps_json=json.dumps(rec.repair_steps),
        estimated_cost_min=rec.estimated_cost_min,
        estimated_cost_max=rec.estimated_cost_max,
        repair_time_hours=rec.repair_time_hours,
        urgency=rec.urgency,
        technician_required=rec.technician_required,
        required_tools_json=json.dumps(rec.required_tools),
        replacement_parts_json=json.dumps(rec.replacement_parts),
        explanation_text=explanation.full_text,
    )
    db.add(rec_record)

    # Save Agent Runs Audit Trail
    agent_run_items = []
    for r in agent_runs_raw:
        ar = AgentRun(
            complaint_id=complaint.id,
            agent_name=r["agent_name"],
            status=r["status"],
            execution_time_ms=r["execution_time_ms"],
            output_summary=r["output_summary"],
        )
        db.add(ar)
        agent_run_items.append(
            AgentRunItem(
                agent_name=r["agent_name"],
                status=r["status"],
                execution_time_ms=r["execution_time_ms"],
                output_summary=r["output_summary"],
            )
        )

    # 3. Create linked Knowledge Base MaintenanceRecord
    kb_record = MaintenanceRecord(
        equipment_type=complaint.equipment_type,
        equipment_id=complaint.equipment_id or f"WO-{complaint.id:04d}",
        location=complaint.location,
        complaint=complaint.raw_complaint,
        symptoms=complaint.symptoms or complaint.raw_complaint,
        diagnosis=diagnosis.primary_cause,
        root_cause=diagnosis.primary_cause,
        recommended_fix=rec.action,
        estimated_cost=int((rec.estimated_cost_min + rec.estimated_cost_max) / 2),
        repair_time=rec.repair_time_hours,
        urgency=complaint.severity,
        technician_type=rec.technician_required,
        date=now_str[:10],
        technician_notes=f"Tracking: {complaint.tracking_code} | Reporter: {complaint.reporter_name} | Phone: {complaint.reporter_phone or 'N/A'}",
        status="UNDER_REVIEW",
    )
    db.add(kb_record)

    # Create Notifications
    admin_notif = Notification(
        title=f"New Complaint #{complaint.tracking_code}",
        message=f"{complaint.reporter_name} reported {complaint.equipment_type} issue at {complaint.location}.",
        complaint_id=complaint.id,
        recipient_phone=None,
        created_at=now_str,
    )
    db.add(admin_notif)

    if complaint.reporter_phone:
        user_notif = Notification(
            title=f"Complaint #{complaint.tracking_code} Received",
            message=f"Your ticket for {complaint.equipment_type} is now under review by facility operations.",
            complaint_id=complaint.id,
            recipient_phone=complaint.reporter_phone,
            created_at=now_str,
        )
        db.add(user_notif)

    await db.commit()
    await db.refresh(complaint)

    # Vector store index update
    with contextlib.suppress(Exception):
        from backend.app.rag.embeddings import embedding_service
        from backend.app.rag.vector_store import vector_store

        text_to_embed = f"{complaint.equipment_type} at {complaint.location}: {complaint.raw_complaint} - Cause: {diagnosis.primary_cause} - Fix: {rec.action}"
        emb = await embedding_service.get_embedding(text_to_embed)
        vector_store.add_document(
            doc_id=kb_record.id,
            text=text_to_embed,
            embedding=emb,
            metadata={
                "id": kb_record.id,
                "equipment_type": complaint.equipment_type,
                "equipment_id": complaint.equipment_id or f"WO-{complaint.id:04d}",
                "location": complaint.location,
                "complaint": complaint.raw_complaint,
                "symptoms": complaint.symptoms or complaint.raw_complaint,
                "diagnosis": diagnosis.primary_cause,
                "root_cause": diagnosis.primary_cause,
                "recommended_fix": rec.action,
                "estimated_cost": int((rec.estimated_cost_min + rec.estimated_cost_max) / 2),
                "repair_time": rec.repair_time_hours,
                "urgency": complaint.severity,
                "technician_type": rec.technician_required,
                "date": now_str[:10],
                "status": "UNDER_REVIEW",
                "complaint_id": complaint.id,
                "tracking_code": complaint.tracking_code,
            },
        )
        vector_store.save()

    # Real-time WebSocket Broadcast
    await event_bus.broadcast_event(
        "complaint.created",
        {
            "complaint_id": complaint.id,
            "tracking_code": complaint.tracking_code,
            "title": complaint.title,
            "equipment_type": complaint.equipment_type,
            "location": complaint.location,
            "severity": complaint.severity,
            "status": complaint.status,
            "reporter_phone": complaint.reporter_phone,
        },
    )

    similar_cases = [SimilarCaseItem(**c) for c in similar_cases_raw]

    return DecisionReportResponse(
        complaint_id=complaint.id,
        tracking_code=complaint.tracking_code,
        raw_complaint=complaint.raw_complaint,
        status=complaint.status,
        created_at=complaint.created_at,
        analysis=analysis,
        similar_cases=similar_cases,
        diagnosis=diagnosis,
        recommendation=rec,
        explanation=explanation,
        agent_runs=agent_run_items,
        is_fallback=diagnosis.is_fallback,
        human_verified=False,
    )


@router.get("", response_model=list[ComplaintResponse])
async def list_complaints(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: str | None = None,
    equipment_type: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[ComplaintResponse]:
    """Retrieve list of submitted complaints with full details and timeline events."""
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.timeline_events))
        .order_by(desc(Complaint.id))
        .offset(skip)
        .limit(limit)
    )
    if status:
        stmt = stmt.where(Complaint.status == status)
    if equipment_type:
        stmt = stmt.where(Complaint.equipment_type == equipment_type)

    result = await db.execute(stmt)
    complaints = result.scalars().all()
    return list(complaints)


@router.get("/track/{tracking_code_or_id}", response_model=ComplaintTrackResponse)
async def track_complaint(
    tracking_code_or_id: str,
    db: AsyncSession = Depends(get_db),
) -> ComplaintTrackResponse:
    """Public lookup endpoint for complainants to track live status and timeline events."""
    tracking_clean = tracking_code_or_id.strip()

    stmt = select(Complaint).options(selectinload(Complaint.timeline_events))
    if tracking_clean.upper().startswith("FM-"):
        stmt = stmt.where(func.upper(Complaint.tracking_code) == tracking_clean.upper())
    elif tracking_clean.isdigit():
        cid = int(tracking_clean)
        stmt = stmt.where((Complaint.id == cid) | (Complaint.tracking_code == f"FM-{cid:04d}"))
    else:
        stmt = stmt.where(func.upper(Complaint.tracking_code) == tracking_clean.upper())

    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail=f"No complaint found matching tracking code '{tracking_code_or_id}'. Please check the format (e.g., FM-0001).",
        )

    timeline_sorted = sorted(complaint.timeline_events, key=lambda x: x.id)
    timeline_items = [
        TimelineEventResponse(
            id=t.id,
            complaint_id=t.complaint_id,
            event_type=t.event_type,
            actor_name=t.actor_name,
            actor_role=t.actor_role,
            message=t.message,
            created_at=t.created_at,
        )
        for t in timeline_sorted
    ]

    return ComplaintTrackResponse(
        id=complaint.id,
        tracking_code=complaint.tracking_code or f"FM-{complaint.id:04d}",
        title=complaint.title,
        raw_complaint=complaint.raw_complaint,
        equipment_type=complaint.equipment_type,
        equipment_id=complaint.equipment_id,
        location=complaint.location,
        building=complaint.building,
        floor=complaint.floor,
        room=complaint.room,
        severity=complaint.severity,
        status=complaint.status,
        work_order_status=complaint.work_order_status,
        reporter_name=complaint.reporter_name,
        reporter_dept=complaint.reporter_dept,
        noticed_at=complaint.noticed_at,
        created_at=complaint.created_at,
        resolved_at=complaint.resolved_at,
        public_resolution_notes=complaint.public_resolution_notes,
        assigned_technician_name=complaint.assigned_technician_name,
        timeline_events=timeline_items,
    )


@router.get("/user/my", response_model=list[ComplaintTrackResponse])
async def get_user_complaints(
    phone: str = Query(..., min_length=3, description="User phone number"),
    db: AsyncSession = Depends(get_db),
) -> list[ComplaintTrackResponse]:
    """Retrieve all complaints submitted by a specific user phone number."""
    phone_clean = phone.strip()
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.timeline_events))
        .where(Complaint.reporter_phone == phone_clean)
        .order_by(desc(Complaint.id))
    )
    result = await db.execute(stmt)
    complaints = result.scalars().all()

    output = []
    for c in complaints:
        timeline_sorted = sorted(c.timeline_events, key=lambda x: x.id)
        output.append(
            ComplaintTrackResponse(
                id=c.id,
                tracking_code=c.tracking_code or f"FM-{c.id:04d}",
                title=c.title,
                raw_complaint=c.raw_complaint,
                equipment_type=c.equipment_type,
                equipment_id=c.equipment_id,
                location=c.location,
                building=c.building,
                floor=c.floor,
                room=c.room,
                severity=c.severity,
                status=c.status,
                work_order_status=c.work_order_status,
                reporter_name=c.reporter_name,
                reporter_dept=c.reporter_dept,
                noticed_at=c.noticed_at,
                created_at=c.created_at,
                resolved_at=c.resolved_at,
                public_resolution_notes=c.public_resolution_notes,
                assigned_technician_name=c.assigned_technician_name,
                timeline_events=[
                    TimelineEventResponse(
                        id=t.id,
                        complaint_id=t.complaint_id,
                        event_type=t.event_type,
                        actor_name=t.actor_name,
                        actor_role=t.actor_role,
                        message=t.message,
                        created_at=t.created_at,
                    )
                    for t in timeline_sorted
                ],
            )
        )
    return output


@router.get("/{complaint_id}/timeline", response_model=list[TimelineEventResponse])
async def get_complaint_timeline(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[TimelineEventResponse]:
    """Fetch chronological event timeline for a complaint."""
    stmt = (
        select(ComplaintTimelineEvent)
        .where(ComplaintTimelineEvent.complaint_id == complaint_id)
        .order_by(ComplaintTimelineEvent.id.asc())
    )
    res = await db.execute(stmt)
    events = res.scalars().all()
    return list(events)


@router.post("/{complaint_id}/resolve")
async def resolve_complaint_endpoint(
    complaint_id: int,
    payload: ComplaintResolveRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Resolve a complaint with mandatory resolution notes, update work order costs, log timeline event, and notify complainant."""
    now_str = _format_now()

    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    labor_cost = payload.labor_cost or 0
    parts_cost = payload.parts_cost or 0
    other_cost = payload.other_cost or 0
    total_cost = labor_cost + parts_cost + other_cost

    complaint.status = "RESOLVED"
    complaint.work_order_status = "Completed"
    complaint.public_resolution_notes = payload.resolution_notes
    complaint.internal_admin_notes = payload.internal_admin_notes
    complaint.assigned_technician_id = payload.assigned_technician_id
    complaint.assigned_technician_name = payload.assigned_technician_name
    complaint.labor_cost = labor_cost
    complaint.parts_cost = parts_cost
    complaint.other_cost = other_cost
    complaint.total_actual_cost = total_cost
    complaint.resolved_at = now_str
    complaint.updated_at = now_str

    # Update technician record if applicable
    if payload.assigned_technician_id:
        tech_stmt = select(TechnicianStaff).where(TechnicianStaff.id == payload.assigned_technician_id)
        tech_res = await db.execute(tech_stmt)
        tech = tech_res.scalar_one_or_none()
        if tech:
            tech.total_jobs_completed += 1
            tech.total_earnings += labor_cost
            tech.status = "Available"

    # Add timeline event
    evt_resolved = ComplaintTimelineEvent(
        complaint_id=complaint.id,
        event_type="RESOLVED",
        actor_name=payload.assigned_technician_name or "Facility Operations",
        actor_role="Admin",
        message=f"Resolved: {payload.resolution_notes}",
        created_at=now_str,
    )
    db.add(evt_resolved)

    # Sync Knowledge Base record
    mr_stmt = select(MaintenanceRecord).where(
        (MaintenanceRecord.equipment_id == f"WO-{complaint_id:04d}")
        | (MaintenanceRecord.complaint == complaint.raw_complaint)
        | (MaintenanceRecord.id == complaint_id)
    )
    mr_res = await db.execute(mr_stmt)
    linked_rec = mr_res.scalars().first()
    if linked_rec:
        linked_rec.status = "RESOLVED"
        linked_rec.technician_notes = f"Resolution: {payload.resolution_notes} | Cost: ₹{total_cost}"

    # Notification to user
    if complaint.reporter_phone:
        user_notif = Notification(
            title=f"Complaint #{complaint.tracking_code or complaint.id} Resolved",
            message=f"Work completed: {payload.resolution_notes}",
            complaint_id=complaint.id,
            recipient_phone=complaint.reporter_phone,
            created_at=now_str,
        )
        db.add(user_notif)

    await db.commit()

    # Broadcast event
    await event_bus.broadcast_event(
        "complaint.resolved",
        {
            "complaint_id": complaint.id,
            "tracking_code": complaint.tracking_code,
            "status": "RESOLVED",
            "resolution_notes": payload.resolution_notes,
            "reporter_phone": complaint.reporter_phone,
        },
    )

    return {
        "success": True,
        "complaint_id": complaint.id,
        "tracking_code": complaint.tracking_code,
        "status": "RESOLVED",
        "total_actual_cost": total_cost,
        "message": f"Complaint #{complaint.tracking_code or complaint.id} resolved successfully.",
    }


@router.post("/{complaint_id}/reopen")
async def reopen_complaint_endpoint(
    complaint_id: int,
    payload: ComplaintReopenRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reopen an unresolved or recurring complaint, log timeline event, and notify operations team."""
    now_str = _format_now()

    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.status = "REOPENED"
    complaint.work_order_status = "Reopened for Inspection"
    complaint.updated_at = now_str

    # Add timeline event
    evt_reopened = ComplaintTimelineEvent(
        complaint_id=complaint.id,
        event_type="REOPENED",
        actor_name=payload.actor_name or "Complainant",
        actor_role="User",
        message=f"Reopened by user: {payload.reason}",
        created_at=now_str,
    )
    db.add(evt_reopened)

    # Add admin notification
    admin_notif = Notification(
        title=f"Complaint #{complaint.tracking_code or complaint.id} Reopened",
        message=f"Reason: {payload.reason}",
        complaint_id=complaint.id,
        recipient_phone=None,
        created_at=now_str,
    )
    db.add(admin_notif)

    await db.commit()

    # Broadcast event
    await event_bus.broadcast_event(
        "complaint.reopened",
        {
            "complaint_id": complaint.id,
            "tracking_code": complaint.tracking_code,
            "status": "REOPENED",
            "reason": payload.reason,
            "reporter_phone": complaint.reporter_phone,
        },
    )

    return {
        "success": True,
        "complaint_id": complaint.id,
        "tracking_code": complaint.tracking_code,
        "status": "REOPENED",
        "message": f"Complaint #{complaint.tracking_code or complaint.id} reopened for further inspection.",
    }


@router.patch("/{complaint_id}/status")
@router.put("/{complaint_id}/status")
async def update_complaint_status(
    complaint_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update status, technician assignment, or work order progress with timeline logging."""
    now_str = _format_now()

    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = complaint.status
    if "status" in payload:
        complaint.status = str(payload["status"]).upper()
    if "work_order_status" in payload:
        complaint.work_order_status = str(payload["work_order_status"])
    if "assigned_technician_id" in payload:
        complaint.assigned_technician_id = payload["assigned_technician_id"]
    if "assigned_technician_name" in payload:
        complaint.assigned_technician_name = payload["assigned_technician_name"]

    complaint.updated_at = now_str

    # Create timeline event for stage changes
    event_type = complaint.status if complaint.status in ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] else "STATUS_UPDATED"
    msg = f"Status changed from {old_status} to {complaint.status}."
    if complaint.assigned_technician_name:
        msg += f" Technician: {complaint.assigned_technician_name}."

    evt = ComplaintTimelineEvent(
        complaint_id=complaint.id,
        event_type=event_type,
        actor_name="Facility Administrator",
        actor_role="Admin",
        message=msg,
        created_at=now_str,
    )
    db.add(evt)

    # Sync Knowledge Base
    mr_stmt = select(MaintenanceRecord).where(
        (MaintenanceRecord.equipment_id == f"WO-{complaint_id:04d}")
        | (MaintenanceRecord.complaint == complaint.raw_complaint)
        | (MaintenanceRecord.id == complaint_id)
    )
    mr_res = await db.execute(mr_stmt)
    linked_rec = mr_res.scalars().first()
    if linked_rec:
        linked_rec.status = complaint.status

    await db.commit()

    # Broadcast event
    await event_bus.broadcast_event(
        "complaint.status_changed",
        {
            "complaint_id": complaint.id,
            "tracking_code": complaint.tracking_code,
            "status": complaint.status,
            "work_order_status": complaint.work_order_status,
            "reporter_phone": complaint.reporter_phone,
        },
    )

    return {
        "success": True,
        "complaint_id": complaint_id,
        "status": complaint.status,
        "work_order_status": complaint.work_order_status,
        "tracking_code": complaint.tracking_code,
    }


@router.get("/{complaint_id}/decision", response_model=DecisionReportResponse)
async def get_complaint_decision(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
) -> DecisionReportResponse:
    """Retrieve full decision report, diagnosis, repair steps, and agent audit logs."""
    stmt = select(Complaint).where(Complaint.id == complaint_id)
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    diag_stmt = select(Diagnosis).where(Diagnosis.complaint_id == complaint_id)
    diag_res = await db.execute(diag_stmt)
    diag = diag_res.scalar_one_or_none()

    rec_stmt = select(Recommendation).where(Recommendation.complaint_id == complaint_id)
    rec_res = await db.execute(rec_stmt)
    rec = rec_res.scalar_one_or_none()

    runs_stmt = select(AgentRun).where(AgentRun.complaint_id == complaint_id)
    runs_res = await db.execute(runs_stmt)
    runs = runs_res.scalars().all()

    fb_stmt = select(TechnicianFeedback).where(TechnicianFeedback.complaint_id == complaint_id)
    fb_res = await db.execute(fb_stmt)
    feedback = fb_res.scalar_one_or_none()

    analysis_out = ComplaintAnalysisOutput(
        equipment_type=complaint.equipment_type or "General Facility",
        equipment_id=complaint.equipment_id or "N/A",
        location=complaint.location or "Campus",
        symptoms=complaint.symptoms or complaint.raw_complaint,
        severity=complaint.severity,
        operational_impact="",
        keywords=[],
    )

    possible_causes = (
        json.loads(diag.possible_causes_json) if diag and diag.possible_causes_json else []
    )
    supporting_cases = (
        json.loads(diag.supporting_cases_json) if diag and diag.supporting_cases_json else []
    )

    diag_out = DiagnosisOutput(
        primary_cause=diag.primary_cause if diag else "Under investigation",
        possible_causes=possible_causes,
        confidence_level=diag.confidence_level if diag else "Moderate Evidence",
        supporting_cases=supporting_cases,
        reasoning_summary=diag.reasoning_summary if diag else "",
        is_fallback=diag.is_fallback if diag else False,
    )

    repair_steps = json.loads(rec.repair_steps_json) if rec and rec.repair_steps_json else []
    tools = json.loads(rec.required_tools_json) if rec and rec.required_tools_json else []
    parts = json.loads(rec.replacement_parts_json) if rec and rec.replacement_parts_json else []

    rec_out = RecommendationOutput(
        action=rec.action if rec else "Inspection required",
        repair_steps=repair_steps,
        estimated_cost_min=rec.estimated_cost_min if rec else 1000,
        estimated_cost_max=rec.estimated_cost_max if rec else 2500,
        repair_time_hours=rec.repair_time_hours if rec else 1.5,
        urgency=rec.urgency if rec else complaint.severity,
        technician_required=rec.technician_required if rec else "Technician",
        required_tools=tools,
        replacement_parts=parts,
    )

    exp_out = ExplanationOutput(
        explanation_points=rec.explanation_text.split("\n") if rec and rec.explanation_text else [],
        full_text=rec.explanation_text if rec else "",
    )

    agent_run_items = [
        AgentRunItem(
            agent_name=r.agent_name,
            status=r.status,
            execution_time_ms=r.execution_time_ms,
            output_summary=r.output_summary,
        )
        for r in runs
    ]

    from backend.app.rag.retriever import retriever

    similar_raw = await retriever.retrieve_similar_cases(
        query=complaint.symptoms or complaint.raw_complaint,
        equipment_type=complaint.equipment_type,
        top_k=6,
    )
    similar_cases = [SimilarCaseItem(**c) for c in similar_raw]

    fb_data = None
    if feedback:
        fb_data = {
            "accepted": feedback.accepted,
            "technician_name": feedback.technician_name,
            "technician_feedback": feedback.technician_feedback,
            "corrected_diagnosis": feedback.corrected_diagnosis,
            "appended_to_kb": feedback.appended_to_kb,
        }

    return DecisionReportResponse(
        complaint_id=complaint.id,
        raw_complaint=complaint.raw_complaint,
        status=complaint.status,
        created_at=complaint.created_at,
        analysis=analysis_out,
        similar_cases=similar_cases,
        diagnosis=diag_out,
        recommendation=rec_out,
        explanation=exp_out,
        agent_runs=agent_run_items,
        is_fallback=diag_out.is_fallback,
        human_verified=feedback is not None,
        technician_feedback=fb_data,
    )


@router.post("/{complaint_id}/rating")
async def rate_diagnosis_accuracy(
    complaint_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Record user accuracy feedback (thumbs up = 1, thumbs down = -1)."""
    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    rating = int(payload.get("rating", 1))
    complaint.accuracy_rating = rating
    await db.commit()
    return {
        "success": True,
        "complaint_id": complaint_id,
        "accuracy_rating": rating,
        "message": "Diagnosis accuracy feedback recorded to refine model confidence.",
    }


@router.delete("/{complaint_id}")
async def delete_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a complaint and all associated child work order and diagnosis records."""
    from sqlalchemy import delete

    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    await db.execute(delete(ComplaintTimelineEvent).where(ComplaintTimelineEvent.complaint_id == complaint_id))
    await db.execute(delete(Notification).where(Notification.complaint_id == complaint_id))
    await db.execute(delete(TechnicianFeedback).where(TechnicianFeedback.complaint_id == complaint_id))
    await db.execute(delete(AgentRun).where(AgentRun.complaint_id == complaint_id))
    await db.execute(delete(Recommendation).where(Recommendation.complaint_id == complaint_id))
    await db.execute(delete(Diagnosis).where(Diagnosis.complaint_id == complaint_id))
    await db.delete(complaint)
    await db.commit()

    return {"success": True, "message": f"Complaint #{complaint_id} removed from active register."}


@router.post("/batch-delete")
async def batch_delete_complaints(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Delete selected list of complaints and their associated work order records."""
    from sqlalchemy import delete

    ids = payload.get("complaint_ids", [])
    if not ids:
        return {"success": True, "deleted_count": 0, "message": "No complaint IDs provided"}

    id_list = [int(i) for i in ids]
    await db.execute(delete(ComplaintTimelineEvent).where(ComplaintTimelineEvent.complaint_id.in_(id_list)))
    await db.execute(delete(Notification).where(Notification.complaint_id.in_(id_list)))
    await db.execute(delete(TechnicianFeedback).where(TechnicianFeedback.complaint_id.in_(id_list)))
    await db.execute(delete(AgentRun).where(AgentRun.complaint_id.in_(id_list)))
    await db.execute(delete(Recommendation).where(Recommendation.complaint_id.in_(id_list)))
    await db.execute(delete(Diagnosis).where(Diagnosis.complaint_id.in_(id_list)))
    await db.execute(delete(Complaint).where(Complaint.id.in_(id_list)))
    await db.commit()

    return {
        "success": True,
        "deleted_count": len(id_list),
        "message": f"Successfully deleted {len(id_list)} selected complaint(s).",
    }


@router.delete("")
@router.delete("/")
@router.post("/clear")
@router.post("/hard-reset")
@router.delete("/hard-reset")
async def clear_all_complaints(
    db: AsyncSession = Depends(get_db),
):
    """Clear all active complaints, work orders, timeline events, and reset sequence counter."""
    from sqlalchemy import delete, text

    await db.execute(delete(Notification))
    await db.execute(delete(ComplaintTimelineEvent))
    await db.execute(delete(TechnicianFeedback))
    await db.execute(delete(AgentRun))
    await db.execute(delete(Recommendation))
    await db.execute(delete(Diagnosis))
    await db.execute(delete(Complaint))

    with contextlib.suppress(Exception):
        await db.execute(
            text(
                "DELETE FROM sqlite_sequence WHERE name IN ('complaints', 'diagnoses', 'recommendations', 'agent_runs', 'technician_feedback', 'complaint_timeline_events', 'notifications')"
            )
        )

    await db.commit()
    return {
        "success": True,
        "message": "All complaints, work orders, timeline events, and notifications cleared.",
    }
