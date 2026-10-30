"""TraceBack AI - Machine Health Index & Risk Classification Service

Calculates multi-sensor composite health scores (0-100) and risk categories.
Avoids false healthy classifications for early cycles by assigning INSUFFICIENT_DATA.
"""
from pathlib import Path
from typing import Dict, Any
import pandas as pd
import numpy as np
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.core.config import settings
from backend.app.core.logging import logger


class HealthService:
    def __init__(self, db: DatabaseManager = db_manager):
        self.db = db

    def compute_health_scores(
        self,
        dataset_id: str = "NASA_FD001",
        baseline_window: int = 30,
        watch_threshold: float = 45.0,
        critical_threshold: float = 75.0,
        calculation_version: str = "v1.0"
    ) -> Dict[str, Any]:
        """Calculates and stores health scores and risk classifications for each machine cycle."""
        logger.info(f"Computing health scores for dataset '{dataset_id}'...")

        if not self.db.is_mock:
            sql_file = Path(__file__).parent.parent / "analytics" / "queries" / "health_scores.sql"
            with open(sql_file, "r", encoding="utf-8") as f:
                sql_query = f.read()

            self.db.execute(sql_query, {
                "dataset_id": dataset_id,
                "baseline_window": baseline_window,
                "watch_threshold": watch_threshold,
                "critical_threshold": critical_threshold,
                "calculation_version": calculation_version
            })
            count_df = self.db.export_to_pandas(
                "SELECT COUNT(*) AS total FROM MACHINE_HEALTH WHERE calculation_version = :ver",
                {"ver": calculation_version}
            )
            total = int(count_df.iloc[0]["total"]) if not count_df.empty else 0
            return {"status": "SUCCESS", "health_scores_calculated": total, "engine": "Exasol SQL"}

        # In Mock Mode
        drift_df = self.db.export_to_pandas(
            "SELECT * FROM SENSOR_DRIFT WHERE calculation_version = :ver AND dataset_id = :ds",
            {"ver": calculation_version, "ds": dataset_id}
        )
        if drift_df.empty:
            logger.warning(f"No drift records found for dataset {dataset_id} to compute health scores.")
            return {"status": "NO_DATA", "health_scores_calculated": 0}

        # Find first sustained anomaly cycle per machine
        sustained_events = drift_df[drift_df["is_sustained"] == 1].groupby("machine_id")["cycle"].min().to_dict()

        health_records = []
        for (mid, cycle), group in drift_df.groupby(["machine_id", "cycle"]):
            c_int = int(cycle)

            # Top 5 anomaly scores
            top5_scores = group["anomaly_score"].nlargest(5).values
            mean_top5 = float(np.mean(top5_scores)) if len(top5_scores) > 0 else 0.0

            # Contributing sensors (sustained or threshold crossed)
            contributing = int(((group["threshold_crossed"] == 1) | (group["is_sustained"] == 1)).sum())

            # Health & Risk scoring
            if c_int < baseline_window:
                health_score = 100.0
                risk_score = 0.0
                risk_cat = "INSUFFICIENT_DATA"
            else:
                # Map mean top 5 z-score to 0-100 risk score (4.0 z-score = 100 risk)
                risk_score = float(min(100.0, max(0.0, (mean_top5 / 4.0) * 100.0)))
                health_score = float(max(0.0, 100.0 - risk_score))

                if risk_score >= critical_threshold:
                    risk_cat = "CRITICAL"
                elif risk_score >= watch_threshold:
                    risk_cat = "WATCH"
                else:
                    risk_cat = "HEALTHY"

            first_sust = sustained_events.get(mid)

            health_records.append({
                "machine_id": str(mid),
                "cycle": c_int,
                "health_score": round(health_score, 2),
                "risk_score": round(risk_score, 2),
                "risk_category": risk_cat,
                "contributing_sensor_count": contributing,
                "first_sustained_anomaly_cycle": int(first_sust) if first_sust is not None else None,
                "estimated_rul": None,
                "rul_confidence": None,
                "calculation_version": calculation_version,
                "dataset_id": dataset_id
            })

        h_df = pd.DataFrame(health_records)
        self.db.execute("DELETE FROM MACHINE_HEALTH WHERE calculation_version = :ver AND dataset_id = :ds", {"ver": calculation_version, "ds": dataset_id})
        self.db.import_from_pandas(h_df, "MACHINE_HEALTH")

        logger.info(f"Mock Engine computed {len(h_df)} health score records.")
        return {"status": "SUCCESS", "health_scores_calculated": len(h_df), "engine": "Mock Engine"}
