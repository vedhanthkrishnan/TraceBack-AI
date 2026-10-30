"""TraceBack AI - Exasol Database Connection Manager

Handles real Exasol client connectivity via pyexasol and provides transparent
delegation to isolated local mock engine when configured or offline.
"""
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
import pyexasol
from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.exceptions import DatabaseConnectionError
from backend.app.db.mock_engine import MockExasolEngine


class DatabaseManager:
    """Manages Exasol client connection and lifecycle."""

    def __init__(self):
        self._connection: Optional[pyexasol.ExaConnection] = None
        self._mock_engine: Optional[MockExasolEngine] = None
        self._is_mock_active: bool = False
        self._init_connection()

    def _init_connection(self) -> None:
        """Attempts connection to real Exasol database, or activates mock mode."""
        if settings.MOCK_EXASOL:
            self._activate_mock_engine("Configured via MOCK_EXASOL=true")
            return

        try:
            logger.info(f"Connecting to Exasol instance at DSN '{settings.EXASOL_DSN}'...")
            self._connection = pyexasol.connect(
                dsn=settings.EXASOL_DSN,
                user=settings.EXASOL_USER,
                password=settings.EXASOL_PASSWORD,
                schema=settings.EXASOL_SCHEMA,
                encryption=settings.EXASOL_ENCRYPTION,
                connection_timeout=settings.EXASOL_CONNECTION_TIMEOUT,
                query_timeout=settings.EXASOL_QUERY_TIMEOUT,
                autocommit=True
            )
            self._is_mock_active = False
            logger.info("Successfully connected to Exasol database.")
        except Exception as exc:
            logger.warning(
                f"[DATABASE NOTICE] Could not connect to real Exasol instance ({type(exc).__name__}: {exc}). "
                "Activating isolated local mock engine for development."
            )
            self._activate_mock_engine(str(exc))

    def _activate_mock_engine(self, reason: str) -> None:
        """Initializes isolated mock engine for local testing."""
        self._is_mock_active = True
        self._mock_engine = MockExasolEngine()
        logger.warning(
            f"[MOCK MODE ACTIVE] Running isolated mock engine. Reason: {reason}. "
            "Real Exasol queries will be simulated."
        )

    @property
    def is_mock(self) -> bool:
        """Indicates whether the isolated mock engine is currently serving requests."""
        return self._is_mock_active

    def get_raw_connection(self) -> Any:
        if self._is_mock_active:
            return self._mock_engine.get_connection()
        if not self._connection or not self._connection.is_connected():
            self._init_connection()
        return self._connection

    def ping(self) -> bool:
        """Pings the active database connection."""
        try:
            if self._is_mock_active:
                with self._mock_engine.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT 1")
                    return True
            else:
                if self._connection and self._connection.is_connected():
                    res = self._connection.execute("SELECT 1")
                    return True
                return False
        except Exception as exc:
            logger.error(f"Database ping failed: {exc}")
            return False

    def init_schema(self, schema_file: Optional[str] = None) -> None:
        """Initializes tables using schema.sql."""
        if schema_file is None:
            schema_file = str(Path(__file__).parent / "schema.sql")

        if not os.path.exists(schema_file):
            raise FileNotFoundError(f"Schema file not found at: {schema_file}")

        with open(schema_file, "r", encoding="utf-8") as f:
            sql_content = f.read()

        if self._is_mock_active:
            # Mock engine already initialized SQLite schema
            logger.info("Schema initialized in mock database engine.")
            return

        logger.info(f"Executing schema initialisation script on Exasol: {schema_file}")
        # Execute Exasol statements
        statements = [stmt.strip() for stmt in sql_content.split(";") if stmt.strip()]
        for stmt in statements:
            try:
                self._connection.execute(stmt)
            except Exception as e:
                logger.error(f"Error executing schema statement: {e}\nStatement: {stmt}")
                raise DatabaseConnectionError(f"Failed to execute schema statement: {e}")
        logger.info("Exasol schema initialization completed successfully.")

    def execute(self, query: str, query_params: Optional[Dict[str, Any]] = None) -> Any:
        """Executes a SQL query against Exasol or mock engine."""
        if self._is_mock_active:
            return self._mock_engine.execute(query, query_params)
        try:
            return self._connection.execute(query, query_params)
        except Exception as exc:
            logger.error(f"Exasol query execution error: {exc}\nQuery: {query[:200]}")
            raise DatabaseConnectionError(f"Query execution error: {exc}")

    def export_to_pandas(self, query: str, query_params: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        """Executes query and exports result directly to a Pandas DataFrame."""
        if self._is_mock_active:
            return self._mock_engine.export_to_pandas(query, query_params)
        try:
            return self._connection.export_to_pandas(query, query_params=query_params)
        except Exception as exc:
            logger.error(f"Exasol export to pandas failed: {exc}")
            raise DatabaseConnectionError(f"Export error: {exc}")

    def import_from_pandas(self, df: pd.DataFrame, table_name: str) -> int:
        """Bulk imports a DataFrame into Exasol or mock engine."""
        if self._is_mock_active:
            return self._mock_engine.import_from_pandas(df, table_name)
        try:
            self._connection.import_from_pandas(df, table_name)
            return len(df)
        except Exception as exc:
            logger.error(f"Exasol import from pandas failed: {exc}")
            raise DatabaseConnectionError(f"Import error: {exc}")

    def close(self) -> None:
        """Closes active database connections."""
        if self._connection:
            try:
                self._connection.close()
                logger.info("Exasol connection closed.")
            except Exception as exc:
                logger.warning(f"Error closing Exasol connection: {exc}")


# Global database manager instance
db_manager = DatabaseManager()


def get_db() -> DatabaseManager:
    """FastAPI dependency for accessing the database manager."""
    return db_manager
