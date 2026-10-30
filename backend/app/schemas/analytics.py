"""TraceBack AI - Analytics and Evidence Schemas
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from backend.app.schemas.machine import SensorDriftSummary, SensorBaseline


class RootCauseEvidenceItem(BaseModel):
    """Ranked evidence record for a specific sensor."""
    rank: int
    sensor_name: str
    raw_reading: float
    baseline_mean: float
    baseline_std: float
    deviation_magnitude: float
    drift_rate: float
    persistence: int
    contribution_score: float
    first_sustained_anomaly_cycle: Optional[int] = None
    evidence_explanation: str


class MachineRootCauseResponse(BaseModel):
    """Full root-cause ranking response for a machine."""
    machine_id: str
    cycle: int
    health_score: float
    risk_score: float
    risk_category: str
    evidence_items: List[RootCauseEvidenceItem]
    methodology_note: str = (
        "Contribution score is an interpretable ranking metric derived from normalized deviation magnitude, "
        "rolling drift rate, persistence, and temporal onset order. It indicates leading signals requiring inspection, "
        "not definitive proof of physical component failure."
    )


class FailureSignature(BaseModel):
    """Extracted failure signature for run-to-failure trajectory."""
    machine_id: str
    signature_id: str
    ordered_sensor_events: List[str]
    signature_features: Dict[str, float]
    source_dataset: str
    historical_outcome: str
    total_cycles: int
    extraction_version: str


class HistoricalMatch(BaseModel):
    """A historical machine case resembling the query machine."""
    matched_machine_id: str
    similarity_score: float = Field(ge=0.0, le=1.0, description="Normalized similarity metric (0-1)")
    shared_sensor_evidence: List[str]
    historical_total_cycles: int
    outcome: str
    observation_window: str
    similarity_interpretation: str


class MachineSignaturesResponse(BaseModel):
    """Failure signature and historical matches for a machine."""
    machine_id: str
    current_cycle: int
    current_signature: Optional[Dict[str, Any]] = None
    matches: List[HistoricalMatch]
    message: str


class ConsolidatedEvidenceBundle(BaseModel):
    """Consolidated evidence package for judge/copilot review."""
    machine_id: str
    cycle: int
    health_score: float
    risk_score: float
    risk_category: str
    baseline_window: int
    first_sustained_anomaly_cycle: Optional[int]
    estimated_rul: Optional[float]
    top_root_cause_evidence: List[RootCauseEvidenceItem]
    top_historical_matches: List[HistoricalMatch]
    sensor_drift_highlights: List[SensorDriftSummary]
    summary_verdict: str


class SignatureGroup(BaseModel):
    """Group archetype clustering historical failure signatures."""
    group_id: str
    group_name: str
    member_count: int
    clustering_method: str
    representative_pattern: Dict[str, Any]
    member_machine_ids: List[str] = []
