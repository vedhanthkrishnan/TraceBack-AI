"""TraceBack AI - Analytics and Evidence Repository

Data access for root-cause evidence rankings, failure signatures, and signature groups.
"""
import json
from typing import Dict, List, Optional, Any
import pandas as pd
from backend.app.db.connection import DatabaseManager
from backend.app.core.exceptions import MachineNotFoundError, TraceBackException
from backend.app.schemas.analytics import (
    RootCauseEvidenceItem,
    MachineRootCauseResponse,
    HistoricalMatch,
    MachineSignaturesResponse,
    ConsolidatedEvidenceBundle,
    SignatureGroup
)
from backend.app.schemas.machine import SensorDriftSummary


class AnalyticsRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def get_root_cause_evidence(self, machine_id: str, cycle: Optional[int] = None) -> MachineRootCauseResponse:
        """Retrieves ranked root-cause sensor evidence for the given machine cycle."""
        if cycle is None:
            cycle_df = self.db.export_to_pandas(
                "SELECT MAX(cycle) AS max_cycle FROM MACHINE_HEALTH WHERE machine_id = :machine_id",
                {"machine_id": machine_id}
            )
            if cycle_df.empty or pd.isnull(cycle_df.iloc[0]["max_cycle"]):
                raise MachineNotFoundError(machine_id)
            cycle = int(cycle_df.iloc[0]["max_cycle"])

        # Fetch health info
        health_df = self.db.export_to_pandas(
            "SELECT health_score, risk_score, risk_category FROM MACHINE_HEALTH WHERE machine_id = :machine_id AND cycle = :cycle",
            {"machine_id": machine_id, "cycle": cycle}
        )
        if health_df.empty:
            health_score, risk_score, risk_category = 100.0, 0.0, "HEALTHY"
        else:
            h_row = health_df.iloc[0]
            health_score = round(float(h_row["health_score"]), 2)
            risk_score = round(float(h_row["risk_score"]), 2)
            risk_category = str(h_row["risk_category"])

        # Fetch root cause ranked items
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
        ORDER BY rank ASC;
        """
        df = self.db.export_to_pandas(query, {"machine_id": machine_id, "cycle": cycle})
        items = []
        for _, r in df.iterrows():
            items.append(RootCauseEvidenceItem(
                rank=int(r["rank"]),
                sensor_name=str(r["sensor_name"]),
                raw_reading=round(float(r["raw_reading"]), 4),
                baseline_mean=round(float(r["baseline_mean"]), 4),
                baseline_std=round(float(r["baseline_std"]), 4),
                deviation_magnitude=round(float(r["deviation_magnitude"]), 2),
                drift_rate=round(float(r["drift_rate"]), 5),
                persistence=int(r["persistence"]),
                contribution_score=round(float(r["contribution_score"]), 2),
                first_sustained_anomaly_cycle=int(r["first_sustained_anomaly_cycle"]) if pd.notnull(r["first_sustained_anomaly_cycle"]) else None,
                evidence_explanation=str(r["evidence_explanation"])
            ))

        return MachineRootCauseResponse(
            machine_id=machine_id,
            cycle=cycle,
            health_score=health_score,
            risk_score=risk_score,
            risk_category=risk_category,
            evidence_items=items
        )

    def get_failure_signatures(self, machine_id: str) -> MachineSignaturesResponse:
        """Finds historical run-to-failure machines that match the query machine's anomaly pattern."""
        # Check machine exists
        cycle_df = self.db.export_to_pandas(
            "SELECT MAX(cycle) AS max_cycle FROM MACHINE_HEALTH WHERE machine_id = :machine_id",
            {"machine_id": machine_id}
        )
        if cycle_df.empty or pd.isnull(cycle_df.iloc[0]["max_cycle"]):
            raise MachineNotFoundError(machine_id)
        current_cycle = int(cycle_df.iloc[0]["max_cycle"])

        # Get top sustained sensors for query machine
        q_sensors_df = self.db.export_to_pandas(
            """
            SELECT sensor_name, MIN(cycle) AS onset_cycle, MAX(anomaly_score) AS peak_anomaly
            FROM SENSOR_DRIFT
            WHERE machine_id = :machine_id AND is_sustained = 1
            GROUP BY sensor_name
            ORDER BY onset_cycle ASC;
            """,
            {"machine_id": machine_id}
        )
        q_sensors = set(q_sensors_df["sensor_name"].tolist()) if not q_sensors_df.empty else set()

        if not q_sensors:
            return MachineSignaturesResponse(
                machine_id=machine_id,
                current_cycle=current_cycle,
                current_signature=None,
                matches=[],
                message="No sustained sensor anomalies detected yet for this machine."
            )

        # Retrieve historical failure signatures from database (excluding the query machine)
        hist_df = self.db.export_to_pandas(
            """
            SELECT
                machine_id,
                signature_id,
                ordered_sensor_events,
                signature_features,
                source_dataset,
                historical_outcome,
                total_cycles
            FROM FAILURE_SIGNATURES
            WHERE machine_id != :machine_id
            """,
            {"machine_id": machine_id}
        )

        matches = []
        for _, r in hist_df.iterrows():
            hist_mid = str(r["machine_id"])
            try:
                events = json.loads(r["ordered_sensor_events"])
            except Exception:
                events = [s.strip() for s in str(r["ordered_sensor_events"]).split(",") if s.strip()]

            hist_sensors = set(events)
            shared = list(q_sensors.intersection(hist_sensors))
            union = q_sensors.union(hist_sensors)
            # Jaccard index similarity
            jaccard = len(shared) / len(union) if union else 0.0

            if jaccard >= 0.30:  # Minimum similarity threshold
                matches.append(HistoricalMatch(
                    matched_machine_id=hist_mid,
                    similarity_score=round(jaccard, 2),
                    shared_sensor_evidence=sorted(shared),
                    historical_total_cycles=int(r["total_cycles"]),
                    outcome=str(r["historical_outcome"]),
                    observation_window=f"Cycles 1 - {r['total_cycles']}",
                    similarity_interpretation=(
                        f"Machine {hist_mid} exhibited sustained degradation across matching sensors: "
                        f"{', '.join(sorted(shared))}. Reached run-to-failure at cycle {r['total_cycles']}."
                    )
                ))

        # Sort matches by similarity score descending
        matches.sort(key=lambda m: m.similarity_score, reverse=True)
        top_matches = matches[:5]

        msg = (
            f"Found {len(top_matches)} resembling historical failure trajectory cases."
            if top_matches
            else "No sufficiently similar historical signature found with current observation window."
        )

        return MachineSignaturesResponse(
            machine_id=machine_id,
            current_cycle=current_cycle,
            current_signature={
                "sustained_sensors": list(q_sensors),
                "cycle": current_cycle
            },
            matches=top_matches,
            message=msg
        )

    def get_consolidated_evidence_bundle(self, machine_id: str) -> ConsolidatedEvidenceBundle:
        """Assembles a judge-ready evidence package combining health, root-cause, drift, and historical matches."""
        rc_resp = self.get_root_cause_evidence(machine_id)
        sig_resp = self.get_failure_signatures(machine_id)

        # Get latest drift highlights
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
            ON d.machine_id = b.machine_id AND d.sensor_name = b.sensor_name
        WHERE d.machine_id = :machine_id AND d.cycle = :cycle AND (d.threshold_crossed = 1 OR d.is_sustained = 1)
        ORDER BY d.anomaly_score DESC
        LIMIT 5;
        """
        d_df = self.db.export_to_pandas(drift_query, {"machine_id": machine_id, "cycle": rc_resp.cycle})
        drift_highlights = [
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

        # Get first sustained cycle
        first_sustained = None
        for item in rc_resp.evidence_items:
            if item.first_sustained_anomaly_cycle is not None:
                if first_sustained is None or item.first_sustained_anomaly_cycle < first_sustained:
                    first_sustained = item.first_sustained_anomaly_cycle

        # Formulate concise verdict
        if rc_resp.risk_category == "CRITICAL":
            verdict = (
                f"Machine {machine_id} requires immediate inspection. It has crossed critical risk threshold "
                f"at cycle {rc_resp.cycle}. Leading abnormal indicators: "
                f"{', '.join([e.sensor_name for e in rc_resp.evidence_items[:2]])}."
            )
        elif rc_resp.risk_category == "WATCH":
            verdict = (
                f"Machine {machine_id} shows emerging drift above baseline. Monitor closely at cycle {rc_resp.cycle}."
            )
        elif rc_resp.risk_category == "INSUFFICIENT_DATA":
            verdict = f"Machine {machine_id} is within the initial observation window ({rc_resp.cycle} < 30 cycles)."
        else:
            verdict = f"Machine {machine_id} operates within expected healthy parameters (Health score: {rc_resp.health_score})."

        return ConsolidatedEvidenceBundle(
            machine_id=machine_id,
            cycle=rc_resp.cycle,
            health_score=rc_resp.health_score,
            risk_score=rc_resp.risk_score,
            risk_category=rc_resp.risk_category,
            baseline_window=30,
            first_sustained_anomaly_cycle=first_sustained,
            estimated_rul=None,
            top_root_cause_evidence=rc_resp.evidence_items[:5],
            top_historical_matches=sig_resp.matches[:3],
            sensor_drift_highlights=drift_highlights,
            summary_verdict=verdict
        )

    def get_signature_groups(self) -> List[SignatureGroup]:
        """Retrieves failure signature clusters representing common failure modes."""
        df = self.db.export_to_pandas("SELECT * FROM SIGNATURE_GROUPS ORDER BY member_count DESC;")
        groups = []
        for _, r in df.iterrows():
            try:
                rep = json.loads(r["representative_signature"])
            except Exception:
                rep = {"pattern": str(r["representative_signature"])}

            groups.append(SignatureGroup(
                group_id=str(r["group_id"]),
                group_name=str(r["group_name"]),
                member_count=int(r["member_count"]),
                clustering_method=str(r["clustering_method"]),
                representative_pattern=rep
            ))
        return groups

    def get_signature_group_detail(self, group_id: str) -> SignatureGroup:
        """Retrieves details for a specific signature group."""
        df = self.db.export_to_pandas(
            "SELECT * FROM SIGNATURE_GROUPS WHERE group_id = :group_id",
            {"group_id": group_id}
        )
        if df.empty:
            raise TraceBackException(f"Signature group '{group_id}' not found.", status_code=404)
        r = df.iloc[0]
        try:
            rep = json.loads(r["representative_signature"])
        except Exception:
            rep = {"pattern": str(r["representative_signature"])}

        # Find member machines
        members_df = self.db.export_to_pandas(
            "SELECT machine_id FROM FAILURE_SIGNATURES WHERE signature_id = :group_id LIMIT 20",
            {"group_id": group_id}
        )
        members = members_df["machine_id"].tolist() if not members_df.empty else []

        return SignatureGroup(
            group_id=str(r["group_id"]),
            group_name=str(r["group_name"]),
            member_count=int(r["member_count"]),
            clustering_method=str(r["clustering_method"]),
            representative_pattern=rep,
            member_machine_ids=members
        )
