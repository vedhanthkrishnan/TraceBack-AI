"""TraceBack AI - Exasol Specific Utilities & Constants
"""
from typing import List, Dict, Any
from backend.app.db.connection import db_manager


EXASOL_RESERVED_WORDS = {
    "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING",
    "LIMIT", "JOIN", "ON", "INSERT", "UPDATE", "DELETE", "MERGE"
}


def sanitize_exasol_identifier(identifier: str) -> str:
    """Validates and quotes Exasol identifiers to prevent SQL injection."""
    clean = "".join(c for c in identifier if c.isalnum() or c == "_")
    if clean.upper() in EXASOL_RESERVED_WORDS:
        return f'"{clean}"'
    return clean


def get_exasol_version() -> str:
    """Returns the Exasol database version or mock status."""
    if db_manager.is_mock:
        return "Exasol Mock Engine (Isolated SQLite Fallback)"
    try:
        df = db_manager.export_to_pandas("SELECT PARAM_VALUE FROM SYS.EXA_METADATA WHERE PARAM_NAME = 'EXASOL_VERSION'")
        if not df.empty:
            return str(df.iloc[0]["PARAM_VALUE"])
    except Exception:
        pass
    return "Exasol Personal 7.1+"
