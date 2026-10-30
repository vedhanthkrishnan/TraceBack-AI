"""TraceBack AI - Benchmarking Endpoints
"""
from fastapi import APIRouter, Depends, Query, Request
from backend.app.schemas.common import APIResponse
from backend.app.schemas.benchmark import BenchmarkSummary
from backend.app.services.benchmark_service import BenchmarkService
from backend.app.db.connection import DatabaseManager, get_db

router = APIRouter(prefix="/benchmarks", tags=["Benchmarking & Performance"])


@router.get("", response_model=APIResponse[BenchmarkSummary])
async def get_benchmarks(
    request: Request,
    dataset_id: str = Query(default="NASA_FD001"),
    repeats: int = Query(default=3, ge=1, le=10),
    db: DatabaseManager = Depends(get_db)
):
    """Executes monotonic performance benchmarks across analytical queries and returns measured timings."""
    service = BenchmarkService(db)
    summary = service.run_benchmarks(dataset_id=dataset_id, repeats=repeats)
    return APIResponse(data=summary, request_id=getattr(request.state, "request_id", None))


@router.get("/history", response_model=APIResponse[BenchmarkSummary])
async def get_benchmark_history(request: Request, db: DatabaseManager = Depends(get_db)):
    """Returns past measured benchmark runs from the database."""
    service = BenchmarkService(db)
    summary = service.get_benchmark_history()
    return APIResponse(data=summary, request_id=getattr(request.state, "request_id", None))
