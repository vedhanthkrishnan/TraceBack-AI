"""TraceBack AI - Main Application Entrypoint

FastAPI service for industrial predictive maintenance analytics and evidence-driven AI Copilot.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.security import RequestContextMiddleware
from backend.app.core.exceptions import TraceBackException
from backend.app.db.connection import db_manager
from backend.app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event handler for database readiness and teardown."""
    logger.info("Initializing TraceBack AI Backend...")
    try:
        db_manager.init_schema()
        logger.info(f"Database readiness verified. Engine: {'Mock SQLite' if db_manager.is_mock else 'Exasol Personal'}")
    except Exception as exc:
        logger.warning(f"Database startup warning: {exc}")
    yield
    logger.info("Shutting down TraceBack AI Backend...")
    db_manager.close()


app = FastAPI(
    title="TraceBack AI - Predictive Maintenance Platform",
    description="Evidence-driven predictive maintenance backend powered by Exasol database analytics and AI Copilot.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Request context and rate limiting middleware
app.add_middleware(RequestContextMiddleware)

# Explicit CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"]
)

# Include API v1 router
app.include_router(api_router)


# Global Exception Handlers
@app.exception_handler(TraceBackException)
async def traceback_exception_handler(request: Request, exc: TraceBackException):
    request_id = getattr(request.state, "request_id", None)
    logger.warning(f"TraceBackException [{exc.status_code}]: {exc.message} (Request ID: {request_id})")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.__class__.__name__,
            "message": exc.message,
            "details": exc.details,
            "request_id": request_id
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", None)
    logger.warning(f"Request validation error: {exc.errors()} (Request ID: {request_id})")
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "RequestValidationError",
            "message": "Invalid request parameters or payload.",
            "details": {"validation_errors": exc.errors()},
            "request_id": request_id
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    logger.error(f"Unhandled server error: {exc} (Request ID: {request_id})", exc_info=True)
    # Safe error response: do not expose internal stack traces or secrets to callers
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "InternalServerError",
            "message": "An unexpected error occurred while processing your request. Please check operational logs.",
            "request_id": request_id
        }
    )
