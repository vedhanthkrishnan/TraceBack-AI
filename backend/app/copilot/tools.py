"""TraceBack AI - Copilot Read-Only Analytical Tools

Secure, parameter-validated read-only analytical tools for Copilot evidence retrieval.
Never exposes arbitrary database queries or write operations.
"""
from typing import Dict, List, Optional, Any
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.repositories.copilot_repository import CopilotRepository
from backend.app.repositories.analytics_repository import AnalyticsRepository
from backend.app.repositories.machine_repository import MachineRepository
from backend.app.copilot.prompts import METHODOLOGY_EXPLANATION
from backend.app.core.exceptions import MachineNotFoundError


class CopilotTools:
    def __init__(self, db: DatabaseManager = db_manager):
        self.copilot_repo = CopilotRepository(db)
        self.analytics_repo = AnalyticsRepository(db)
        self.machine_repo = MachineRepository(db)

    def get_machine_health(self, machine_id: str) -> Dict[str, Any]:
        """Tool: Retrieves current health score, risk score, and category."""
        return self.copilot_repo.get_machine_health(machine_id)

    def get_root_cause_evidence(self, machine_id: str) -> List[Dict[str, Any]]:
        """Tool: Retrieves top-ranked sensor evidence explaining machine risk."""
        return self.copilot_repo.get_root_cause_evidence(machine_id)

    def get_machine_drift(
        self,
        machine_id: str,
        sensor_name: Optional[str] = None,
        start_cycle: Optional[int] = None,
        end_cycle: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Tool: Retrieves cycle-level sensor drift and anomaly history."""
        return self.copilot_repo.get_sensor_drift(machine_id, sensor_name, start_cycle, end_cycle)

    def get_historical_matches(self, machine_id: str) -> Dict[str, Any]:
        """Tool: Retrieves run-to-failure machines with similar sensor degradation."""
        resp = self.analytics_repo.get_failure_signatures(machine_id)
        return {
            "machine_id": machine_id,
            "current_cycle": resp.current_cycle,
            "matches": [m.model_dump() for m in resp.matches],
            "message": resp.message
        }

    def compare_machines(self, machine_id_a: str, machine_id_b: str) -> Dict[str, Any]:
        """Tool: Compares telemetry and abnormal sensors between two machines."""
        resp = self.machine_repo.compare_machines([machine_id_a, machine_id_b])
        return resp.model_dump()

    def get_fleet_risk_summary(self) -> Dict[str, Any]:
        """Tool: Summarizes health status and risk counts across the entire fleet."""
        return self.copilot_repo.get_fleet_risk_summary()

    def explain_risk_methodology(self) -> str:
        """Tool: Explains how TraceBack calculates baselines, drift, and risk."""
        return METHODOLOGY_EXPLANATION
