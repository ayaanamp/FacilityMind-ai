"""Clean Reset Script for FacilityMind AI.

Purges all operational records, organizations, complaints, technician logs,
and vector embeddings to prepare the repository for a fresh GitHub release.
Preserves all database schemas and tables.
"""

import os
import sqlite3
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "data" / "app.db"
VECTOR_INDEX_PATH = ROOT_DIR / "data" / "vector_index.json"


def reset_database():
    """Reset all database tables while preserving schema."""
    if not DB_PATH.exists():
        print(f"[RESET] Database file {DB_PATH} not found. Nothing to reset.")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    tables = [
        "complaint_timeline_events",
        "notifications",
        "agent_runs",
        "technician_feedback",
        "recommendations",
        "diagnoses",
        "complaints",
        "equipment",
        "technicians",
        "maintenance_records",
        "admin_users",
        "organizations",
    ]

    print("[RESET] Purging all operational data...")
    for table in tables:
        try:
            cur.execute(f"DELETE FROM {table};")
            print(f"  ✓ Cleared table: {table}")
        except sqlite3.OperationalError as e:
            print(f"  - Skipped table {table} (not found or error: {e})")

    # Vacuum database to shrink file size
    conn.commit()
    cur.execute("VACUUM;")
    conn.commit()

    # Verify counts
    print("\n[VERIFY] Post-reset table counts:")
    all_zero = True
    for table in tables:
        try:
            count = cur.execute(f"SELECT COUNT(*) FROM {table};").fetchone()[0]
            print(f"  • {table:<28}: {count}")
            if count != 0:
                all_zero = False
        except Exception:
            pass

    conn.close()

    # Reset vector index file if present
    if VECTOR_INDEX_PATH.exists():
        try:
            VECTOR_INDEX_PATH.unlink()
            print(f"\n[RESET] Deleted vector index cache: {VECTOR_INDEX_PATH.name}")
        except Exception as e:
            print(f"Note removing vector index: {e}")

    if all_zero:
        print("\n✅ Database is 100% clean and ready for fresh organization onboarding.")
    else:
        print("\n⚠️ Some tables still have rows.")


if __name__ == "__main__":
    reset_database()
