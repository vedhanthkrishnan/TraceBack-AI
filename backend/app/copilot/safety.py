"""TraceBack AI - Copilot Evidence Formatter & Safety Checker

Validates model outputs, extracts structured evidence pointers, and blocks hallucinations.
"""
import re
from typing import Dict, List, Optional, Any, Tuple
from backend.app.schemas.copilot import EvidenceReference


SUSPICIOUS_PHRASES = [
    "will definitely fail at cycle",
    "guaranteed component breakdown",
    "100% chance of failure",
    "drop table",
    "rm -rf"
]


class EvidenceFormatter:
    """Extracts structured citations and formats retrieved evidence for prompt injection."""

    @staticmethod
    def build_evidence_context(
        machine_health: Optional[Dict[str, Any]] = None,
        root_cause: Optional[List[Dict[str, Any]]] = None,
        historical_matches: Optional[Dict[str, Any]] = None,
        fleet_summary: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, List[EvidenceReference]]:
        """Synthesizes structured context and collects reference pointers."""
        lines = []
        references: List[EvidenceReference] = []

        if machine_health:
            mid = machine_health.get("machine_id", "Unknown")
            cycle = machine_health.get("cycle")
            h_score = machine_health.get("health_score")
            r_score = machine_health.get("risk_score")
            cat = machine_health.get("risk_category")
            first_anom = machine_health.get("first_sustained_anomaly_cycle")
            rul = machine_health.get("estimated_rul")

            lines.append(f"MACHINE HEALTH SUMMARY:")
            lines.append(f"- Machine ID: {mid}")
            lines.append(f"- Current Cycle: {cycle}")
            lines.append(f"- Health Score: {h_score}/100 | Risk Score: {r_score}/100 (Classification: {cat})")
            lines.append(f"- First Sustained Anomaly Detected: Cycle {first_anom if first_anom else 'None'}")
            if rul is not None:
                lines.append(f"- Estimated Remaining Useful Life (RUL): {rul} cycles")

            references.append(EvidenceReference(
                evidence_type="HEALTH_SCORE",
                cycle=cycle,
                metric_value=r_score,
                detail=f"Machine {mid} classified as {cat} with risk score {r_score}/100 at cycle {cycle}."
            ))

        if root_cause:
            lines.append("\nTOP CONTRIBUTING SENSOR ANOMALIES (ROOT-CAUSE EVIDENCE):")
            for item in root_cause[:4]:
                s = item.get("sensor_name")
                mag = item.get("deviation_magnitude")
                rate = item.get("drift_rate")
                rank = item.get("rank")
                exp = item.get("explanation")
                lines.append(f"- Rank {rank} ({s}): {exp}")

                references.append(EvidenceReference(
                    evidence_type="ROOT_CAUSE",
                    sensor_name=s,
                    metric_value=mag,
                    detail=f"Sensor {s} deviated by {mag} std deviations (Drift rate: {rate}/cycle)."
                ))

        if historical_matches and historical_matches.get("matches"):
            matches = historical_matches["matches"]
            lines.append("\nHISTORICAL RUN-TO-FAILURE ANALOGUES:")
            for m in matches[:3]:
                h_mid = m.get("matched_machine_id")
                sim = m.get("similarity_score")
                shared = m.get("shared_sensor_evidence", [])
                tot = m.get("historical_total_cycles")
                lines.append(f"- Machine {h_mid}: {int(sim*100)}% similarity, shared abnormal sensors: {', '.join(shared)}, failed at cycle {tot}")

                references.append(EvidenceReference(
                    evidence_type="HISTORICAL_MATCH",
                    metric_value=sim,
                    detail=f"Historical machine {h_mid} demonstrated {int(sim*100)}% similarity across sensors {', '.join(shared)}."
                ))

        if fleet_summary and "total_machines" in fleet_summary:
            lines.append("\nFLEET HEALTH OVERVIEW:")
            lines.append(
                f"- Total Machines: {fleet_summary.get('total_machines')} "
                f"(Healthy: {fleet_summary.get('healthy')}, Watch: {fleet_summary.get('watch')}, Critical: {fleet_summary.get('critical')})"
            )

        return "\n".join(lines), references


class CopilotSafetyFilter:
    """Sanitizes queries and outputs against injection and unsupported certainty."""

    @staticmethod
    def sanitize_user_query(query: str) -> str:
        # Strip system injection attempts, sensitive credential requests, and SQL injection tokens
        cleaned = re.sub(r"(ignore previous instructions|system prompt|disregard|drop\s+tables?|tell me (?:secret|password|credentials))", "", query, flags=re.I)
        return cleaned.strip()

    @staticmethod
    def inspect_response(text: str) -> Tuple[str, List[str]]:
        limitations = []
        lower = text.lower()

        for phrase in SUSPICIOUS_PHRASES:
            if phrase in lower:
                limitations.append(f"Caution: Model output adjusted to prevent unverified physical certainty ('{phrase}').")
                text = text.replace(phrase, "may exhibit degradation around cycle")

        return text, limitations
