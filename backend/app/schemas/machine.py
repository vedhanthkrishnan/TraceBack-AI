"""TraceBack AI - Machine Investigation Schemas
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class MachineDetail(BaseModel):
    """Detailed machine view for deep dive investigation."""
    machine_id: str
    current_cycle: int
    health_score: float
    risk_score: float
    risk_category: str
    contributing_sensor_count: int
    first_sustained_anomaly_cycle: Optional[int] = None
    estimated_rul: Optional[float] = None
    rul_confidence: Optional[float] = None
    dataset_id: str
    data_quality_state: str = "VALID"
    baseline_window: int = 30
    explanation: Optional[str] = None


class MachineHealthHistoryPoint(BaseModel):
    """Individual cycle historical health score for trend chart."""
    cycle: int
    health_score: float
    risk_score: float
    risk_category: str


class MachineHealthHistoryResponse(BaseModel):
    """History of health scores across cycles."""
    machine_id: str
    total_cycles: int
    history: List[MachineHealthHistoryPoint]


class SensorBaseline(BaseModel):
    """Learned sensor baseline characteristics."""
    sensor_name: str
    sample_count: int
    mean: float
    std: float
    median: Optional[float] = None
    mad: Optional[float] = None
    window_start_cycle: int
    window_end_cycle: int
    is_valid: bool
    baseline_method: str = "STANDARD_NORMAL"


class SensorDriftSummary(BaseModel):
    """Cycle sensor measurement drift profile."""
    sensor_name: str
    current_raw_value: float
    baseline_mean: float
    baseline_std: float
    current_z_score: float
    smoothed_z_score: float
    drift_rate: float
    anomaly_score: float
    is_sustained: bool
    threshold_crossed: bool


class MachineSensorsResponse(BaseModel):
    """All sensor drift and baseline metrics for a machine."""
    machine_id: str
    cycle: int
    baselines: List[SensorBaseline]
    drifts: List[SensorDriftSummary]


class MachineComparisonRequest(BaseModel):
    """Request payload to compare multiple machines."""
    machine_ids: List[str] = Field(min_length=2, max_length=10)


class MachineComparisonProfile(BaseModel):
    """Individual machine profile within a multi-machine comparison."""
    machine_id: str
    current_cycle: int
    health_score: float
    risk_score: float
    risk_category: str
    first_sustained_anomaly_cycle: Optional[int]
    top_abnormal_sensors: List[str]
    estimated_rul: Optional[float]


class MachineComparisonResponse(BaseModel):
    """Comparative evaluation across multiple machines."""
    comparison: List[MachineComparisonProfile]
    shared_anomalies: List[str]
    divergent_sensors: List[str]
    comparative_summary: str
