"""TraceBack AI - Fleet Overview Endpoints
"""
import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from backend.app.schemas.common import APIResponse, PaginatedResponse
from backend.app.schemas.fleet import MachineSummary, FleetSummary, FleetFilterParams
from backend.app.repositories.fleet_repository import FleetRepository
from backend.app.db.connection import DatabaseManager, get_db

router = APIRouter(prefix="/fleet", tags=["Fleet Overview"])


@router.get("", response_model=APIResponse[PaginatedResponse[MachineSummary]])
async def get_fleet_machines(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    risk_category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    dataset_id: Optional[str] = Query(default=None),
    sort_by: str = Query(default="risk_score"),
    sort_order: str = Query(default="desc"),
    db: DatabaseManager = Depends(get_db)
):
    """Returns machines ranked by risk score with pagination and filtering."""
    repo = FleetRepository(db)
    filters = FleetFilterParams(
        risk_category=risk_category,
        search=search,
        dataset_id=dataset_id,
        sort_by=sort_by,
        sort_order=sort_order
    )
    items, total = repo.get_fleet_machines(filters, page, page_size)
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    paginated = PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )
    return APIResponse(data=paginated, request_id=getattr(request.state, "request_id", None))


@router.get("/summary", response_model=APIResponse[FleetSummary])
async def get_fleet_summary(
    request: Request,
    dataset_id: Optional[str] = Query(default=None),
    db: DatabaseManager = Depends(get_db)
):
    """Returns total machines, risk counts (Healthy, Watch, Critical), and averages."""
    repo = FleetRepository(db)
    summary = repo.get_fleet_summary(dataset_id=dataset_id)
    return APIResponse(data=summary, request_id=getattr(request.state, "request_id", None))
