"""Indexing engine to populate vector store from historical maintenance records."""

import csv
from pathlib import Path

from backend.app.core.logging import logging
from backend.app.models.maintenance import MaintenanceRecord
from backend.app.rag.embeddings import embedding_service
from backend.app.rag.vector_store import vector_store
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("FacilityMind.Indexing")


async def index_record(
    record_id: int,
    equipment_type: str,
    equipment_id: str,
    location: str,
    complaint: str,
    symptoms: str,
    diagnosis: str,
    root_cause: str,
    recommended_fix: str,
    estimated_cost: int,
    repair_time: float,
    urgency: str,
    technician_type: str,
    date: str,
    technician_notes: str,
) -> None:
    """Index a single maintenance record into the vector store."""
    search_text = (
        f"Equipment: {equipment_type} ({equipment_id}) at {location}. "
        f"Complaint: {complaint}. Symptoms: {symptoms}. "
        f"Diagnosis: {diagnosis}. Root cause: {root_cause}. Fix: {recommended_fix}"
    )
    embedding = await embedding_service.get_embedding(search_text)
    metadata = {
        "equipment_type": equipment_type,
        "equipment_id": equipment_id,
        "location": location,
        "complaint": complaint,
        "symptoms": symptoms,
        "diagnosis": diagnosis,
        "root_cause": root_cause,
        "recommended_fix": recommended_fix,
        "estimated_cost": estimated_cost,
        "repair_time": repair_time,
        "urgency": urgency,
        "technician_type": technician_type,
        "date": date,
        "technician_notes": technician_notes,
    }
    vector_store.add_document(
        doc_id=record_id,
        text=search_text,
        embedding=embedding,
        metadata=metadata,
    )


async def build_index_from_db(db: AsyncSession) -> int:
    """Build or refresh vector store from database records."""
    stmt = select(MaintenanceRecord)
    result = await db.execute(stmt)
    records = result.scalars().all()

    for r in records:
        await index_record(
            record_id=r.id,
            equipment_type=r.equipment_type,
            equipment_id=r.equipment_id,
            location=r.location,
            complaint=r.complaint,
            symptoms=r.symptoms,
            diagnosis=r.diagnosis,
            root_cause=r.root_cause,
            recommended_fix=r.recommended_fix,
            estimated_cost=r.estimated_cost,
            repair_time=r.repair_time,
            urgency=r.urgency,
            technician_type=r.technician_type,
            date=r.date,
            technician_notes=r.technician_notes,
        )

    vector_store.save()
    logger.info(f"Vector store indexed with {len(records)} database records.")
    return len(records)


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CSV_PATH = PROJECT_ROOT / "data" / "maintenance_records.csv"


async def seed_database_and_index(db: AsyncSession, csv_path: Path | None = None) -> int:
    """Seed database from CSV and populate vector index."""
    if csv_path is None:
        csv_path = DEFAULT_CSV_PATH

    if not csv_path.exists():
        logger.warning(f"CSV path {csv_path} does not exist.")
        return 0

    # Fetch existing IDs in database
    stmt = select(MaintenanceRecord.id)
    existing_res = await db.execute(stmt)
    existing_ids = set(existing_res.scalars().all())

    inserted_count = 0
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rec_id = int(row["id"])
            if rec_id not in existing_ids:
                record = MaintenanceRecord(
                    id=rec_id,
                    equipment_type=row["equipment_type"],
                    equipment_id=row["equipment_id"],
                    location=row["location"],
                    complaint=row["complaint"],
                    symptoms=row["symptoms"],
                    diagnosis=row["diagnosis"],
                    root_cause=row["root_cause"],
                    recommended_fix=row["recommended_fix"],
                    estimated_cost=int(float(row["estimated_cost"])),
                    repair_time=float(row["repair_time"]),
                    urgency=row["urgency"],
                    technician_type=row.get("technician_type", "Technician"),
                    date=row["date"],
                    technician_notes=row.get("technician_notes", ""),
                    status=row.get("status", "Resolved"),
                )
                db.add(record)
                existing_ids.add(rec_id)
                inserted_count += 1

    if inserted_count > 0:
        await db.commit()
        logger.info(f"Inserted {inserted_count} new maintenance records into database.")

    return await build_index_from_db(db)

