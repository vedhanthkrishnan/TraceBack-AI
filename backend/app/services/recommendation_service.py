"""TraceBack AI - Maintenance Recommendation Service

Translates sensor evidence into structured industrial maintenance recommendations.
"""
from typing import List, Dict, Any


SENSOR_COMPONENT_MAPPING = {
    "s2": "Low Pressure Compressor (LPC) Outlet Pressure",
    "s3": "High Pressure Compressor (HPC) Outlet Temperature",
    "s4": "Low Pressure Turbine (LPT) Outlet Temperature",
    "s7": "High Pressure Turbine (HPT) Coolant Bleed Pressure",
    "s8": "Fan Speed (Nf)",
    "s9": "Core Speed (Nc)",
    "s11": "Static High Pressure Compressor Discharge Pressure (Ps30)",
    "s12": "Ratio of Fuel Flow to Static HPC Discharge (W31/Ps30)",
    "s14": "Corrected Fan Speed (NRf)",
    "s15": "Bypass Ratio",
    "s17": "High Pressure Bleed Air Flow",
    "s20": "High Pressure Turbine Bleed Air Temperature",
    "s21": "Low Pressure Turbine Coolant Bleed Temperature"
}


class RecommendationService:
    @staticmethod
    def get_maintenance_actions(
        risk_category: str,
        top_abnormal_sensors: List[str]
    ) -> List[str]:
        """Provides prioritized maintenance inspection steps based on abnormal evidence."""
        actions: List[str] = []

        if risk_category == "CRITICAL":
            actions.append("Schedule immediate borescope or physical teardown inspection prior to next flight/shift.")
            actions.append("Conduct sensor diagnostic calibration test to rule out thermocouple/transducer drift.")
        elif risk_category == "WATCH":
            actions.append("Increase sampling frequency and flag machine for observation on next scheduled maintenance window.")
        elif risk_category == "INSUFFICIENT_DATA":
            actions.append("Continue normal operation to complete initial baseline observation period (30 cycles).")
            return actions
        else:
            actions.append("No immediate maintenance required. Machine operates within baseline boundaries.")
            return actions

        # Add component-specific inspection targets
        for s in top_abnormal_sensors[:3]:
            component = SENSOR_COMPONENT_MAPPING.get(s, f"Sensor {s} subsystem")
            actions.append(f"Inspect subsystem: {component} (Corresponds to abnormal signal {s}).")

        return actions
