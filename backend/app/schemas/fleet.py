"""TraceBack AI - Fleet Schemas
"""
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class MachineSummary(BaseModel):
    """Summarized machine risk and health state for fleet tables."""
    machine_id: str
    cycle: int
    health_score: float = Field(ge=0.0, le=100.0, description="Health score (0=Severe, 100=Healthy)")
    risk_score: float = Field(ge=0.0, le=100.0, description="Risk score (0=Normal, 100=Critical)")
    risk_category: str = Field(description="HEALTHY, WATCH, CRITICAL, or INSUFFICIENT_DATA")
    contributing_sensor_count: int = 0
    first_sustained_anomaly_cycle: Optional[int] = None
    estimated_rul: Optional[float] = None
    dataset_id: str
    last_updated: Optional[str] = None


class FleetSummary(BaseModel):
    """Aggregate fleet-level health statistics."""
    total_machines: int
    healthy_count: int
    watch_count: int
    critical_count: int
    insufficient_data_count: int
    average_health_score: float
    average_risk_score: float
    active_dataset_id: Optional[str] = None
    last_pipeline_run: Optional[str] = None


class FleetFilterParams(BaseModel):
    """Filter parameters for querying fleet machines."""
    risk_category: Optional[str] = None
    search: Optional[str] = None
    dataset_id: Optional[str] = None
    sort_by: str = Field(default="risk_score", description="risk_score, health_score, machine_id, cycle")
    sort_order: str = Field(default="desc", description="asc or desc")
