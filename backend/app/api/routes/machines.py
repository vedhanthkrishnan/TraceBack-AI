"""TraceBack AI - Machine Investigation Endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Request
from backend.app.schemas.common import APIResponse
from backend.app.schemas.machine import (
    MachineDetail,
    MachineHealthHistoryResponse,
    MachineSensorsResponse,
    MachineComparisonRequest,
    MachineComparisonResponse
)
from backend.app.schemas.analytics import (
    MachineRootCauseResponse,
    MachineSignaturesResponse,
    ConsolidatedEvidenceBundle
)
from backend.app.repositories.machine_repository import MachineRepository
from backend.app.repositories.analytics_repository import AnalyticsRepository
from backend.app.db.connection import DatabaseManager, get_db

router = APIRouter(prefix="/machines", tags=["Machine Investigation"])


@router.get("/{machine_id}", response_model=APIResponse[MachineDetail])
async def get_machine_detail(
    machine_id: str,
    request: Request,
    db: DatabaseManager = Depends(get_db)
):
    """Returns current health score, risk category, and key diagnostic metrics for a machine."""
    repo = MachineRepository(db)
    detail = repo.get_machine_detail(machine_id)
    return APIResponse(data=detail, request_id=getattr(request.state, "request_id", None))


@router.get("/{machine_id}/history", response_model=APIResponse[MachineHealthHistoryResponse])
async def get_machine_history(
    machine_id: str,
    request: Request,
    db: DatabaseManager = Depends(get_db)
):
    """Returns health and risk trajectory over all operating cycles for trend charts."""
    repo = MachineRepository(db)
    history = repo.get_machine_history(machine_id)
    return APIResponse(data=history, request_id=getattr(request.state, "request_id", None))


@router.get("/{machine_id}/sensors", response_model=APIResponse[MachineSensorsResponse])
async def get_machine_sensors(
    machine_id: str,
    request: Request,
    db: DatabaseManager = Depends(get_db)
):
    """Returns sensor baselines and current cycle drift metrics."""
    repo = MachineRepository(db)
    sensors = repo.get_machine_sensors(machine_id)
    return APIResponse(data=sensors, request_id=getattr(request.state, "request_id", None))


@router.get("/{machine_id}/root-cause", response_model=APIResponse[MachineRootCauseResponse])
async def get_machine_root_cause(
    machine_id: str,
    request: Request,
    db: DatabaseManager = Depends(get_db)
):
    """Returns ranked sensor evidence with deviation magnitudes, drift rates, and explanations."""
    repo = AnalyticsRepository(db)
    evidence = repo.get_root_cause_evidence(machine_id)
    return APIResponse(data=evidence, request_id=getattr(request.state, "request_id", None))


@router.get("/{machine_id}/signatures", response_model=APIResponse[MachineSignaturesResponse])
async def get_machine_signatures(
    machine_id: str,
    request: Request,
    db: DatabaseManager = Depends(get_db)
):
    """Returns failure signatures and matching historical cases for the machine."""
    repo = AnalyticsRepository(db)
    signatures = repo.get_failure_signatures(machine_id)
    return APIResponse(data=signatures, request_id=getattr(request.state, "request_id", None))


@router.get("/{machine_id}/evidence", response_model=APIResponse[ConsolidatedEvidenceBundle])
async def get_machine_evidence_bundle(
    machine_id: str,
    request: Request,
    db: DatabaseManager = Depends(get_db)
):
    """Returns a consolidated evidence bundle combining health, root cause, drift, and historical matches."""
    repo = AnalyticsRepository(db)
    bundle = repo.get_consolidated_evidence_bundle(machine_id)
    return APIResponse(data=bundle, request_id=getattr(request.state, "request_id", None))


@router.get("/{machine_id}/comparisons", response_model=APIResponse[MachineSignaturesResponse])
async def get_machine_comparisons(
    machine_id: str,
    request: Request,
    db: DatabaseManager = Depends(get_db)
):
    """Returns comparable historical machines with similarity metrics."""
    repo = AnalyticsRepository(db)
    matches = repo.get_failure_signatures(machine_id)
    return APIResponse(data=matches, request_id=getattr(request.state, "request_id", None))


@router.post("/compare", response_model=APIResponse[MachineComparisonResponse])
async def compare_multiple_machines(
    req: MachineComparisonRequest,
    request: Request,
    db: DatabaseManager = Depends(get_db)
):
    """Cross-evaluates two or more machines to highlight shared and divergent anomalies."""
    repo = MachineRepository(db)
    comp = repo.compare_machines(req.machine_ids)
    return APIResponse(data=comp, request_id=getattr(request.state, "request_id", None))
