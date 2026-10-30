"""TraceBack AI - Main API Router Assembly
"""
from fastapi import APIRouter
from backend.app.api.routes import (
    health,
    fleet,
    machines,
    analytics,
    groups,
    copilot,
    benchmarks,
    ingestion
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(fleet.router)
api_router.include_router(machines.router)
api_router.include_router(analytics.router)
api_router.include_router(groups.router)
api_router.include_router(copilot.router)
api_router.include_router(benchmarks.router)
api_router.include_router(ingestion.router)
