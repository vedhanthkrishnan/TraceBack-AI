"""TraceBack AI - Ingestion Endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from backend.app.schemas.common import APIResponse
from backend.app.schemas.benchmark import IngestionJobStatus
from backend.app.services.ingestion_service import IngestionService
from backend.app.db.connection import DatabaseManager, get_db
from backend.app.core.exceptions import TraceBackException

router = APIRouter(prefix="/ingestion", tags=["Data Ingestion"])


@router.get("/jobs/{job_id}", response_model=APIResponse[IngestionJobStatus])
async def get_ingestion_job(job_id: str, request: Request, db: DatabaseManager = Depends(get_db)):
    """Returns row counts, status, and validation logs for an ingestion batch."""
    df = db.export_to_pandas("SELECT * FROM INGESTION_BATCHES WHERE batch_id = :bid", {"bid": job_id})
    if df.empty:
        raise TraceBackException(f"Ingestion job '{job_id}' not found.", status_code=404)
    r = df.iloc[0]
    status = IngestionJobStatus(
        job_id=str(r["batch_id"]),
        source_name=str(r["source_name"]),
        import_status=str(r["import_status"]),
        row_count=int(r["row_count"]),
        machine_count=int(r["machine_count"]),
        validation_results=str(r["validation_results"]) if r["validation_results"] else None,
        created_at=str(r["created_at"]),
        completed_at=str(r["completed_at"]) if r["completed_at"] else None
    )
    return APIResponse(data=status, request_id=getattr(request.state, "request_id", None))
