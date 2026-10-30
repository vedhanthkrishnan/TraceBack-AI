"""TraceBack AI - NASA C-MAPSS Dataset Downloader & Local Cache

Downloads the authentic NASA Turbofan Engine Degradation Simulation Dataset (C-MAPSS) FD001.
If offline or network is restricted, clearly creates an explicitly labelled synthetic fallback file.
Never masks synthetic data as the official NASA dataset.
"""
import os
import sys
from pathlib import Path
from typing import Tuple

# Add repository root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import httpx
from backend.app.core.logging import logger
from backend.scripts.generate_synthetic_fleet import generate_synthetic_fleet


# Primary verified GitHub mirror of NASA C-MAPSS FD001 dataset
NASA_FD001_MIRRORS = [
    "https://raw.githubusercontent.com/hankroark/Turbofan-Engine-Degradation/master/CMAPSSData/train_FD001.txt",
    "https://raw.githubusercontent.com/ari-dasci/OD-AP/master/data/Turbofan/train_FD001.txt"
]


def download_or_prepare_dataset(target_dir: str = "data") -> Tuple[Path, str]:
    """Ensures NASA C-MAPSS or clearly labelled synthetic dataset is present locally.
    
    Returns:
        Tuple[Path, str]: (path_to_file, dataset_id)
            - dataset_id is 'NASA_FD001' for genuine NASA data.
            - dataset_id is 'SYNTHETIC_FLEET_DEMO' for synthetic fallback.
    """
    dir_path = Path(target_dir)
    dir_path.mkdir(parents=True, exist_ok=True)
    real_file = dir_path / "train_FD001.txt"
    synthetic_file = dir_path / "synthetic_fleet_demo.txt"

    # 1. Check if real NASA dataset already cached locally
    if real_file.exists() and real_file.stat().st_size > 100000:  # Real C-MAPSS FD001 is ~2.8MB
        logger.info(f"Verified authentic NASA C-MAPSS dataset exists at: {real_file}")
        return real_file, "NASA_FD001"

    # 2. Try downloading authentic NASA C-MAPSS from verified mirrors
    for mirror_url in NASA_FD001_MIRRORS:
        logger.info(f"Attempting download of NASA C-MAPSS dataset from {mirror_url}...")
        try:
            with httpx.Client(timeout=25.0, follow_redirects=True) as client:
                resp = client.get(mirror_url)
                if resp.status_code == 200 and len(resp.text) > 100000:
                    with open(real_file, "w", encoding="utf-8") as f:
                        f.write(resp.text)
                    logger.info(f"Successfully downloaded genuine NASA C-MAPSS dataset ({real_file.stat().st_size} bytes).")
                    return real_file, "NASA_FD001"
        except Exception as e:
            logger.warning(f"Download attempt from {mirror_url} failed: {e}")

    # 3. If offline / download failed, explicitly create a labelled synthetic fallback
    logger.warning("[DATA NOTICE] Could not reach online NASA mirrors. Generating explicitly labelled synthetic fallback fleet.")
    if not synthetic_file.exists():
        df = generate_synthetic_fleet(num_machines=20, max_cycles=130, random_seed=42)
        with open(synthetic_file, "w", encoding="utf-8") as f:
            for _, row in df.iterrows():
                mid_int = int(str(row["machine_id"]).replace("M", ""))
                line_parts = [
                    str(mid_int), str(int(row["cycle"])),
                    f"{row['op_setting_1']:.4f}", f"{row['op_setting_2']:.4f}", f"{row['op_setting_3']:.1f}"
                ]
                for i in range(1, 22):
                    line_parts.append(f"{row[f's{i}']:.4f}")
                f.write(" ".join(line_parts) + "\n")
        logger.info(f"Created labelled synthetic fallback dataset at {synthetic_file}.")

    return synthetic_file, "SYNTHETIC_FLEET_DEMO"


if __name__ == "__main__":
    path, ds_id = download_or_prepare_dataset()
    print(f"Dataset ready at: {path} (Dataset ID: {ds_id})")
