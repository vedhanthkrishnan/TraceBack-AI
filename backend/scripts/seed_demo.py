"""TraceBack AI - Judge-Ready Demo Seeding Script

Prepares a reproducible demo environment:
1. Generates/loads verified multi-engine fleet data.
2. Executes real analytics pipeline (Baselines -> Drift -> Health -> Root Cause -> Signatures).
3. Identifies and prints a critical deteriorating machine with genuine ranked evidence.
4. Outputs prepared test questions for the AI Copilot.
"""
import sys
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.app.db.connection import db_manager
from backend.app.services.ingestion_service import IngestionService
from backend.app.workers.pipeline import AnalyticsPipelineWorker
from backend.app.repositories.fleet_repository import FleetRepository
from backend.app.repositories.machine_repository import MachineRepository
from backend.app.repositories.analytics_repository import AnalyticsRepository
from backend.scripts.generate_synthetic_fleet import generate_synthetic_fleet
from backend.app.core.logging import logger


def seed_demo_environment():
    print("=" * 70)
    print("   TRACEBACK AI — PREDICTIVE MAINTENANCE DEMO SEED WORKFLOW")
    print("=" * 70)

    # 1. Initialize Schema
    print("\n[Step 1/5] Initializing Database Schema...")
    db_manager.init_schema()
    print(f"-> Database ready. Active engine: {'Isolated Mock Engine (SQLite)' if db_manager.is_mock else 'Exasol Personal 7.1+'}")

    # Clean existing demo records to ensure deterministic demo state
    db_manager.execute("DELETE FROM MACHINE_READINGS WHERE dataset_id = 'SYNTHETIC_FLEET_DEMO';")
    db_manager.execute("DELETE FROM SENSOR_DRIFT WHERE dataset_id = 'SYNTHETIC_FLEET_DEMO';")
    db_manager.execute("DELETE FROM MACHINE_HEALTH WHERE dataset_id = 'SYNTHETIC_FLEET_DEMO';")
    db_manager.execute("DELETE FROM FAILURE_SIGNATURES WHERE source_dataset = 'SYNTHETIC_FLEET_DEMO';")

    # 2. Ingest Sample Fleet Data
    print("\n[Step 2/5] Ingesting Demo Fleet Data (12 Turbofan Engines)...")
    demo_df = generate_synthetic_fleet(num_machines=12, max_cycles=130, random_seed=104)
    ingestion = IngestionService(db_manager)
    ingest_res = ingestion.ingest_readings_dataframe(
        demo_df,
        source_name="demo_turbofan_fleet.csv",
        batch_id="demo_batch_001"
    )
    print(f"-> Loaded {ingest_res['rows_loaded']} sensor readings across {ingest_res['machines_loaded']} machines.")

    # 3. Execute Real Analytics Pipeline
    print("\n[Step 3/5] Running Real Predictive Analytics Pipeline...")
    worker = AnalyticsPipelineWorker(db_manager)
    pipe_res = worker.execute_pipeline(dataset_id="SYNTHETIC_FLEET_DEMO", pipeline_version="v1.0")
    print(f"-> Pipeline completed in {pipe_res.processing_duration_sec}s with status: {pipe_res.status}.")

    # 4. Inspect Seeded Fleet & Identify Deteriorating Machine
    print("\n[Step 4/5] Inspecting Analytics Evidence...")
    fleet_repo = FleetRepository(db_manager)
    machine_repo = MachineRepository(db_manager)
    analytics_repo = AnalyticsRepository(db_manager)

    fleet_summary = fleet_repo.get_fleet_summary(dataset_id="SYNTHETIC_FLEET_DEMO")
    print(f"-> Fleet Health: {fleet_summary.total_machines} machines | "
          f"Critical: {fleet_summary.critical_count} | "
          f"Watch: {fleet_summary.watch_count} | "
          f"Healthy: {fleet_summary.healthy_count}")

    # Find highest risk machine
    machines, _ = fleet_repo.get_fleet_machines(
        filters=type("Filter", (), {"dataset_id": "SYNTHETIC_FLEET_DEMO", "risk_category": None, "search": None, "sort_by": "risk_score", "sort_order": "desc"})(),
        page=1, page_size=1
    )

    if machines:
        top_m = machines[0]
        mid = top_m.machine_id
        detail = machine_repo.get_machine_detail(mid)
        evidence = analytics_repo.get_root_cause_evidence(mid)
        signatures = analytics_repo.get_failure_signatures(mid)

        print("\n" + "-" * 70)
        print(f"   DEMO SHOWCASE MACHINE: {mid}")
        print("-" * 70)
        print(f"- Evaluation Cycle: {detail.current_cycle}")
        print(f"- Risk Score: {detail.risk_score}/100 -> Classification: {detail.risk_category}")
        print(f"- First Sustained Anomaly: Cycle {detail.first_sustained_anomaly_cycle}")
        print(f"- Estimated Remaining Useful Life (RUL): {detail.estimated_rul} cycles (Confidence: {detail.rul_confidence})")
        print("\nTop Root-Cause Sensor Evidence:")
        for e in evidence.evidence_items[:3]:
            print(f"  * [Rank {e.rank}] {e.sensor_name}: Deviation {e.deviation_magnitude} std, "
                  f"Drift Rate {e.drift_rate:.4f}/cycle, Persistence {e.persistence} cycles")
            print(f"    Explanation: {e.evidence_explanation}")

        print("\nHistorical Run-to-Failure Matches:")
        if signatures.matches:
            for m in signatures.matches[:2]:
                print(f"  * Match {m.matched_machine_id}: Similarity {int(m.similarity_score*100)}%, "
                      f"Shared sensors: {', '.join(m.shared_sensor_evidence)}")
        else:
            print("  * No historical matches exceeding similarity threshold.")

    # 5. Suggested Judge Questions
    print("\n" + "=" * 70)
    print("   PREPARED AI COPILOT QUESTIONS FOR JUDGES")
    print("=" * 70)
    print(f"1. 'Why is Machine {mid} classified as {detail.risk_category}?'")
    print(f"2. 'Which sensors show the strongest evidence of deterioration for {mid}?'")
    print(f"3. 'When did abnormal behavior begin on Machine {mid}?'")
    print(f"4. 'Compare Machine {mid} with M001.'")
    print(f"5. 'Explain how TraceBack calculates its health index and risk thresholds.'")
    print("=" * 70)
    print("\nDemo seeding completed successfully! Backend is ready to serve frontend and API requests.\n")


if __name__ == "__main__":
    seed_demo_environment()
