"""TraceBack AI - Signature Groups Endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, Request
from backend.app.schemas.common import APIResponse
from backend.app.schemas.analytics import SignatureGroup
from backend.app.repositories.analytics_repository import AnalyticsRepository
from backend.app.db.connection import DatabaseManager, get_db

router = APIRouter(prefix="/groups", tags=["Signature Groups & Archetypes"])


@router.get("", response_model=APIResponse[List[SignatureGroup]])
async def list_signature_groups(request: Request, db: DatabaseManager = Depends(get_db)):
    """Returns clustered failure signature groups and archetype patterns."""
    repo = AnalyticsRepository(db)
    groups = repo.get_signature_groups()
    return APIResponse(data=groups, request_id=getattr(request.state, "request_id", None))


@router.get("/{group_id}", response_model=APIResponse[SignatureGroup])
async def get_signature_group_detail(group_id: str, request: Request, db: DatabaseManager = Depends(get_db)):
    """Returns details and member machines for a specific signature group."""
    repo = AnalyticsRepository(db)
    group = repo.get_signature_group_detail(group_id)
    return APIResponse(data=group, request_id=getattr(request.state, "request_id", None))
