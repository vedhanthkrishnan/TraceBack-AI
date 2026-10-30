"""TraceBack AI - Copilot Evidence Retrieval Repository

Supplies grounded, sanitized analytical evidence to the AI Copilot tools.
Ensures zero hallucination by serving real values directly from the database.
"""
from typing import Dict, List, Optional, Any
import pandas as pd
from backend.app.db.connection import DatabaseManager
from backend.app.core.exceptions import MachineNotFoundError


class CopilotRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def get_machine_health(self, machine_id: str) -> Dict[str, Any]:
        """Fetches grounded health indicators for a machine."""
        query = """
        SELECT
            h.machine_id,
            h.cycle,
            h.health_score,
            h.risk_score,
            h.risk_category,
            h.contributing_sensor_count,
            h.first_sustained_anomaly_cycle,
            h.estimated_rul,
            h.dataset_id
        FROM MACHINE_HEALTH h
        WHERE h.machine_id = :machine_id
        ORDER BY h.cycle DESC
        LIMIT 1;
        """
        df = self.db.export_to_pandas(query, {"machine_id": machine_id})
        if df.empty:
            raise MachineNotFoundError(machine_id)
        row = df.iloc[0]
        return {
            "machine_id": str(row["machine_id"]),
            "cycle": int(row["cycle"]),
            "health_score": round(float(row["health_score"]), 2),
            "risk_score": round(float(row["risk_score"]), 2),
            "risk_category": str(row["risk_category"]),
            "contributing_sensor_count": int(row["contributing_sensor_count"]) if pd.notnull(row["contributing_sensor_count"]) else 0,
            "first_sustained_anomaly_cycle": int(row["first_sustained_anomaly_cycle"]) if pd.notnull(row["first_sustained_anomaly_cycle"]) else None,
            "estimated_rul": round(float(row["estimated_rul"]), 1) if pd.notnull(row["estimated_rul"]) else None,
            "dataset_id": str(row["dataset_id"])
        }

    def get_root_cause_evidence(self, machine_id: str) -> List[Dict[str, Any]]:
        """Fetches top-5 ranked root-cause sensor signals."""
        cycle_df = self.db.export_to_pandas(
            "SELECT MAX(cycle) AS max_cycle FROM MACHINE_HEALTH WHERE machine_id = :machine_id",
            {"machine_id": machine_id}
        )
        if cycle_df.empty or pd.isnull(cycle_df.iloc[0]["max_cycle"]):
            raise MachineNotFoundError(machine_id)
        latest_cycle = int(cycle_df.iloc[0]["max_cycle"])

        query = """
        SELECT
            rank,
            sensor_name,
            raw_reading,
            baseline_mean,
            baseline_std,
            deviation_magnitude,
            drift_rate,
            persistence,
            contribution_score,
            first_sustained_anomaly_cycle,
            evidence_explanation
        FROM ROOT_CAUSE_EVIDENCE
        WHERE machine_id = :machine_id AND cycle = :cycle
        ORDER BY rank ASC
        LIMIT 5;
        """
        df = self.db.export_to_pandas(query, {"machine_id": machine_id, "cycle": latest_cycle})
        return [
            {
                "rank": int(r["rank"]),
                "sensor_name": str(r["sensor_name"]),
                "raw_reading": round(float(r["raw_reading"]), 3),
                "baseline_mean": round(float(r["baseline_mean"]), 3),
                "baseline_std": round(float(r["baseline_std"]), 3),
                "deviation_magnitude": round(float(r["deviation_magnitude"]), 2),
                "drift_rate": round(float(r["drift_rate"]), 5),
                "persistence": int(r["persistence"]),
                "contribution_score": round(float(r["contribution_score"]), 2),
                "first_sustained_anomaly_cycle": int(r["first_sustained_anomaly_cycle"]) if pd.notnull(r["first_sustained_anomaly_cycle"]) else None,
                "explanation": str(r["evidence_explanation"])
            }
            for _, r in df.iterrows()
        ]

    def get_sensor_drift(
        self,
        machine_id: str,
        sensor_name: Optional[str] = None,
        start_cycle: Optional[int] = None,
        end_cycle: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Fetches drift metrics over a cycle interval."""
        where_parts = ["machine_id = :machine_id"]
        params: Dict[str, Any] = {"machine_id": machine_id}

        if sensor_name:
            where_parts.append("sensor_name = :sensor_name")
            params["sensor_name"] = sensor_name

        if start_cycle is not None:
            where_parts.append("cycle >= :start_cycle")
            params["start_cycle"] = start_cycle

        if end_cycle is not None:
            where_parts.append("cycle <= :end_cycle")
            params["end_cycle"] = end_cycle

        query = f"""
        SELECT
            cycle,
            sensor_name,
            raw_value,
            normalised_deviation,
            smoothed_deviation,
            drift_rate,
            anomaly_score,
            is_sustained
        FROM SENSOR_DRIFT
        WHERE {' AND '.join(where_parts)}
        ORDER BY cycle ASC, sensor_name ASC
        LIMIT 50;
        """
        df = self.db.export_to_pandas(query, params)
        return [
            {
                "cycle": int(r["cycle"]),
                "sensor_name": str(r["sensor_name"]),
                "raw_value": round(float(r["raw_value"]), 3),
                "z_score": round(float(r["normalised_deviation"]), 2),
                "smoothed_z": round(float(r["smoothed_deviation"]), 2),
                "drift_rate": round(float(r["drift_rate"]), 5),
                "is_sustained": bool(r["is_sustained"])
            }
            for _, r in df.iterrows()
        ]

    def get_fleet_risk_summary(self) -> Dict[str, Any]:
        """Summarizes fleet health for Copilot overview."""
        query = """
        WITH latest_cycles AS (
            SELECT machine_id, MAX(cycle) AS max_cycle
            FROM MACHINE_HEALTH
            GROUP BY machine_id
        ),
        latest_health AS (
            SELECT h.*
            FROM MACHINE_HEALTH h
            JOIN latest_cycles lc ON h.machine_id = lc.machine_id AND h.cycle = lc.max_cycle
        )
        SELECT
            COUNT(*) AS total_machines,
            SUM(CASE WHEN risk_category = 'HEALTHY' THEN 1 ELSE 0 END) AS healthy_count,
            SUM(CASE WHEN risk_category = 'WATCH' THEN 1 ELSE 0 END) AS watch_count,
            SUM(CASE WHEN risk_category = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_count,
            SUM(CASE WHEN risk_category = 'INSUFFICIENT_DATA' THEN 1 ELSE 0 END) AS insufficient_count,
            AVG(health_score) AS avg_health,
            AVG(risk_score) AS avg_risk
        FROM latest_health;
        """
        df = self.db.export_to_pandas(query)
        if df.empty or int(df.iloc[0]["total_machines"]) == 0:
            return {"total_machines": 0, "status": "No machine data available"}

        row = df.iloc[0]
        return {
            "total_machines": int(row["total_machines"]),
            "healthy": int(row["healthy_count"]),
            "watch": int(row["watch_count"]),
            "critical": int(row["critical_count"]),
            "insufficient_data": int(row["insufficient_count"]),
            "average_health_score": round(float(row["avg_health"]), 1),
            "average_risk_score": round(float(row["avg_risk"]), 1)
        }
