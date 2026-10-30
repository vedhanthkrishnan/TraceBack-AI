"""TraceBack AI - Pipeline Execution Script
"""
import sys
import argparse
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.app.workers.pipeline import AnalyticsPipelineWorker


def main():
    parser = argparse.ArgumentParser(description="Trigger full TraceBack analytics pipeline.")
    parser.add_argument("--dataset-id", type=str, default="NASA_FD001", help="Dataset identifier to process")
    parser.add_argument("--version", type=str, default="v1.0", help="Pipeline version label")
    args = parser.parse_args()

    worker = AnalyticsPipelineWorker()
    status = worker.execute_pipeline(dataset_id=args.dataset_id, pipeline_version=args.version)
    print("\nPipeline Execution Summary:")
    print(f"- Run ID: {status.run_id}")
    print(f"- Status: {status.status}")
    print(f"- Rows processed: {status.rows_processed}")
    print(f"- Machines processed: {status.machines_processed}")
    print(f"- Duration: {status.processing_duration_sec}s")


if __name__ == "__main__":
    main()
