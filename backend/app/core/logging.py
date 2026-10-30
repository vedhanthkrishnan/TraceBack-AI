"""TraceBack AI - Structured Logging System

Provides uniform, sanitized logging across database, pipeline, and API layers.
"""
import logging
import sys
import re
from typing import Any, Dict


SECRET_KEYS_PATTERN = re.compile(r"(password|api_key|secret|token|authorization)", re.IGNORECASE)


class SensitiveDataFilter(logging.Filter):
    """Filters out sensitive credentials from log records."""
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            # Redact password-like patterns
            record.msg = re.sub(r"(password=)['\"][^'\"]*['\"]", r"\1'***REDACTED***'", record.msg, flags=re.I)
            record.msg = re.sub(r"(api_key=)['\"][^'\"]*['\"]", r"\1'***REDACTED***'", record.msg, flags=re.I)
        return True


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configures structured logger with security filters."""
    logger = logging.getLogger("traceback_ai")
    level = getattr(logging, log_level.upper(), logging.INFO)
    logger.setLevel(level)

    # Avoid duplicate handlers if re-initialized
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        handler.addFilter(SensitiveDataFilter())
        logger.addHandler(handler)

    return logger


logger = setup_logging()
