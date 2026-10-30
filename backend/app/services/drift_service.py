"""TraceBack AI - Sensor Drift Service

Calculates standardized sensor deviations, rolling smoothed drift, drift rates,
threshold crossings, and sustained anomaly flags.
"""
from pathlib import Path
from typing import Dict, Any
import pandas as pd
import numpy as np
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.core.config import settings
from backend.app.core.logging import logger


class DriftService:
    def __init__(self, db: DatabaseManager = db_manager):
        self.db = db

    def compute_drift(
        self,
        dataset_id: str = "NASA_FD001",
        drift_window: int = 15,
        baseline_version: str = "v1.0",
        calculation_version: str = "v1.0"
    ) -> Dict[str, Any]:
        """Calculates and stores drift metrics for all machine cycles."""
        logger.info(f"Computing sensor drift for dataset '{dataset_id}' with window {drift_window}...")

        if not self.db.is_mock:
            # Execute pure Exasol SQL script with integer window constants
            sql_file = Path(__file__).parent.parent / "analytics" / "queries" / "drift.sql"
            with open(sql_file, "r", encoding="utf-8") as f:
                sql_query = f.read()

            formatted_sql = sql_query.replace(":drift_window_preceding", str(max(1, drift_window - 1)))
            formatted_sql = formatted_sql.replace(":drift_window_lag", str(max(1, drift_window)))

            self.db.execute(formatted_sql, {
                "dataset_id": dataset_id,
                "drift_window": drift_window,
                "baseline_version": baseline_version,
                "calculation_version": calculation_version
            })
            count_df = self.db.export_to_pandas(
                "SELECT COUNT(*) AS total FROM SENSOR_DRIFT WHERE calculation_version = :ver",
                {"ver": calculation_version}
            )
            total = int(count_df.iloc[0]["total"]) if not count_df.empty else 0
            return {"status": "SUCCESS", "drift_records_calculated": total, "engine": "Exasol SQL"}

        # In Mock Mode: Compute with Pandas & save
        readings_df = self.db.export_to_pandas(
            "SELECT * FROM MACHINE_READINGS WHERE dataset_id = :ds ORDER BY machine_id, cycle ASC",
            {"ds": dataset_id}
        )
        baselines_df = self.db.export_to_pandas(
            "SELECT * FROM MACHINE_BASELINES WHERE baseline_version = :ver",
            {"ver": baseline_version}
        )

        if readings_df.empty or baselines_df.empty:
            logger.warning("Missing readings or baselines for drift computation.")
            return {"status": "NO_DATA", "drift_records_calculated": 0}

        # Build baseline lookup: (machine_id, sensor_name) -> (mean, std, is_valid)
        b_lookup = {}
        for _, r in baselines_df.iterrows():
            b_lookup[(str(r["machine_id"]), str(r["sensor_name"]))] = (
                float(r["baseline_mean"]),
                float(r["baseline_std"]),
                bool(r["is_valid"])
            )

        sensor_cols = [f"s{i}" for i in range(1, 22)]
        drift_records = []

        for mid, group in readings_df.groupby("machine_id"):
            group = group.sort_values("cycle").reset_index(drop=True)
            cycles = group["cycle"].tolist()

            for s in sensor_cols:
                b_info = b_lookup.get((str(mid), s))
                if not b_info or not b_info[2]:  # If invalid or constant, skip or flag 0
                    continue

                b_mean, b_std, is_valid = b_info
                raw_values = group[s].values
                # Standardized deviation
                norm_devs = (raw_values - b_mean) / b_std
                # Rolling smoothed deviation
                series = pd.Series(norm_devs)
                smooth_devs = series.rolling(window=drift_window, min_periods=1).mean().values
                # Drift rate
                lagged = series.shift(drift_window).values
                drift_rates = np.where(np.isnan(lagged), 0.0, (smooth_devs - lagged) / float(drift_window))
                # Anomaly hits
                anomaly_hits = (np.abs(norm_devs) >= 2.0).astype(int)
                sustained_counts = pd.Series(anomaly_hits).rolling(window=7, min_periods=1).sum().values

                for i in range(len(cycles)):
                    s_dev = float(smooth_devs[i])
                    anom_score = float(np.abs(s_dev))
                    crossed = bool(anom_score >= 2.5)
                    sustained = bool(sustained_counts[i] >= 5)

                    drift_records.append({
                        "machine_id": str(mid),
                        "cycle": int(cycles[i]),
                        "sensor_name": s,
                        "raw_value": float(raw_values[i]),
                        "normalised_deviation": float(norm_devs[i]),
                        "smoothed_deviation": s_dev,
                        "drift_rate": float(drift_rates[i]),
                        "anomaly_score": anom_score,
                        "threshold_crossed": 1 if crossed else 0,
                        "is_sustained": 1 if sustained else 0,
                        "calculation_version": calculation_version,
                        "dataset_id": dataset_id
                    })

        drift_df = pd.DataFrame(drift_records)
        self.db.execute("DELETE FROM SENSOR_DRIFT WHERE calculation_version = :ver", {"ver": calculation_version})
        self.db.import_from_pandas(drift_df, "SENSOR_DRIFT")

        logger.info(f"Mock Engine computed {len(drift_df)} drift records across {readings_df['machine_id'].nunique()} machines.")
        return {"status": "SUCCESS", "drift_records_calculated": len(drift_df), "engine": "Mock Engine"}
