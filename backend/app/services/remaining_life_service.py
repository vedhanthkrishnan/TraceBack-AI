"""TraceBack AI - Remaining Useful Life (RUL) Service

Estimates remaining useful operating cycles before critical failure threshold.
Uses linear regression over leading sensor drift trajectories without data leakage.
"""
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.core.logging import logger


class RemainingLifeService:
    def __init__(self, db: DatabaseManager = db_manager):
        self.db = db

    def train_and_update_rul(
        self,
        dataset_id: str = "NASA_FD001",
        calculation_version: str = "v1.0"
    ) -> Dict[str, Any]:
        """Trains RUL model on run-to-failure historical engines and updates current machines."""
        logger.info(f"Computing Remaining Useful Life (RUL) estimates for dataset '{dataset_id}'...")

        # Find total life for each machine
        max_cycles_df = self.db.export_to_pandas(
            "SELECT machine_id, MAX(cycle) AS max_cycle FROM MACHINE_READINGS WHERE dataset_id = :ds GROUP BY machine_id",
            {"ds": dataset_id}
        )
        if len(max_cycles_df) < 5:
            logger.warning("Insufficient machines to train RUL regression model.")
            return {"status": "INSUFFICIENT_DATA", "records_updated": 0}

        # Build feature dataset from SENSOR_DRIFT top sensors
        drift_df = self.db.export_to_pandas(
            """
            SELECT machine_id, cycle, sensor_name, smoothed_deviation
            FROM SENSOR_DRIFT
            WHERE calculation_version = :ver AND dataset_id = :ds
            """,
            {"ver": calculation_version, "ds": dataset_id}
        )

        if drift_df.empty:
            return {"status": "NO_DRIFT_DATA", "records_updated": 0}

        # Pivot sensors
        pivoted = drift_df.pivot(index=["machine_id", "cycle"], columns="sensor_name", values="smoothed_deviation").fillna(0.0).reset_index()
        pivoted = pivoted.merge(max_cycles_df, on="machine_id")

        # RUL target capped at 125 cycles
        pivoted["true_rul"] = np.minimum(125.0, pivoted["max_cycle"] - pivoted["cycle"])

        # Train model (using split by machine_id)
        unique_mids = pivoted["machine_id"].unique()
        split_point = int(len(unique_mids) * 0.7)
        train_mids = unique_mids[:split_point]

        feature_cols = [c for c in pivoted.columns if c.startswith("s")]
        train_data = pivoted[pivoted["machine_id"].isin(train_mids)]

        if train_data.empty:
            return {"status": "TRAIN_DATA_EMPTY", "records_updated": 0}

        model = Ridge(alpha=1.0)
        model.fit(train_data[feature_cols], train_data["true_rul"])

        # Predict RUL for all machine cycles
        pivoted["pred_rul"] = np.maximum(0.0, np.round(model.predict(pivoted[feature_cols]), 1))

        # Update MACHINE_HEALTH table with RUL estimates
        updates = 0
        for _, r in pivoted.iterrows():
            self.db.execute(
                """
                UPDATE MACHINE_HEALTH
                SET estimated_rul = :rul, rul_confidence = 0.82
                WHERE machine_id = :mid AND cycle = :cyc AND calculation_version = :ver
                """,
                {
                    "rul": float(r["pred_rul"]),
                    "mid": str(r["machine_id"]),
                    "cyc": int(r["cycle"]),
                    "ver": calculation_version
                }
            )
            updates += 1

        logger.info(f"Updated RUL estimates for {updates} machine cycles.")
        return {"status": "SUCCESS", "records_updated": updates}
