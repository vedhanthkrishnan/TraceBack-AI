"""TraceBack AI - Machine Repository

Data access for individual machine deep-dives, sensor histories, and comparisons.
"""
from typing import Dict, List, Optional, Tuple, Any
import pandas as pd
from backend.app.db.connection import DatabaseManager
from backend.app.core.exceptions import MachineNotFoundError
from backend.app.schemas.machine import (
    MachineDetail,
    MachineHealthHistoryPoint,
    MachineHealthHistoryResponse,
    SensorBaseline,
    SensorDriftSummary,
    MachineSensorsResponse,
    MachineComparisonProfile,
    MachineComparisonResponse
)


class MachineRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def get_machine_detail(self, machine_id: str) -> MachineDetail:
        """Retrieves current health, risk status, and diagnosis metadata for a machine."""
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
            h.rul_confidence,
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
        cycle = int(row["cycle"])
        risk_cat = str(row["risk_category"])

        # Fetch top abnormal sensors for this cycle
        top_sensors_query = """
        SELECT sensor_name
        FROM SENSOR_DRIFT
        WHERE machine_id = :machine_id AND cycle = :cycle
        ORDER BY anomaly_score DESC
        LIMIT 3;
        """
        top_df = self.db.export_to_pandas(top_sensors_query, {"machine_id": machine_id, "cycle": cycle})
        top_sensors = top_df["sensor_name"].tolist() if not top_df.empty else []

        explanation = (
            f"Machine {machine_id} is evaluated at cycle {cycle}. "
            f"Classification: {risk_cat} (Risk score: {float(row['risk_score']):.1f}/100). "
            f"Top contributing sensor signals: {', '.join(top_sensors) if top_sensors else 'None'}. "
            f"First sustained anomaly observed at cycle {row['first_sustained_anomaly_cycle']}."
        )

        return MachineDetail(
            machine_id=str(row["machine_id"]),
            current_cycle=cycle,
            health_score=round(float(row["health_score"]), 2),
            risk_score=round(float(row["risk_score"]), 2),
            risk_category=risk_cat,
            contributing_sensor_count=int(row["contributing_sensor_count"]) if pd.notnull(row["contributing_sensor_count"]) else 0,
            first_sustained_anomaly_cycle=int(row["first_sustained_anomaly_cycle"]) if pd.notnull(row["first_sustained_anomaly_cycle"]) else None,
            estimated_rul=round(float(row["estimated_rul"]), 1) if pd.notnull(row["estimated_rul"]) else None,
            rul_confidence=round(float(row["rul_confidence"]), 2) if pd.notnull(row["rul_confidence"]) else None,
            dataset_id=str(row["dataset_id"]),
            data_quality_state="VALID",
            baseline_window=30,
            explanation=explanation
        )

    def get_machine_history(self, machine_id: str) -> MachineHealthHistoryResponse:
        """Retrieves historical health and risk scores over all cycles for trend plotting."""
        query = """
        SELECT
            cycle,
            health_score,
            risk_score,
            risk_category
        FROM MACHINE_HEALTH
        WHERE machine_id = :machine_id
        ORDER BY cycle ASC;
        """
        df = self.db.export_to_pandas(query, {"machine_id": machine_id})
        if df.empty:
            raise MachineNotFoundError(machine_id)

        history = [
            MachineHealthHistoryPoint(
                cycle=int(row["cycle"]),
                health_score=round(float(row["health_score"]), 2),
                risk_score=round(float(row["risk_score"]), 2),
                risk_category=str(row["risk_category"])
            )
            for _, row in df.iterrows()
        ]

        return MachineHealthHistoryResponse(
            machine_id=machine_id,
            total_cycles=len(history),
            history=history
        )

    def get_machine_sensors(self, machine_id: str) -> MachineSensorsResponse:
        """Retrieves sensor baselines and latest drift metrics for the machine."""
        # Check machine exists and get latest cycle
        cycle_df = self.db.export_to_pandas(
            "SELECT MAX(cycle) AS max_cycle FROM MACHINE_HEALTH WHERE machine_id = :machine_id",
            {"machine_id": machine_id}
        )
        if cycle_df.empty or pd.isnull(cycle_df.iloc[0]["max_cycle"]):
            raise MachineNotFoundError(machine_id)
        latest_cycle = int(cycle_df.iloc[0]["max_cycle"])

        # Fetch baselines
        baselines_query = """
        SELECT
            sensor_name,
            sample_count,
            baseline_mean,
            baseline_std,
            baseline_median,
            baseline_mad,
            window_start_cycle,
            window_end_cycle,
            is_valid,
            baseline_method
        FROM MACHINE_BASELINES
        WHERE machine_id = :machine_id
        ORDER BY sensor_name ASC;
        """
        b_df = self.db.export_to_pandas(baselines_query, {"machine_id": machine_id})
        baselines = [
            SensorBaseline(
                sensor_name=str(r["sensor_name"]),
                sample_count=int(r["sample_count"]),
                mean=round(float(r["baseline_mean"]), 4),
                std=round(float(r["baseline_std"]), 4),
                median=round(float(r["baseline_median"]), 4) if pd.notnull(r["baseline_median"]) else None,
                mad=round(float(r["baseline_mad"]), 4) if pd.notnull(r["baseline_mad"]) else None,
                window_start_cycle=int(r["window_start_cycle"]),
                window_end_cycle=int(r["window_end_cycle"]),
                is_valid=bool(r["is_valid"]),
                baseline_method=str(r["baseline_method"])
            )
            for _, r in b_df.iterrows()
        ]

        # Fetch latest drift metrics
        drift_query = """
        SELECT
            d.sensor_name,
            d.raw_value,
            b.baseline_mean,
            b.baseline_std,
            d.normalised_deviation,
            d.smoothed_deviation,
            d.drift_rate,
            d.anomaly_score,
            d.is_sustained,
            d.threshold_crossed
        FROM SENSOR_DRIFT d
        JOIN MACHINE_BASELINES b
            ON d.machine_id = b.machine_id
            AND d.sensor_name = b.sensor_name
        WHERE d.machine_id = :machine_id AND d.cycle = :cycle
        ORDER BY d.anomaly_score DESC;
        """
        d_df = self.db.export_to_pandas(drift_query, {"machine_id": machine_id, "cycle": latest_cycle})
        drifts = [
            SensorDriftSummary(
                sensor_name=str(r["sensor_name"]),
                current_raw_value=round(float(r["raw_value"]), 4),
                baseline_mean=round(float(r["baseline_mean"]), 4),
                baseline_std=round(float(r["baseline_std"]), 4),
                current_z_score=round(float(r["normalised_deviation"]), 2),
                smoothed_z_score=round(float(r["smoothed_deviation"]), 2),
                drift_rate=round(float(r["drift_rate"]), 5),
                anomaly_score=round(float(r["anomaly_score"]), 2),
                is_sustained=bool(r["is_sustained"]),
                threshold_crossed=bool(r["threshold_crossed"])
            )
            for _, r in d_df.iterrows()
        ]

        return MachineSensorsResponse(
            machine_id=machine_id,
            cycle=latest_cycle,
            baselines=baselines,
            drifts=drifts
        )

    def compare_machines(self, machine_ids: List[str]) -> MachineComparisonResponse:
        """Cross-evaluates multiple machines to highlight shared and divergent anomalies."""
        profiles = []
        abnormal_sensor_sets = []

        for mid in machine_ids:
            try:
                detail = self.get_machine_detail(mid)
                sensors_resp = self.get_machine_sensors(mid)
                top_abnormal = [d.sensor_name for d in sensors_resp.drifts if d.threshold_crossed or d.is_sustained]
                abnormal_sensor_sets.append(set(top_abnormal))

                profiles.append(MachineComparisonProfile(
                    machine_id=mid,
                    current_cycle=detail.current_cycle,
                    health_score=detail.health_score,
                    risk_score=detail.risk_score,
                    risk_category=detail.risk_category,
                    first_sustained_anomaly_cycle=detail.first_sustained_anomaly_cycle,
                    top_abnormal_sensors=top_abnormal[:4],
                    estimated_rul=detail.estimated_rul
                ))
            except MachineNotFoundError:
                continue

        if not profiles:
            raise MachineNotFoundError("None of the specified machines were found.")

        # Find shared anomalies (intersection)
        shared = list(set.intersection(*abnormal_sensor_sets)) if abnormal_sensor_sets else []
        # Find divergent sensors (union minus intersection)
        all_sensors = set.union(*abnormal_sensor_sets) if abnormal_sensor_sets else set()
        divergent = list(all_sensors - set(shared))

        summary = (
            f"Compared {len(profiles)} machines. "
            f"Shared abnormal sensors across all compared machines: {', '.join(shared) if shared else 'None'}. "
            f"Divergent sensors: {', '.join(divergent) if divergent else 'None'}."
        )

        return MachineComparisonResponse(
            comparison=profiles,
            shared_anomalies=sorted(shared),
            divergent_sensors=sorted(divergent),
            comparative_summary=summary
        )
