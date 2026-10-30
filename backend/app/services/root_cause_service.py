"""TraceBack AI - Root-Cause Evidence Ranking Service

Ranks sensor signals by explainable contribution metrics:
deviation magnitude, drift rate, persistence, and onset order.
"""
from pathlib import Path
from typing import Dict, Any
import pandas as pd
import numpy as np
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.core.logging import logger


class RootCauseService:
    def __init__(self, db: DatabaseManager = db_manager):
        self.db = db

    def compute_root_cause_rankings(
        self,
        dataset_id: str = "NASA_FD001",
        baseline_version: str = "v1.0",
        calculation_version: str = "v1.0",
        ranking_method_version: str = "v1.0"
    ) -> Dict[str, Any]:
        """Calculates and stores ranked root-cause evidence records for all machine cycles."""
        logger.info(f"Computing root cause rankings for dataset '{dataset_id}'...")

        if not self.db.is_mock:
            sql_file = Path(__file__).parent.parent / "analytics" / "queries" / "root_cause.sql"
            with open(sql_file, "r", encoding="utf-8") as f:
                sql_query = f.read()

            self.db.execute(sql_query, {
                "dataset_id": dataset_id,
                "baseline_version": baseline_version,
                "calculation_version": calculation_version,
                "ranking_method_version": ranking_method_version
            })
            count_df = self.db.export_to_pandas(
                "SELECT COUNT(*) AS total FROM ROOT_CAUSE_EVIDENCE WHERE ranking_method_version = :ver",
                {"ver": ranking_method_version}
            )
            total = int(count_df.iloc[0]["total"]) if not count_df.empty else 0
            return {"status": "SUCCESS", "evidence_records_ranked": total, "engine": "Exasol SQL"}

        # In Mock Mode
        drift_df = self.db.export_to_pandas(
            "SELECT * FROM SENSOR_DRIFT WHERE calculation_version = :ver AND dataset_id = :ds",
            {"ver": calculation_version, "ds": dataset_id}
        )
        baselines_df = self.db.export_to_pandas(
            "SELECT * FROM MACHINE_BASELINES WHERE baseline_version = :ver AND is_valid = 1",
            {"ver": baseline_version}
        )

        if drift_df.empty or baselines_df.empty:
            logger.warning(f"Missing data for dataset {dataset_id} for root cause computation.")
            return {"status": "NO_DATA", "evidence_records_ranked": 0}

        # Build baseline lookup
        b_lookup = {}
        for _, r in baselines_df.iterrows():
            b_lookup[(str(r["machine_id"]), str(r["sensor_name"]))] = (
                float(r["baseline_mean"]),
                float(r["baseline_std"])
            )

        # First sustained onset cycle per (machine_id, sensor_name)
        sust_df = drift_df[drift_df["is_sustained"] == 1]
        first_sust_map = (
            sust_df.groupby(["machine_id", "sensor_name"])["cycle"].min().to_dict()
            if not sust_df.empty else {}
        )

        evidence_records = []
        for (mid, cycle), group in drift_df.groupby(["machine_id", "cycle"]):
            scored_sensors = []
            for _, row in group.iterrows():
                s_name = str(row["sensor_name"])
                b_info = b_lookup.get((str(mid), s_name))
                if not b_info:
                    continue
                b_mean, b_std = b_info

                dev_mag = float(np.abs(row["smoothed_deviation"]))
                drift_rate = float(row["drift_rate"])
                is_sust = bool(row["is_sustained"])
                crossed = bool(row["threshold_crossed"])

                # Contribution score formula
                score = (
                    0.40 * dev_mag +
                    0.30 * abs(drift_rate * 10.0) +
                    0.20 * (2.0 if is_sust else 0.0) +
                    0.10 * (1.0 if crossed else 0.0)
                )

                first_onset = first_sust_map.get((str(mid), s_name))
                explanation = (
                    f"Sensor {s_name} deviated by {dev_mag:.2f} standard deviations from its healthy baseline "
                    f"(mean: {b_mean:.2f}), exhibiting a drift rate of {drift_rate:.4f}/cycle."
                )

                scored_sensors.append({
                    "machine_id": str(mid),
                    "cycle": int(cycle),
                    "sensor_name": s_name,
                    "raw_reading": float(row["raw_value"]),
                    "baseline_mean": b_mean,
                    "baseline_std": b_std,
                    "deviation_magnitude": dev_mag,
                    "drift_rate": drift_rate,
                    "persistence": 10 if is_sust else 1,
                    "contribution_score": round(score, 2),
                    "first_sustained_anomaly_cycle": int(first_onset) if first_onset is not None else None,
                    "evidence_explanation": explanation,
                    "ranking_method_version": ranking_method_version
                })

            # Sort by contribution score descending and assign rank (top 10 per cycle)
            scored_sensors.sort(key=lambda x: x["contribution_score"], reverse=True)
            for idx, item in enumerate(scored_sensors[:10], start=1):
                item["rank"] = idx
                evidence_records.append(item)

        e_df = pd.DataFrame(evidence_records)
        self.db.execute(
            "DELETE FROM ROOT_CAUSE_EVIDENCE WHERE ranking_method_version = :ver AND machine_id IN (SELECT DISTINCT machine_id FROM SENSOR_DRIFT WHERE dataset_id = :ds)",
            {"ver": ranking_method_version, "ds": dataset_id}
        )
        self.db.import_from_pandas(e_df, "ROOT_CAUSE_EVIDENCE")

        logger.info(f"Mock Engine ranked {len(e_df)} root cause evidence records.")
        return {"status": "SUCCESS", "evidence_records_ranked": len(e_df), "engine": "Mock Engine"}
