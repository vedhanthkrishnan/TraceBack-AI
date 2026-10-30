"""TraceBack AI - End-to-End Analytics Integration Test
"""
import pytest
from backend.app.db.connection import db_manager
from backend.app.services.ingestion_service import IngestionService
from backend.app.workers.pipeline import AnalyticsPipelineWorker
from backend.app.repositories.fleet_repository import FleetRepository
from backend.scripts.generate_synthetic_fleet import generate_synthetic_fleet


def test_full_pipeline_execution_and_idempotency():
    # 1. Ingest small deterministic batch
    df = generate_synthetic_fleet(num_machines=3, max_cycles=50, random_seed=99)
    ingestion = IngestionService(db_manager)
    res1 = ingestion.ingest_readings_dataframe(df, source_name="integration_test.csv", batch_id="int_001")
    assert res1["status"] == "COMPLETED"
    assert res1["machines_loaded"] == 3

    # Idempotent re-ingestion must succeed without primary key conflict
    res2 = ingestion.ingest_readings_dataframe(df, source_name="integration_test.csv", batch_id="int_002")
    assert res2["status"] == "COMPLETED"

    # 2. Execute analytics pipeline
    worker = AnalyticsPipelineWorker(db_manager)
    status = worker.execute_pipeline(dataset_id="SYNTHETIC_FLEET_DEMO", pipeline_version="test_v1")
    assert status.status == "SUCCESS"
    assert status.machines_processed >= 3

    # 3. Verify fleet repository reflects computed results
    fleet_repo = FleetRepository(db_manager)
    summary = fleet_repo.get_fleet_summary(dataset_id="SYNTHETIC_FLEET_DEMO")
    assert summary.total_machines >= 3
