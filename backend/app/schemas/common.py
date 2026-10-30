"""TraceBack AI - Common API Schemas
"""
from typing import Generic, TypeVar, Optional, List, Any, Dict
from pydantic import BaseModel, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Standard uniform API response envelope."""
    success: bool = True
    data: Optional[T] = None
    error: Optional[str] = None
    message: Optional[str] = None
    request_id: Optional[str] = None


class PaginationParams(BaseModel):
    """Common pagination query parameters."""
    page: int = Field(default=1, ge=1, description="Page number starting from 1")
    page_size: int = Field(default=20, ge=1, le=200, description="Items per page")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated payload wrapper."""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class HealthStatus(BaseModel):
    """Service health response schema."""
    status: str = Field(default="healthy")
    service: str = "TraceBack AI Predictive Maintenance Engine"
    version: str = "1.0.0"
    timestamp: str
    database: Dict[str, Any]
    copilot: Dict[str, Any]


class ReadinessStatus(BaseModel):
    """Service readiness response schema with execution mode transparency."""
    ready: bool
    database_connected: bool
    schema_initialized: bool
    engine: str = Field(description="'Exasol Personal 7.1+' or 'Mock Engine (Isolated SQLite)'")
    is_mock: bool = Field(description="True if running isolated local SQLite engine")
    dataset_mode: str = Field(description="'REAL_NASA_CMAPSS_FD001', 'SYNTHETIC_FLEET_DEMO', or 'NO_DATA'")
    active_dataset: Optional[str] = None
    llm_provider: str = Field(description="Active AI Copilot provider")
    pipeline_status: Optional[str] = Field(default=None, description="Latest status of analytics pipeline")
    notes: List[str] = []
