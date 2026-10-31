"""TraceBack AI - Synthetic Fleet Generator

Generates reproducible synthetic industrial sensor degradation trajectories.
Explicitly labelled as synthetic data for evaluation and benchmarking.
"""
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd


def generate_synthetic_fleet(
    num_machines: int = 15,
    max_cycles: int = 150,
    random_seed: int = 42,
    output_path: Optional[str] = None
) -> pd.DataFrame:
    """Generates synthetic run-to-failure sensor data with controlled degradation drift."""
    np.random.seed(random_seed)

    records: List[Dict[str, Any]] = []

    # Sensor baseline nominal values and standard deviations
    nominal_means = {
        "s1": 518.67, "s2": 642.50, "s3": 1585.0, "s4": 1405.0, "s5": 14.62,
        "s6": 21.61, "s7": 553.50, "s8": 2388.05, "s9": 9050.0, "s10": 1.30,
        "s11": 47.30, "s12": 521.80, "s13": 2388.08, "s14": 8130.0, "s15": 8.42,
        "s16": 0.03, "s17": 392.0, "s18": 2388.0, "s19": 100.0, "s20": 38.90,
        "s21": 23.30
    }
    nominal_stds = {
        "s1": 0.00, "s2": 0.50, "s3": 6.0, "s4": 8.0, "s5": 0.00,
        "s6": 0.05, "s7": 0.80, "s8": 0.07, "s9": 12.0, "s10": 0.00,
        "s11": 0.25, "s12": 0.60, "s13": 0.06, "s14": 15.0, "s15": 0.04,
        "s16": 0.00, "s17": 1.5, "s18": 0.00, "s19": 0.00, "s20": 0.15,
        "s21": 0.12
    }

    # Constant sensors (zero variance in real engines)
    constant_sensors = {"s1", "s5", "s10", "s16", "s18", "s19"}

    for m_idx in range(1, num_machines + 1):
        mid = f"M{m_idx:03d}"
        # Machine lifespan
        low_bound = min(40, max(20, max_cycles - 30))
        high_bound = max(low_bound + 1, max_cycles + 1)
        lifetime = np.random.randint(low_bound, high_bound)
        # Onset of degradation between 35% and 60% of lifetime
        onset_cycle = int(lifetime * np.random.uniform(0.35, 0.60))

        # Select 2 to 4 degradation sensors
        candidate_drift_sensors = ["s2", "s3", "s4", "s7", "s8", "s9", "s11", "s12", "s14", "s15", "s17", "s20", "s21"]
        active_drift = np.random.choice(candidate_drift_sensors, size=np.random.randint(2, 5), replace=False)

        for cycle in range(1, lifetime + 1):
            row: Dict[str, Any] = {
                "machine_id": mid,
                "cycle": cycle,
                "op_setting_1": round(float(np.random.normal(0.0, 0.002)), 4),
                "op_setting_2": round(float(np.random.normal(0.0, 0.0002)), 4),
                "op_setting_3": 100.0,
                "dataset_id": "SYNTHETIC_FLEET_DEMO"
            }

            # Generate sensor readings
            for s, mean_val in nominal_means.items():
                std_val = nominal_stds[s]
                if s in constant_sensors or std_val == 0.0:
                    val = mean_val
                else:
                    noise = np.random.normal(0.0, std_val)
                    drift = 0.0
                    if s in active_drift and cycle > onset_cycle:
                        progress = (cycle - onset_cycle) / float(lifetime - onset_cycle)
                        # Exponential or quadratic degradation drift
                        drift = (progress ** 1.8) * std_val * 4.5 * (1.0 if s in ["s3", "s4", "s11", "s15"] else -1.0)
                    val = mean_val + noise + drift

                row[s] = round(float(val), 4)

            records.append(row)

    df = pd.DataFrame(records)

    if output_path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(out, index=False)
        print(f"Synthetic fleet saved: {len(df)} records for {num_machines} machines to {output_path}")

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic industrial fleet dataset.")
    parser.add_argument("--machines", type=int, default=15, help="Number of machines to simulate")
    parser.add_argument("--cycles", type=int, default=140, help="Maximum operating cycles")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--out", type=str, default="data/synthetic_fleet.csv", help="Output CSV path")
    args = parser.parse_args()

    generate_synthetic_fleet(args.machines, args.cycles, args.seed, args.out)
