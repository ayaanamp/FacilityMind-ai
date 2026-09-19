"""Automatic schema reconciliation and lightweight SQLite migrations for FacilityMind AI."""

import logging

from backend.app.database.base import Base
from sqlalchemy import text
from sqlalchemy.engine import Connection

logger = logging.getLogger("FacilityMind.DatabaseMigration")


def reconcile_database_schema(conn: Connection) -> None:
    """Ensure all tables and columns defined in SQLAlchemy models exist in SQLite database."""
    # 1. Create any missing tables
    Base.metadata.create_all(conn)

    # 2. Reconcile columns for each table
    for table_name, table in Base.metadata.tables.items():
        try:
            # Query existing column info from SQLite
            result = conn.execute(text(f"PRAGMA table_info({table_name})"))
            existing_cols = {row[1] for row in result.fetchall()}
            if not existing_cols:
                continue

            for col in table.columns:
                if col.name not in existing_cols:
                    col_type = col.type.compile(conn.dialect)
                    default_clause = ""
                    if col.default is not None and getattr(col.default, "arg", None) is not None:
                        arg = col.default.arg
                        if not callable(arg):
                            if isinstance(arg, str):
                                default_clause = f" DEFAULT '{arg}'"
                            elif isinstance(arg, bool):
                                default_clause = f" DEFAULT {1 if arg else 0}"
                            elif isinstance(arg, (int, float)):
                                default_clause = f" DEFAULT {arg}"

                    alter_query = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_clause}"
                    conn.execute(text(alter_query))
                    logger.info(f"Added missing column '{col.name}' ({col_type}) to table '{table_name}'.")
        except Exception as e:
            logger.warning(f"Schema reconciliation note for table '{table_name}': {e}")
