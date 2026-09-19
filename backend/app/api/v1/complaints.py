"""Complaints and Decision intake REST API endpoints."""

import contextlib
import json

from backend.app.agents.orchestrator import orchestrator
from backend.app.database.session import get_db
from backend.app.models.maintenance import (
    AgentRun,
    Complaint,
    Diagnosis,
    MaintenanceRecord,
    Recommendation,
    TechnicianFeedback,
)
from backend.app.schemas.agent import (
    AgentRunItem,
    ComplaintAnalysisOutput,
    DiagnosisOutput,
    ExplanationOutput,
    RecommendationOutput,
)
from backend.app.schemas.complaint import ComplaintCreate, ComplaintResponse
from backend.app.schemas.decision import DecisionReportResponse, SimilarCaseItem
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/complaints", tags=["Complaints & Decisions"])


@router.post("", response_model=DecisionReportResponse)
async def create_and_analyze_complaint(
    payload: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
) -> DecisionReportResponse:
    """Submit a complaint and execute the end-to-end multi-agent decision workflow."""
    # 1. Create initial complaint entry in DB
    complaint = Complaint(
        raw_complaint=payload.raw_complaint,
        equipment_type=payload.equipment_type,
        equipment_id=payload.equipment_id,
        location=payload.location,
        severity=payload.severity or "Medium",
        status="Analyzing",
        reporter_name=payload.reporter_name or "Campus Member",
        reporter_dept=payload.reporter_dept or "General Facility",
        noticed_at=payload.noticed_at,
        reporter_phone=payload.reporter_phone,
        work_order_status="Technician Assigned",
    )
    db.add(complaint)
    await db.commit()
    await db.refresh(complaint)

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
    complaint.reporter_name = payload.reporter_name or complaint.reporter_name
    complaint.reporter_phone = payload.reporter_phone or complaint.reporter_phone
    complaint.reporter_dept = payload.reporter_dept or complaint.reporter_dept
    complaint.status = "Analyzed"

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

    # 3. Create linked Knowledge Base MaintenanceRecord so it appears immediately in Knowledge Base & Evidence Explorer
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
        date=complaint.created_at.strftime("%Y-%m-%d") if complaint.created_at else "Today",
        technician_notes=f"Reporter: {complaint.reporter_name} | Phone: {complaint.reporter_phone or 'N/A'} | Dept: {complaint.reporter_dept} | Work Order: WO-{complaint.id:04d}",
        status="Triage Pending",
    )
    db.add(kb_record)

    await db.commit()
    await db.refresh(kb_record)

    # Update vector store search index with new complaint entry so global search & evidence explorer find it immediately
    with contextlib.suppress(Exception):
        from backend.app.rag.embeddings import embedding_service
        from backend.app.rag.vector_store import vector_store

        text_to_embed = f"{complaint.equipment_type} at {complaint.location}: {complaint.raw_complaint} - Cause: {diagnosis.primary_cause} - Fix: {rec.action} - Reporter: {complaint.reporter_name} ({complaint.reporter_phone})"
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
                "date": complaint.created_at.strftime("%Y-%m-%d") if complaint.created_at else "Today",
                "technician_notes": f"Reporter: {complaint.reporter_name} ({complaint.reporter_phone or 'N/A'}) - Dept: {complaint.reporter_dept}",
                "reporter_name": complaint.reporter_name,
                "reporter_phone": complaint.reporter_phone,
                "status": "Triage Pending",
                "complaint_id": complaint.id,
            },
        )
        vector_store.save()

    similar_cases = [SimilarCaseItem(**c) for c in similar_cases_raw]

    return DecisionReportResponse(
        complaint_id=complaint.id,
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
    """Retrieve list of submitted complaints with optional filters."""
    stmt = select(Complaint).order_by(desc(Complaint.created_at))
    if status:
        stmt = stmt.where(Complaint.status == status)
    if equipment_type:
        stmt = stmt.where(Complaint.equipment_type == equipment_type)

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    complaints = result.scalars().all()
    return complaints


@router.get("/{complaint_id}/decision", response_model=DecisionReportResponse)
async def get_complaint_decision(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
) -> DecisionReportResponse:
    """Retrieve full decision report and audit logs for an existing complaint."""
    stmt = select(Complaint).where(Complaint.id == complaint_id)
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Fetch diagnosis
    diag_stmt = select(Diagnosis).where(Diagnosis.complaint_id == complaint_id)
    diag_res = await db.execute(diag_stmt)
    diag = diag_res.scalar_one_or_none()

    # Fetch recommendation
    rec_stmt = select(Recommendation).where(Recommendation.complaint_id == complaint_id)
    rec_res = await db.execute(rec_stmt)
    rec = rec_res.scalar_one_or_none()

    # Fetch agent runs
    runs_stmt = select(AgentRun).where(AgentRun.complaint_id == complaint_id)
    runs_res = await db.execute(runs_stmt)
    runs = runs_res.scalars().all()

    # Fetch feedback
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

    # Retrieve similar cases
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


@router.delete("")
@router.delete("/")
@router.post("/clear")
@router.post("/hard-reset")
@router.delete("/hard-reset")
async def clear_all_complaints(
    db: AsyncSession = Depends(get_db),
):
    """Clear all active complaints, work orders, and diagnoses to reset to a clean zero state with internal counter at 1."""
    from backend.app.models.maintenance import (
        AgentRun,
        Diagnosis,
        Recommendation,
        TechnicianFeedback,
    )
    from sqlalchemy import delete, text

    await db.execute(delete(TechnicianFeedback))
    await db.execute(delete(AgentRun))
    await db.execute(delete(Recommendation))
    await db.execute(delete(Diagnosis))
    await db.execute(delete(Complaint))

    # Reset SQLite autoincrement sequence so next inserted complaint starts at ID #1
    with contextlib.suppress(Exception):
        await db.execute(
            text(
                "DELETE FROM sqlite_sequence WHERE name IN ('complaints', 'diagnoses', 'recommendations', 'agent_runs', 'technician_feedback')"
            )
        )

    await db.commit()

    # Clear custom added documents from vector store index
    with contextlib.suppress(Exception):
        from backend.app.rag.vector_store import vector_store

        vector_store.documents = [d for d in vector_store.documents if d["id"] < 10000]
        vector_store.save()

    return {
        "success": True,
        "message": "All complaints, work orders, and cached metrics cleared. Serial counter reset to #1.",
    }


@router.delete("/{complaint_id}")
async def delete_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a complaint and all associated child work order and diagnosis records."""
    from backend.app.models.maintenance import (
        AgentRun,
        Diagnosis,
        Recommendation,
        TechnicianFeedback,
    )
    from sqlalchemy import delete

    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Safely delete dependent records first
    await db.execute(delete(TechnicianFeedback).where(TechnicianFeedback.complaint_id == complaint_id))
    await db.execute(delete(AgentRun).where(AgentRun.complaint_id == complaint_id))
    await db.execute(delete(Recommendation).where(Recommendation.complaint_id == complaint_id))
    await db.execute(delete(Diagnosis).where(Diagnosis.complaint_id == complaint_id))
    await db.delete(complaint)
    await db.commit()

    # Also remove from vector store if present
    with contextlib.suppress(Exception):
        from backend.app.rag.vector_store import vector_store

        vector_store.documents = [d for d in vector_store.documents if d["id"] != 10000 + complaint_id]
        vector_store.save()

    return {"success": True, "message": f"Complaint #{complaint_id} removed from active register."}


@router.post("/batch-delete")
async def batch_delete_complaints(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Delete selected list of complaints and their associated work order records."""
    from backend.app.models.maintenance import (
        AgentRun,
        Diagnosis,
        Recommendation,
        TechnicianFeedback,
    )
    from sqlalchemy import delete

    ids = payload.get("complaint_ids", [])
    if not ids:
        return {"success": True, "deleted_count": 0, "message": "No complaint IDs provided"}

    id_list = [int(i) for i in ids]
    await db.execute(delete(TechnicianFeedback).where(TechnicianFeedback.complaint_id.in_(id_list)))
    await db.execute(delete(AgentRun).where(AgentRun.complaint_id.in_(id_list)))
    await db.execute(delete(Recommendation).where(Recommendation.complaint_id.in_(id_list)))
    await db.execute(delete(Diagnosis).where(Diagnosis.complaint_id.in_(id_list)))
    await db.execute(delete(Complaint).where(Complaint.id.in_(id_list)))
    await db.commit()

    with contextlib.suppress(Exception):
        from backend.app.rag.vector_store import vector_store

        vector_store.documents = [d for d in vector_store.documents if d["id"] not in [10000 + cid for cid in id_list]]
        vector_store.save()

    return {
        "success": True,
        "deleted_count": len(id_list),
        "message": f"Successfully deleted {len(id_list)} selected complaint(s).",
    }


@router.patch("/{complaint_id}/status")
async def update_complaint_status(
    complaint_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update status or work order progress of a complaint and synchronize Knowledge Base."""
    from backend.app.models.maintenance import MaintenanceRecord
    from backend.app.rag.vector_store import vector_store

    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if "status" in payload:
        complaint.status = str(payload["status"])
    if "work_order_status" in payload:
        complaint.work_order_status = str(payload["work_order_status"])

    # Bidirectional Sync: Update corresponding Knowledge Base maintenance record
    mr_stmt = select(MaintenanceRecord).where(
        (MaintenanceRecord.equipment_id == f"WO-{complaint_id:04d}")
        | (MaintenanceRecord.technician_notes.like(f"%WO-{complaint_id:04d}%"))
        | (MaintenanceRecord.complaint == complaint.raw_complaint)
        | (MaintenanceRecord.id == complaint_id)
    )
    mr_res = await db.execute(mr_stmt)
    linked_rec = mr_res.scalars().first()
    if linked_rec:
        linked_rec.status = complaint.status
        for doc in vector_store.documents:
            if doc["id"] == linked_rec.id:
                doc["metadata"]["status"] = complaint.status
                break
        vector_store.save()

    await db.commit()
    return {
        "success": True,
        "complaint_id": complaint_id,
        "status": complaint.status,
        "work_order_status": complaint.work_order_status,
        "knowledge_base_synced": linked_rec is not None,
    }


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


@router.post("/{complaint_id}/resolve")
async def resolve_complaint_and_settle(
    complaint_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Resolve a work order, assign specific technician worker, and settle labor + parts costs across all views."""
    from backend.app.models.maintenance import MaintenanceRecord, TechnicianStaff
    from backend.app.rag.vector_store import vector_store

    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    tech_id = payload.get("assigned_technician_id")
    tech_name = payload.get("assigned_technician_name")
    labor_cost = int(payload.get("labor_cost", 0))
    parts_cost = int(payload.get("parts_cost", 0))
    total_cost = labor_cost + parts_cost

    complaint.status = "Resolved"
    complaint.work_order_status = "Completed"
    complaint.assigned_technician_id = tech_id
    complaint.assigned_technician_name = tech_name
    complaint.labor_cost = labor_cost
    complaint.parts_cost = parts_cost
    complaint.total_actual_cost = total_cost

    # If technician id provided, update technician's completed jobs and total earnings
    if tech_id:
        tech_stmt = select(TechnicianStaff).where(TechnicianStaff.id == tech_id)
        tech_res = await db.execute(tech_stmt)
        tech = tech_res.scalar_one_or_none()
        if tech:
            tech.total_jobs_completed += 1
            tech.total_earnings += labor_cost
            tech.status = "Available"

    # Bidirectional Sync: Mark linked MaintenanceRecord in Knowledge Base as Resolved
    mr_stmt = select(MaintenanceRecord).where(
        (MaintenanceRecord.equipment_id == f"WO-{complaint_id:04d}")
        | (MaintenanceRecord.technician_notes.like(f"%WO-{complaint_id:04d}%"))
        | (MaintenanceRecord.complaint == complaint.raw_complaint)
        | (MaintenanceRecord.id == complaint_id)
    )
    mr_res = await db.execute(mr_stmt)
    linked_rec = mr_res.scalars().first()
    if linked_rec:
        linked_rec.status = "Resolved"
        if tech_name:
            linked_rec.technician_notes = (
                f"Resolved by {tech_name} (₹{labor_cost} labor) | {linked_rec.technician_notes or ''}"
            )
        for doc in vector_store.documents:
            if doc["id"] == linked_rec.id:
                doc["metadata"]["status"] = "Resolved"
                break
        vector_store.save()

    await db.commit()
    return {
        "success": True,
        "complaint_id": complaint_id,
        "status": "Resolved",
        "work_order_status": "Completed",
        "assigned_technician": tech_name,
        "labor_cost": labor_cost,
        "parts_cost": parts_cost,
        "total_actual_cost": total_cost,
        "knowledge_base_synced": linked_rec is not None,
        "message": f"Work order #{complaint_id} completed and synchronized with Knowledge Base. ₹{labor_cost} labor credited to {tech_name or 'Technician'}.",
    }



@router.get("/search/dossier")
async def search_complaint_dossiers(
    q: str = Query(..., min_length=1, description="Search term for reporter name, phone, room, equipment, or symptoms"),
    db: AsyncSession = Depends(get_db),
):
    """Search live complaints by reporter name, phone number, location, equipment, or keywords."""
    from sqlalchemy.orm import selectinload

    term = f"%{q.lower()}%"
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.diagnosis), selectinload(Complaint.recommendation))
        .where(
            func.lower(func.coalesce(Complaint.reporter_name, "")).like(term)
            | func.lower(func.coalesce(Complaint.reporter_phone, "")).like(term)
            | func.lower(func.coalesce(Complaint.location, "")).like(term)
            | func.lower(func.coalesce(Complaint.reporter_dept, "")).like(term)
            | func.lower(func.coalesce(Complaint.equipment_type, "")).like(term)
            | func.lower(func.coalesce(Complaint.raw_complaint, "")).like(term)
            | func.lower(func.coalesce(Complaint.symptoms, "")).like(term)
            | func.lower(func.coalesce(Complaint.status, "")).like(term)
            | func.lower(func.coalesce(Complaint.work_order_status, "")).like(term)
        )
        .order_by(desc(Complaint.id))
        .limit(20)
    )

    res = await db.execute(stmt)
    complaints = res.scalars().all()

    results = []
    for c in complaints:
        primary_cause = c.diagnosis.primary_cause if c.diagnosis else "Analysis in progress"
        action = c.recommendation.action if c.recommendation else "Diagnosis pending"
        est_cost = (
            int((c.recommendation.estimated_cost_min + c.recommendation.estimated_cost_max) / 2)
            if c.recommendation
            else 0
        )
        results.append(
            {
                "id": c.id,
                "work_order_code": f"WO-{c.id:04d}",
                "reporter_name": c.reporter_name or "Campus Member",
                "reporter_phone": c.reporter_phone or "Not Provided",
                "reporter_dept": c.reporter_dept or "General Facility",
                "location": c.location or "Main Campus",
                "equipment_type": c.equipment_type or "Facility Equipment",
                "noticed_at": c.noticed_at or "Recent",
                "created_at": c.created_at.strftime("%Y-%m-%d %H:%M") if hasattr(c.created_at, "strftime") else str(c.created_at),
                "severity": c.severity or "Medium",
                "status": c.status,
                "work_order_status": c.work_order_status or "Triage Pending",
                "raw_complaint": c.raw_complaint,
                "symptoms": c.symptoms or c.raw_complaint,
                "primary_cause": primary_cause,
                "action_recommended": action,
                "estimated_cost": est_cost,
                "assigned_technician_name": c.assigned_technician_name,
                "assigned_technician_id": c.assigned_technician_id,
                "labor_cost": c.labor_cost or 0,
                "parts_cost": c.parts_cost or 0,
                "total_actual_cost": c.total_actual_cost or 0,
            }
        )

    return {"query": q, "count": len(results), "results": results}

