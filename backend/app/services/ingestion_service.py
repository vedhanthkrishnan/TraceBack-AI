"""TraceBack AI - Ingestion Service

Orchestrates data loading, NASA C-MAPSS parsing, idempotency, and audit logging.
"""
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Any, Tuple
import pandas as pd
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.services.data_validation_service import DataValidationService, EXPECTED_READING_COLUMNS
from backend.app.core.logging import logger
from backend.app.core.exceptions import DataValidationError


class IngestionService:
    def __init__(self, db: Optional[DatabaseManager] = None):
        self.db = db or db_manager

    def load_cmapss_file(
        self,
        file_path: str,
        dataset_id: str = "NASA_FD001",
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Loads and ingests a standard space-delimited NASA C-MAPSS run-to-failure file."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Dataset file not found: {file_path}")

        logger.info(f"Reading C-MAPSS dataset from: {file_path}")

        # Compute file checksum
        hasher = hashlib.sha256()
        with open(path, "rb") as f:
            hasher.update(f.read())
        checksum = hasher.hexdigest()[:16]

        # Parse whitespace-delimited C-MAPSS columns
        df = pd.read_csv(
            file_path,
            sep=r"\s+",
            header=None,
            usecols=range(26),
            names=EXPECTED_READING_COLUMNS
        )

        # Standardize machine_id format, e.g., "M101", "M102"
        df["machine_id"] = df["machine_id"].apply(lambda x: f"M{int(x):03d}")
        df["dataset_id"] = dataset_id

        return self.ingest_readings_dataframe(df, source_name=path.name, checksum=checksum, batch_id=batch_id)

    def ingest_readings_dataframe(
        self,
        df: pd.DataFrame,
        source_name: str = "in_memory_dataframe",
        checksum: Optional[str] = None,
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validates and loads sensor readings into MACHINE_READINGS with idempotency."""
        batch_id = batch_id or f"batch_{uuid.uuid4().hex[:8]}"
        dataset_id = str(df["dataset_id"].iloc[0]) if "dataset_id" in df.columns else "CUSTOM"

        # Validate DataFrame
        is_valid, val_metrics = DataValidationService.validate_readings_dataframe(df)
        if not is_valid:
            error_msg = f"Validation failed: {', '.join(val_metrics.get('issues', []))}"
            self._record_batch(batch_id, source_name, checksum, "FAILED", 0, 0, error_msg)
            raise DataValidationError(error_msg, details=val_metrics)

        # Prepare DataFrame with batch_id
        clean_df = df.copy()
        clean_df["batch_id"] = batch_id
        if "dataset_id" not in clean_df.columns:
            clean_df["dataset_id"] = dataset_id

        # Ensure correct column ordering matching schema
        target_cols = EXPECTED_READING_COLUMNS + ["dataset_id", "batch_id"]
        clean_df = clean_df[target_cols]

        logger.info(f"Ingesting {len(clean_df)} rows for {clean_df['machine_id'].nunique()} machines into MACHINE_READINGS...")

        # Record batch start
        self._record_batch(batch_id, source_name, checksum, "PROCESSING", len(clean_df), clean_df["machine_id"].nunique(), "Starting ingestion")

        # Idempotent write: clean up existing records for matching (machine_id, dataset_id) to avoid duplicate primary keys
        try:
            mids = clean_df["machine_id"].unique().tolist()
            # Delete in chunks or delete where dataset matches
            for mid in mids:
                self.db.execute(
                    "DELETE FROM MACHINE_READINGS WHERE machine_id = :mid AND dataset_id = :ds",
                    {"mid": mid, "ds": dataset_id}
                )

            # Bulk import into database
            self.db.import_from_pandas(clean_df, "MACHINE_READINGS")

            # Finalize batch log
            self._record_batch(batch_id, source_name, checksum, "COMPLETED", len(clean_df), len(mids), "Successfully ingested")

            logger.info(f"Batch {batch_id} successfully loaded {len(clean_df)} rows.")

            return {
                "batch_id": batch_id,
                "status": "COMPLETED",
                "rows_loaded": len(clean_df),
                "machines_loaded": len(mids),
                "dataset_id": dataset_id,
                "constant_sensors": val_metrics.get("constant_sensors", [])
            }

        except Exception as exc:
            logger.error(f"Ingestion batch {batch_id} failed: {exc}")
            self._record_batch(batch_id, source_name, checksum, "FAILED", 0, 0, str(exc))
            raise

    def _record_batch(
        self,
        batch_id: str,
        source_name: str,
        checksum: Optional[str],
        status: str,
        rows: int,
        machines: int,
        details: str
    ) -> None:
        """Audits batch execution into INGESTION_BATCHES."""
        try:
            self.db.execute(
                """
                DELETE FROM INGESTION_BATCHES WHERE batch_id = :batch_id;
                """,
                {"batch_id": batch_id}
            )
            self.db.execute(
                """
                INSERT INTO INGESTION_BATCHES (
                    batch_id, source_name, source_checksum, import_status,
                    row_count, machine_count, validation_results, created_at, completed_at
                ) VALUES (
                    :batch_id, :source_name, :checksum, :status,
                    :rows, :machines, :details, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
                """,
                {
                    "batch_id": batch_id,
                    "source_name": source_name,
                    "checksum": checksum or "",
                    "status": status,
                    "rows": rows,
                    "machines": machines,
                    "details": details[:1000]
                }
            )
        except Exception as e:
            logger.warning(f"Could not record ingestion batch audit: {e}")
