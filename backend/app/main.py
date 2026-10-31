"""TraceBack AI - Main Application Entrypoint

FastAPI service for industrial predictive maintenance analytics and evidence-driven AI Copilot.
"""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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


# Serve the built React frontend (backend/app/static) from the same origin, so one server runs the whole app.
# The folder holds a production build of ../frontend created with VITE_API_BASE_URL=/api/v1.
# If it is missing, only the API is served (use `npm run dev` in frontend/ instead).
STATIC_DIR = (Path(__file__).parent / "static").resolve()
_RESERVED_PREFIXES = ("api/", "docs", "redoc", "openapi.json")

if (STATIC_DIR / "index.html").is_file():

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        """Serve a static asset if it exists, otherwise the SPA entry point (client-side routes)."""
        if full_path.startswith(_RESERVED_PREFIXES):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (STATIC_DIR / full_path).resolve()
        if full_path and candidate.is_file() and STATIC_DIR in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")


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
