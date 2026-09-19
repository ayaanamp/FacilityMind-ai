"""Database and Vector Store Seeding Script for FacilityMind AI."""

import asyncio
import sys
from pathlib import Path

# Ensure root is on sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.core.logging import logging, setup_logging
from backend.app.database.migration import reconcile_database_schema
from backend.app.database.session import AsyncSessionLocal, engine
from backend.app.rag.indexing import seed_database_and_index

logger = logging.getLogger("FacilityMind.Seed")


async def main():
    """Initialize database tables and seed historical records."""
    setup_logging()
    logger.info("Initializing database schema...")
    async with engine.begin() as conn:
        await conn.run_sync(reconcile_database_schema)

    csv_file = root_dir / "data" / "maintenance_records.csv"
    logger.info(f"Seeding maintenance records from {csv_file}...")

    async with AsyncSessionLocal() as session:
        indexed_count = await seed_database_and_index(session, csv_file)
        logger.info(
            f"[SUCCESS] Database initialized and {indexed_count} records indexed into vector store."
        )


if __name__ == "__main__":
    asyncio.run(main())
