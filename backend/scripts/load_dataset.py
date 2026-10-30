"""TraceBack AI - Dataset Ingestion Script
"""
import sys
import argparse
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.app.services.ingestion_service import IngestionService
from backend.app.core.logging import logger
from backend.scripts.download_dataset import download_or_prepare_dataset


def main():
    parser = argparse.ArgumentParser(description="Ingest NASA C-MAPSS or synthetic dataset into TraceBack database.")
    parser.add_argument("--file", type=str, default=None, help="Path to raw dataset file")
    parser.add_argument("--dataset-id", type=str, default="NASA_FD001", help="Dataset identifier tag")
    args = parser.parse_args()

    file_to_load = args.file
    dataset_id = args.dataset_id
    if not file_to_load:
        target_path, detected_id = download_or_prepare_dataset()
        file_to_load = str(target_path)
        if args.dataset_id == "NASA_FD001" and detected_id != "NASA_FD001":
            dataset_id = detected_id

    ingestion_service = IngestionService()
    result = ingestion_service.load_cmapss_file(file_to_load, dataset_id=dataset_id)
    print("\nIngestion Summary:")
    print(f"- Batch ID: {result['batch_id']}")
    print(f"- Status: {result['status']}")
    print(f"- Rows loaded: {result['rows_loaded']}")
    print(f"- Machines loaded: {result['machines_loaded']}")
    print(f"- Dataset ID: {result['dataset_id']}")


if __name__ == "__main__":
    main()
