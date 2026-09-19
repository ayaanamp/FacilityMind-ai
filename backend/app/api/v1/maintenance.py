"""Maintenance history, equipment, and locations catalog endpoints."""

from backend.app.database.session import get_db
from backend.app.models.maintenance import MaintenanceRecord
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["Maintenance Records & Facilities"])


@router.get("/maintenance")
async def list_maintenance_records(
    search: str | None = None,
    equipment_type: str | None = None,
    location: str | None = None,
    urgency: str | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Search and filter historical maintenance records."""
    stmt = select(MaintenanceRecord).order_by(desc(MaintenanceRecord.id))

    if equipment_type:
        stmt = stmt.where(MaintenanceRecord.equipment_type == equipment_type)
    if location:
        stmt = stmt.where(MaintenanceRecord.location == location)
    if urgency:
        stmt = stmt.where(MaintenanceRecord.urgency == urgency)
    if status:
        stmt = stmt.where(MaintenanceRecord.status == status)
    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            MaintenanceRecord.complaint.ilike(search_pattern)
            | MaintenanceRecord.symptoms.ilike(search_pattern)
            | MaintenanceRecord.diagnosis.ilike(search_pattern)
            | MaintenanceRecord.root_cause.ilike(search_pattern)
            | MaintenanceRecord.equipment_id.ilike(search_pattern)
            | MaintenanceRecord.location.ilike(search_pattern)
            | MaintenanceRecord.equipment_type.ilike(search_pattern)
            | MaintenanceRecord.technician_notes.ilike(search_pattern)
            | MaintenanceRecord.technician_type.ilike(search_pattern)
            | MaintenanceRecord.status.ilike(search_pattern)
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_res = await db.execute(count_stmt)
    total_count = total_res.scalar() or 0

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()

    return {
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "records": [
            {
                "id": r.id,
                "equipment_type": r.equipment_type,
                "equipment_id": r.equipment_id,
                "location": r.location,
                "complaint": r.complaint,
                "symptoms": r.symptoms,
                "diagnosis": r.diagnosis,
                "root_cause": r.root_cause,
                "recommended_fix": r.recommended_fix,
                "estimated_cost": r.estimated_cost,
                "repair_time": r.repair_time,
                "urgency": r.urgency,
                "technician_type": r.technician_type,
                "date": r.date,
                "technician_notes": r.technician_notes,
                "status": r.status,
            }
            for r in records
        ],
    }


@router.post("/maintenance/records")
async def create_maintenance_record(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Add a new equipment maintenance case / procedure into the Knowledge Base and vector index."""
    import datetime

    from backend.app.rag.embeddings import embedding_service
    from backend.app.rag.vector_store import vector_store

    date_str = payload.get("date") or datetime.date.today().isoformat()
    record = MaintenanceRecord(
        equipment_type=payload.get("equipment_type", "General Hardware"),
        equipment_id=payload.get("equipment_id", "HW-NEW"),
        location=payload.get("location", "Campus Facility"),
        complaint=payload.get("complaint", "General hardware failure"),
        symptoms=payload.get("symptoms", "Operational disruption"),
        diagnosis=payload.get("diagnosis", "Hardware component inspection required"),
        root_cause=payload.get("root_cause", "Physical wear or electrical instability"),
        recommended_fix=payload.get("recommended_fix", "Inspect, test, and repair/replace damaged module"),
        estimated_cost=int(payload.get("estimated_cost", 1500)),
        repair_time=float(payload.get("repair_time", 1.5)),
        urgency=payload.get("urgency", "Medium"),
        technician_type=payload.get("technician_type", "Hardware Specialist"),
        date=date_str,
        technician_notes=payload.get("technician_notes", "Registered via Knowledge Base Manager"),
        status="Resolved",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # Dynamic RAG Vector Indexing
    embed_text = f"{record.equipment_type} {record.complaint} {record.symptoms} {record.diagnosis} {record.root_cause}"
    emb = await embedding_service.get_embedding(embed_text)
    vector_store.add_document(
        doc_id=record.id,
        text=embed_text,
        embedding=emb,
        metadata={
            "id": record.id,
            "equipment_type": record.equipment_type,
            "equipment_id": record.equipment_id,
            "location": record.location,
            "complaint": record.complaint,
            "symptoms": record.symptoms,
            "diagnosis": record.diagnosis,
            "root_cause": record.root_cause,
            "recommended_fix": record.recommended_fix,
            "estimated_cost": record.estimated_cost,
            "repair_time": record.repair_time,
            "urgency": record.urgency,
            "technician_type": record.technician_type,
            "date": record.date,
            "technician_notes": record.technician_notes,
            "status": record.status,
        },
    )
    vector_store.save()

    return {
        "success": True,
        "record_id": record.id,
        "message": f"Successfully added {record.equipment_type} case #{record.id} to Knowledge Base and Vector Index.",
        "record": {
            "id": record.id,
            "equipment_type": record.equipment_type,
            "equipment_id": record.equipment_id,
            "location": record.location,
            "complaint": record.complaint,
            "symptoms": record.symptoms,
            "diagnosis": record.diagnosis,
            "root_cause": record.root_cause,
            "recommended_fix": record.recommended_fix,
            "estimated_cost": record.estimated_cost,
            "repair_time": record.repair_time,
            "urgency": record.urgency,
            "technician_type": record.technician_type,
            "date": record.date,
            "technician_notes": record.technician_notes,
            "status": record.status,
        },
    }



@router.get("/maintenance/{record_id}")
async def get_maintenance_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve single historical maintenance record details."""
    stmt = select(MaintenanceRecord).where(MaintenanceRecord.id == record_id)
    result = await db.execute(stmt)
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    return {
        "id": r.id,
        "equipment_type": r.equipment_type,
        "equipment_id": r.equipment_id,
        "location": r.location,
        "complaint": r.complaint,
        "symptoms": r.symptoms,
        "diagnosis": r.diagnosis,
        "root_cause": r.root_cause,
        "recommended_fix": r.recommended_fix,
        "estimated_cost": r.estimated_cost,
        "repair_time": r.repair_time,
        "urgency": r.urgency,
        "technician_type": r.technician_type,
        "date": r.date,
        "technician_notes": r.technician_notes,
        "status": r.status,
    }


@router.get("/equipment")
async def get_equipment_categories(db: AsyncSession = Depends(get_db)):
    """List unique equipment categories and active asset count."""
    stmt = (
        select(MaintenanceRecord.equipment_type, func.count(MaintenanceRecord.id))
        .group_by(MaintenanceRecord.equipment_type)
        .order_by(MaintenanceRecord.equipment_type)
    )
    res = await db.execute(stmt)
    items = [{"type": row[0], "count": row[1]} for row in res.all()]
    return items


@router.get("/locations")
async def get_locations(db: AsyncSession = Depends(get_db)):
    """List unique facility locations."""
    stmt = (
        select(MaintenanceRecord.location, func.count(MaintenanceRecord.id))
        .group_by(MaintenanceRecord.location)
        .order_by(MaintenanceRecord.location)
    )
    res = await db.execute(stmt)
    items = [{"location": row[0], "count": row[1]} for row in res.all()]
    return items


@router.delete("/maintenance/records/{record_id}")
async def delete_maintenance_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a maintenance record from database and vector index."""
    from backend.app.rag.vector_store import vector_store

    stmt = select(MaintenanceRecord).where(MaintenanceRecord.id == record_id)
    res = await db.execute(stmt)
    rec = res.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    await db.delete(rec)
    await db.commit()

    # Remove from vector index
    vector_store.documents = [d for d in vector_store.documents if d["id"] != record_id]
    vector_store.save()

    return {"success": True, "message": f"Successfully deleted record #{record_id}"}


@router.patch("/maintenance/records/{record_id}/status")
@router.post("/maintenance/records/{record_id}/resolve")
async def update_maintenance_record_status(
    record_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update status (e.g. mark as Resolved / Completed) for a maintenance record and synchronize linked Command Center work order."""
    import re

    from backend.app.models.maintenance import Complaint
    from backend.app.rag.vector_store import vector_store

    stmt = select(MaintenanceRecord).where(MaintenanceRecord.id == record_id)
    res = await db.execute(stmt)
    rec = res.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    new_status = payload.get("status", "Resolved")
    rec.status = new_status
    if payload.get("technician_notes"):
        rec.technician_notes = payload.get("technician_notes")

    # Bidirectional Sync: Find and update the corresponding active Complaint / Work Order
    linked_complaint = None

    # 1. Search by WO code in equipment_id or technician_notes
    wo_match = None
    if rec.equipment_id and "WO-" in rec.equipment_id:
        wo_match = re.search(r"WO-(\d+)", rec.equipment_id)
    if not wo_match and rec.technician_notes:
        wo_match = re.search(r"WO-(\d+)", rec.technician_notes)

    if wo_match:
        cid = int(wo_match.group(1))
        c_stmt = select(Complaint).where(Complaint.id == cid)
        c_res = await db.execute(c_stmt)
        linked_complaint = c_res.scalar_one_or_none()

    # 2. Match by exact text & location if not found by WO ID
    if not linked_complaint:
        c_stmt = select(Complaint).where(
            Complaint.raw_complaint == rec.complaint,
            Complaint.location == rec.location,
        )
        c_res = await db.execute(c_stmt)
        linked_complaint = c_res.scalars().first()

    # 3. Fallback match by ID
    if not linked_complaint:
        c_stmt = select(Complaint).where(Complaint.id == record_id)
        c_res = await db.execute(c_stmt)
        linked_complaint = c_res.scalar_one_or_none()

    complaint_updated = False
    if linked_complaint:
        if new_status in ["Resolved", "Completed"]:
            linked_complaint.status = "Resolved"
            linked_complaint.work_order_status = "Completed"
        else:
            linked_complaint.status = "In Progress"
            linked_complaint.work_order_status = "In Repair"
        complaint_updated = True

    await db.commit()
    await db.refresh(rec)

    # Update in vector store
    for doc in vector_store.documents:
        if doc["id"] == record_id:
            doc["metadata"]["status"] = new_status
            if payload.get("technician_notes"):
                doc["metadata"]["technician_notes"] = payload.get("technician_notes")
            break
    vector_store.save()

    sync_msg = (
        f"Record #{rec.id} marked as {rec.status} and synchronized with Command Center Work Order #WO-{linked_complaint.id:04d}."
        if (linked_complaint and complaint_updated)
        else f"Record #{rec.id} updated to {rec.status} across Knowledge Base & Vector Index."
    )

    return {
        "success": True,
        "record_id": rec.id,
        "status": rec.status,
        "linked_complaint_id": linked_complaint.id if linked_complaint else None,
        "command_center_synced": complaint_updated,
        "message": sync_msg,
    }



@router.post("/maintenance/records/clear-all")
async def clear_all_maintenance_records(db: AsyncSession = Depends(get_db)):
    """Clear all historical maintenance records and vector store."""
    from backend.app.rag.vector_store import vector_store
    from sqlalchemy import delete

    await db.execute(delete(MaintenanceRecord))
    await db.commit()

    vector_store.documents = []
    vector_store.save()

    return {"success": True, "message": "All maintenance knowledge records deleted."}


@router.post("/maintenance/records/reseed")
async def reseed_maintenance_records(db: AsyncSession = Depends(get_db)):
    """Re-seed full campus maintenance historical cases from CSV into SQLite and vector store."""
    from backend.app.rag.indexing import seed_database_and_index
    from backend.app.rag.vector_store import vector_store
    from sqlalchemy import select

    # Re-index all records from CSV
    count = await seed_database_and_index(db)

    # Get final total
    stmt = select(MaintenanceRecord)
    res = await db.execute(stmt)
    records = res.scalars().all()

    return {
        "success": True,
        "inserted_count": count,
        "total_records": len(records),
        "vector_index_size": len(vector_store.documents),
        "message": f"Successfully re-seeded {len(records)} verified maintenance cases into SQLite and vector catalog.",
    }


