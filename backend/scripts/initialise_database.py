"""TraceBack AI - Database Initialization Script
"""
import sys
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.app.db.connection import db_manager
from backend.app.core.logging import logger


def init_db():
    logger.info("Running database initialisation script...")
    db_manager.init_schema()
    logger.info("Database schema initialised successfully.")


if __name__ == "__main__":
    init_db()
