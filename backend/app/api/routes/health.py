"""TraceBack AI - Health & System Status Endpoints
"""
import time
from fastapi import APIRouter, Depends, Request
from backend.app.schemas.common import APIResponse, HealthStatus, ReadinessStatus
from backend.app.db.connection import DatabaseManager, get_db
from backend.app.copilot.provider import get_llm_provider
from backend.app.core.config import settings

router = APIRouter(tags=["System & Status"])


@router.get("/health", response_model=APIResponse[HealthStatus])
async def get_service_health(request: Request, db: DatabaseManager = Depends(get_db)):
    """Returns application health and database connection state."""
    db_ok = db.ping()
    provider = get_llm_provider()

    status = HealthStatus(
        status="healthy" if db_ok else "degraded",
        timestamp=str(time.time()),
        database={
            "connected": db_ok,
            "engine": "Mock Engine (Isolated SQLite)" if db.is_mock else "Exasol Personal 7.1+",
            "is_mock": db.is_mock,
            "dsn": settings.EXASOL_DSN
        },
        copilot={
            "provider": provider.provider_name,
            "is_configured": provider.is_configured
        }
    )
    return APIResponse(data=status, request_id=getattr(request.state, "request_id", None))


@router.get("/readiness", response_model=APIResponse[ReadinessStatus])
async def get_service_readiness(request: Request, db: DatabaseManager = Depends(get_db)):
    """Checks whether the backend and data are ready to serve queries."""
    db_ok = db.ping()
    schema_ok = False
    active_ds = None
    pipe_status = None
    provider = get_llm_provider()

    if db_ok:
        try:
            df = db.export_to_pandas("SELECT COUNT(*) AS c FROM MACHINE_HEALTH")
            schema_ok = True
            ds_df = db.export_to_pandas("SELECT dataset_id FROM MACHINE_READINGS LIMIT 1")
            if not ds_df.empty:
                active_ds = str(ds_df.iloc[0]["dataset_id"])
            p_df = db.export_to_pandas("SELECT status FROM PIPELINE_RUNS ORDER BY start_time DESC LIMIT 1")
            if not p_df.empty:
                pipe_status = str(p_df.iloc[0]["status"])
        except Exception:
            schema_ok = False

    # Determine explicit dataset mode
    if active_ds == "NASA_FD001":
        ds_mode = "REAL_NASA_CMAPSS_FD001"
    elif active_ds == "SYNTHETIC_FLEET_DEMO":
        ds_mode = "SYNTHETIC_FLEET_DEMO"
    elif active_ds:
        ds_mode = f"CUSTOM_{active_ds}"
    else:
        ds_mode = "NO_DATA"

    engine_str = "Mock Engine (Isolated SQLite)" if db.is_mock else "Exasol Personal 7.1+"

    notes = []
    if db_ok:
        notes.append(f"Database responsive on {engine_str}")
    if schema_ok:
        notes.append("Relational schema verified")
    if active_ds:
        notes.append(f"Loaded dataset: {ds_mode}")
    if not schema_ok or not active_ds:
        notes.append("Run 'python backend/scripts/seed_demo.py' to seed demonstration fleet")

    readiness = ReadinessStatus(
        ready=bool(db_ok and schema_ok and active_ds is not None),
        database_connected=db_ok,
        schema_initialized=schema_ok,
        engine=engine_str,
        is_mock=db.is_mock,
        dataset_mode=ds_mode,
        active_dataset=active_ds,
        llm_provider=provider.provider_name,
        pipeline_status=pipe_status,
        notes=notes
    )
    return APIResponse(data=readiness, request_id=getattr(request.state, "request_id", None))
