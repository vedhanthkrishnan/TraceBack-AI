"""TraceBack AI - Custom Application Exceptions
"""
from typing import Optional, Dict, Any


class TraceBackException(Exception):
    """Base exception for all TraceBack domain errors."""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class DatabaseConnectionError(TraceBackException):
    """Raised when the Exasol database cannot be reached."""
    def __init__(self, message: str = "Unable to connect to Exasol database.", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=503, details=details)


class MachineNotFoundError(TraceBackException):
    """Raised when an unknown machine ID is requested."""
    def __init__(self, machine_id: str):
        super().__init__(
            message=f"Machine '{machine_id}' was not found in the database.",
            status_code=404,
            details={"machine_id": machine_id}
        )


class DataValidationError(TraceBackException):
    """Raised when incoming dataset records or parameters fail validation."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=422, details=details)


class PipelineExecutionError(TraceBackException):
    """Raised when an analytics pipeline execution fails or encounters a conflict."""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=status_code, details=details)


class CopilotError(TraceBackException):
    """Raised when the AI Copilot encounters an orchestration or provider error."""
    def __init__(self, message: str, status_code: int = 502, details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=status_code, details=details)


class RateLimitExceededError(TraceBackException):
    """Raised when client exceeds the allowed request rate."""
    def __init__(self, message: str = "Rate limit exceeded. Please retry later."):
        super().__init__(message=message, status_code=429)
