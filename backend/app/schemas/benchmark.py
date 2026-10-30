"""TraceBack AI - Benchmarking and Pipeline Schemas
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class BenchmarkResult(BaseModel):
    """Measured execution performance of an analytical operation."""
    run_id: str
    dataset_id: str
    machine_count: int
    cycle_count: int
    operation_name: str
    measured_duration_ms: float
    repeat_number: int
    environment_metadata: Optional[str] = None
    created_at: Optional[str] = None


class BenchmarkSummary(BaseModel):
    """Overall benchmark results report."""
    total_runs: int
    results: List[BenchmarkResult]
    fastest_operation: Optional[str] = None
    slowest_operation: Optional[str] = None


class PipelineRunStatus(BaseModel):
    """Execution status of an analytics pipeline run."""
    run_id: str
    start_time: str
    end_time: Optional[str] = None
    dataset_id: str
    rows_processed: int
    machines_processed: int
    pipeline_version: str
    status: str = Field(description="STARTED, SUCCESS, FAILED")
    error_summary: Optional[str] = None
    processing_duration_sec: Optional[float] = None


class IngestionJobStatus(BaseModel):
    """Status record of a data ingestion job."""
    job_id: str
    source_name: str
    import_status: str
    row_count: int
    machine_count: int
    validation_results: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
