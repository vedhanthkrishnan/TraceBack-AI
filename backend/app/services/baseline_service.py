"""TraceBack AI - Baseline Computation Service

Calculates healthy operational baselines per machine and sensor.
Handles near-zero variance safely and identifies constant sensors.
"""
from pathlib import Path
from typing import Dict, Any, List
import pandas as pd
import numpy as np
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.core.config import settings
from backend.app.core.logging import logger


class BaselineService:
    def __init__(self, db: DatabaseManager = db_manager):
        self.db = db

    def compute_baselines(
        self,
        dataset_id: str = "NASA_FD001",
        baseline_window: int = 30,
        baseline_version: str = "v1.0"
    ) -> Dict[str, Any]:
        """Calculates and stores sensor baselines for each machine."""
        logger.info(f"Computing baselines for dataset '{dataset_id}' with window <= {baseline_window} cycles...")

        if not self.db.is_mock:
            # Execute pure Exasol SQL script
            sql_file = Path(__file__).parent.parent / "analytics" / "queries" / "baselines.sql"
            with open(sql_file, "r", encoding="utf-8") as f:
                sql_query = f.read()

            self.db.execute(sql_query, {
                "dataset_id": dataset_id,
                "baseline_window": baseline_window,
                "baseline_version": baseline_version
            })
            count_df = self.db.export_to_pandas(
                "SELECT COUNT(*) AS total FROM MACHINE_BASELINES WHERE baseline_version = :ver",
                {"ver": baseline_version}
            )
            total = int(count_df.iloc[0]["total"]) if not count_df.empty else 0
            return {"status": "SUCCESS", "baselines_calculated": total, "engine": "Exasol SQL"}

        # In Mock Mode: Compute with Pandas & save
        readings_df = self.db.export_to_pandas(
            "SELECT * FROM MACHINE_READINGS WHERE dataset_id = :ds AND cycle <= :win",
            {"ds": dataset_id, "win": baseline_window}
        )
        if readings_df.empty:
            logger.warning(f"No readings found for dataset {dataset_id} within baseline window.")
            return {"status": "NO_DATA", "baselines_calculated": 0}

        sensor_cols = [f"s{i}" for i in range(1, 22)]
        baselines = []

        for mid, group in readings_df.groupby("machine_id"):
            for s in sensor_cols:
                series = group[s].dropna()
                sample_count = len(series)
                if sample_count == 0:
                    continue

                mean_val = float(series.mean())
                std_val = float(series.std(ddof=1)) if sample_count > 1 else 0.000001
                med_val = float(series.median())
                mad_val = float(np.median(np.abs(series - med_val)))

                # Zero variance handling
                is_valid = bool(std_val >= 0.000001)
                safe_std = std_val if is_valid else 0.000001

                baselines.append({
                    "machine_id": str(mid),
                    "sensor_name": s,
                    "sample_count": sample_count,
                    "baseline_mean": mean_val,
                    "baseline_std": safe_std,
                    "baseline_median": med_val,
                    "baseline_mad": mad_val,
                    "baseline_method": "STANDARD_NORMAL",
                    "window_start_cycle": 1,
                    "window_end_cycle": baseline_window,
                    "is_valid": 1 if is_valid else 0,
                    "baseline_version": baseline_version
                })

        b_df = pd.DataFrame(baselines)
        # Clear existing baselines for version
        self.db.execute("DELETE FROM MACHINE_BASELINES WHERE baseline_version = :ver", {"ver": baseline_version})
        self.db.import_from_pandas(b_df, "MACHINE_BASELINES")

        logger.info(f"Mock Engine computed {len(b_df)} baselines across {readings_df['machine_id'].nunique()} machines.")
        return {"status": "SUCCESS", "baselines_calculated": len(b_df), "engine": "Mock Engine"}
