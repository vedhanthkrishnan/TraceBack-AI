"""TraceBack AI - Pipeline and Analytics Execution Endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from backend.app.schemas.common import APIResponse
from backend.app.schemas.benchmark import PipelineRunStatus
from backend.app.workers.pipeline import AnalyticsPipelineWorker
from backend.app.db.connection import DatabaseManager, get_db

router = APIRouter(prefix="/pipeline", tags=["Pipeline & Analytics"])


@router.get("/status", response_model=APIResponse[Optional[PipelineRunStatus]])
async def get_pipeline_status(request: Request, db: DatabaseManager = Depends(get_db)):
    """Returns the latest analytics pipeline execution status and summary."""
    worker = AnalyticsPipelineWorker(db)
    status = worker.get_latest_status()
    return APIResponse(data=status, request_id=getattr(request.state, "request_id", None))


@router.post("/run", response_model=APIResponse[PipelineRunStatus])
async def trigger_pipeline_run(
    request: Request,
    dataset_id: str = Query(default="NASA_FD001"),
    pipeline_version: str = Query(default="v1.0"),
    db: DatabaseManager = Depends(get_db)
):
    """Triggers synchronous execution of the full predictive maintenance pipeline."""
    worker = AnalyticsPipelineWorker(db)
    status = worker.execute_pipeline(dataset_id=dataset_id, pipeline_version=pipeline_version)
    return APIResponse(data=status, message="Pipeline executed successfully", request_id=getattr(request.state, "request_id", None))
