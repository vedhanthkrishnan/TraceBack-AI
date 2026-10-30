"""TraceBack AI - End-to-End Analytics Pipeline Worker

Coordinates the full analytics sequence:
1. Baselines -> 2. Drift -> 3. Health -> 4. Root-Cause -> 5. Signatures -> 6. RUL
Enforces locking to prevent concurrent conflicting runs and logs to PIPELINE_RUNS.
"""
import time
import uuid
from typing import Dict, Any, Optional
import pandas as pd
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.services.baseline_service import BaselineService
from backend.app.services.drift_service import DriftService
from backend.app.services.health_service import HealthService
from backend.app.services.root_cause_service import RootCauseService
from backend.app.services.signature_service import SignatureService
from backend.app.services.remaining_life_service import RemainingLifeService
from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.exceptions import PipelineExecutionError
from backend.app.schemas.benchmark import PipelineRunStatus


# Global concurrency lock flag
_PIPELINE_RUNNING = False


class AnalyticsPipelineWorker:
    def __init__(self, db: DatabaseManager = db_manager):
        self.db = db
        self.baseline_service = BaselineService(db)
        self.drift_service = DriftService(db)
        self.health_service = HealthService(db)
        self.root_cause_service = RootCauseService(db)
        self.signature_service = SignatureService(db)
        self.remaining_life_service = RemainingLifeService(db)

    def execute_pipeline(
        self,
        dataset_id: str = "NASA_FD001",
        pipeline_version: str = "v1.0"
    ) -> PipelineRunStatus:
        """Executes the full predictive maintenance pipeline synchronously."""
        global _PIPELINE_RUNNING
        if _PIPELINE_RUNNING:
            raise PipelineExecutionError("Another analytics pipeline run is currently in progress.", status_code=409)

        _PIPELINE_RUNNING = True
        run_id = f"pipe_{uuid.uuid4().hex[:8]}"
        start_time_iso = pd.Timestamp.now().isoformat()
        start_clock = time.perf_counter()

        logger.info(f"=== [STARTING ANALYTICS PIPELINE RUN {run_id}] ===")
        self._record_pipeline_state(run_id, start_time_iso, None, dataset_id, 0, 0, pipeline_version, "STARTED", None, None)

        try:
            # Check row count
            count_df = self.db.export_to_pandas(
                "SELECT COUNT(*) AS total_rows, COUNT(DISTINCT machine_id) AS machine_count FROM MACHINE_READINGS WHERE dataset_id = :ds",
                {"ds": dataset_id}
            )
            if count_df.empty or int(count_df.iloc[0]["total_rows"]) == 0:
                raise PipelineExecutionError(f"No sensor readings found for dataset '{dataset_id}'.")

            total_rows = int(count_df.iloc[0]["total_rows"])
            machine_count = int(count_df.iloc[0]["machine_count"])

            # 1. Compute Baselines
            b_res = self.baseline_service.compute_baselines(
                dataset_id=dataset_id,
                baseline_window=settings.BASELINE_WINDOW,
                baseline_version=pipeline_version
            )

            # 2. Compute Drift
            d_res = self.drift_service.compute_drift(
                dataset_id=dataset_id,
                drift_window=settings.DRIFT_WINDOW,
                baseline_version=pipeline_version,
                calculation_version=pipeline_version
            )

            # 3. Compute Health Scores & Risk Categories
            h_res = self.health_service.compute_health_scores(
                dataset_id=dataset_id,
                baseline_window=settings.BASELINE_WINDOW,
                watch_threshold=settings.WATCH_THRESHOLD,
                critical_threshold=settings.CRITICAL_THRESHOLD,
                calculation_version=pipeline_version
            )

            # 4. Compute Root-Cause Rankings
            rc_res = self.root_cause_service.compute_root_cause_rankings(
                dataset_id=dataset_id,
                baseline_version=pipeline_version,
                calculation_version=pipeline_version,
                ranking_method_version=pipeline_version
            )

            # 5. Extract Failure Signatures & Groups
            sig_res = self.signature_service.extract_and_cluster_signatures(
                dataset_id=dataset_id,
                calculation_version=pipeline_version,
                extraction_version=pipeline_version
            )

            # 6. Train & Assign Remaining Useful Life (RUL)
            rul_res = self.remaining_life_service.train_and_update_rul(
                dataset_id=dataset_id,
                calculation_version=pipeline_version
            )

            duration = time.perf_counter() - start_clock
            end_time_iso = pd.Timestamp.now().isoformat()

            logger.info(f"=== [PIPELINE SUCCESS] Completed in {duration:.2f} seconds ===")
            self._record_pipeline_state(
                run_id, start_time_iso, end_time_iso, dataset_id,
                total_rows, machine_count, pipeline_version, "SUCCESS", None, round(duration, 2)
            )

            return PipelineRunStatus(
                run_id=run_id,
                start_time=start_time_iso,
                end_time=end_time_iso,
                dataset_id=dataset_id,
                rows_processed=total_rows,
                machines_processed=machine_count,
                pipeline_version=pipeline_version,
                status="SUCCESS",
                processing_duration_sec=round(duration, 2)
            )

        except Exception as exc:
            duration = time.perf_counter() - start_clock
            end_time_iso = pd.Timestamp.now().isoformat()
            logger.error(f"Pipeline failed: {exc}")
            self._record_pipeline_state(
                run_id, start_time_iso, end_time_iso, dataset_id,
                0, 0, pipeline_version, "FAILED", str(exc)[:1000], round(duration, 2)
            )
            raise PipelineExecutionError(f"Pipeline run failed: {exc}")

        finally:
            _PIPELINE_RUNNING = False

    def get_latest_status(self) -> Optional[PipelineRunStatus]:
        """Returns the most recent pipeline execution record."""
        df = self.db.export_to_pandas(
            "SELECT * FROM PIPELINE_RUNS ORDER BY start_time DESC LIMIT 1;"
        )
        if df.empty:
            return None
        r = df.iloc[0]
        return PipelineRunStatus(
            run_id=str(r["run_id"]),
            start_time=str(r["start_time"]),
            end_time=str(r["end_time"]) if pd.notnull(r["end_time"]) else None,
            dataset_id=str(r["dataset_id"]),
            rows_processed=int(r["rows_processed"]),
            machines_processed=int(r["machines_processed"]),
            pipeline_version=str(r["pipeline_version"]),
            status=str(r["status"]),
            error_summary=str(r["error_summary"]) if pd.notnull(r["error_summary"]) else None,
            processing_duration_sec=float(r["processing_duration"]) if pd.notnull(r["processing_duration"]) else None
        )

    def _record_pipeline_state(
        self, run_id: str, start_time: str, end_time: Optional[str],
        dataset: str, rows: int, machines: int, ver: str,
        status: str, err: Optional[str], dur: Optional[float]
    ) -> None:
        try:
            self.db.execute("DELETE FROM PIPELINE_RUNS WHERE run_id = :rid", {"rid": run_id})
            self.db.execute(
                """
                INSERT INTO PIPELINE_RUNS (
                    run_id, start_time, end_time, dataset_id,
                    rows_processed, machines_processed, pipeline_version,
                    status, error_summary, processing_duration
                ) VALUES (
                    :rid, :st, :et, :ds, :rows, :mach, :ver, :status, :err, :dur
                );
                """,
                {
                    "rid": run_id, "st": start_time, "et": end_time,
                    "ds": dataset, "rows": rows, "mach": machines,
                    "ver": ver, "status": status, "err": err, "dur": dur
                }
            )
        except Exception as e:
            logger.warning(f"Could not record pipeline status: {e}")
