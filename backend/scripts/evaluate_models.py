"""TraceBack AI - Rigorous Model Evaluation & Leakage Verification

Evaluates predictive maintenance performance on held-out engines:
1. Strict split by engine/unit ID (no mixing rows between train/test).
2. Healthy baseline statistics fitted strictly on training engines.
3. Feature preprocessing (z-scores and rolling drift) prevents future leakage.
4. RUL evaluation: Ridge Regression vs Mean Baseline (MAE, RMSE, R2).
5. Anomaly Detection evaluation: Early warning lead time before run-to-failure.
6. Outputs verifiable evaluation metrics saved to data/model_evaluation_report.json.
"""
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

# Add repository root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.app.services.data_validation_service import EXPECTED_READING_COLUMNS
from backend.scripts.download_dataset import download_or_prepare_dataset


def run_model_evaluation(
    data_file: Optional[str] = None,
    train_ratio: float = 0.70,
    max_rul_cap: float = 125.0,
    baseline_window: int = 30,
    drift_window: int = 15,
    output_report_path: str = "data/model_evaluation_report.json"
) -> Dict[str, Any]:
    """Executes leakage-free model evaluation on held-out turbofan engines."""
    # 1. Resolve dataset
    if not data_file:
        target_path, ds_id = download_or_prepare_dataset()
        data_file = str(target_path)
    else:
        ds_id = "CUSTOM_FILE"

    file_path = Path(data_file)
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset file does not exist: {data_file}")

    print("=" * 75)
    print("   TRACEBACK AI — LEAKAGE-FREE MODEL & ANALYTICS EVALUATION")
    print("=" * 75)
    print(f"Dataset source: {file_path.name}")
    print(f"Dataset mode:   {ds_id}")

    # Load dataset
    df = pd.read_csv(
        file_path,
        sep=r"\s+",
        header=None,
        usecols=range(26),
        names=EXPECTED_READING_COLUMNS
    )
    df["machine_id"] = df["machine_id"].apply(lambda x: f"M{int(x):03d}")

    total_rows = len(df)
    unique_engines = df["machine_id"].unique()
    num_engines = len(unique_engines)
    print(f"Loaded records: {total_rows:,} rows across {num_engines} engines.")

    # 2. Strict split by engine/machine ID
    np.random.seed(42)
    shuffled_engines = np.random.permutation(unique_engines)
    split_idx = int(num_engines * train_ratio)
    train_engine_ids = set(shuffled_engines[:split_idx])
    test_engine_ids = set(shuffled_engines[split_idx:])

    print(f"Train/Test split: {len(train_engine_ids)} train engines ({train_ratio*100:.0f}%), "
          f"{len(test_engine_ids)} held-out test engines ({(1-train_ratio)*100:.0f}%).")

    train_df = df[df["machine_id"].isin(train_engine_ids)].copy()
    test_df = df[df["machine_id"].isin(test_engine_ids)].copy()

    # 3. Fit baseline statistics strictly on healthy training cycles (cycle <= baseline_window)
    healthy_train = train_df[train_df["cycle"] <= baseline_window]
    sensor_cols = [f"s{i}" for i in range(1, 22)]

    baseline_means: Dict[str, float] = {}
    baseline_stds: Dict[str, float] = {}

    for s in sensor_cols:
        s_vals = healthy_train[s].dropna()
        mean_v = float(s_vals.mean())
        std_v = float(s_vals.std(ddof=1)) if len(s_vals) > 1 else 1e-6
        # Safe std fallback
        safe_std = std_v if std_v > 1e-6 else 1e-6
        baseline_means[s] = mean_v
        baseline_stds[s] = safe_std

    # 4. Feature engineering (z-score and rolling drift) without future leakage
    def compute_features_and_targets(dataset_subset: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        processed_records = []
        max_cycles = dataset_subset.groupby("machine_id")["cycle"].max().to_dict()

        for mid, group in dataset_subset.groupby("machine_id"):
            group = group.sort_values("cycle").reset_index(drop=True)
            engine_max = max_cycles[mid]

            # Compute normalized deviations using training baselines
            feature_matrix = {}
            for s in sensor_cols:
                raw_s = group[s].values
                norm_s = (raw_s - baseline_means[s]) / baseline_stds[s]
                # Rolling smoothed deviation (only past and current row: no future leakage)
                smooth_s = pd.Series(norm_s).rolling(window=drift_window, min_periods=1).mean().values
                feature_matrix[s] = smooth_s

            for i in range(len(group)):
                c = int(group.loc[i, "cycle"])
                # RUL target capped at max_rul_cap
                true_rul = min(max_rul_cap, float(engine_max - c))

                row_dict = {
                    "machine_id": mid,
                    "cycle": c,
                    "true_rul": true_rul
                }
                for s in sensor_cols:
                    row_dict[f"feat_{s}"] = float(feature_matrix[s][i])

                processed_records.append(row_dict)

        proc_df = pd.DataFrame(processed_records)
        feat_cols = [f"feat_{s}" for s in sensor_cols]
        return proc_df[feat_cols], proc_df["true_rul"]

    X_train, y_train = compute_features_and_targets(train_df)
    X_test, y_test = compute_features_and_targets(test_df)

    # 5. Fit Remaining Useful Life Ridge Model
    model = Ridge(alpha=1.0)
    model.fit(X_train, y_train)

    # Predictions (bounded >= 0)
    y_pred_test = np.maximum(0.0, model.predict(X_test))

    # Baseline comparison: Constant Mean prediction on test set
    mean_baseline_pred = np.full_like(y_test, fill_value=float(y_train.mean()))

    # Compute regression metrics
    model_mae = float(mean_absolute_error(y_test, y_pred_test))
    model_rmse = float(root_mean_squared_error(y_test, y_pred_test))
    model_r2 = float(r2_score(y_test, y_pred_test))

    baseline_mae = float(mean_absolute_error(y_test, mean_baseline_pred))
    baseline_rmse = float(root_mean_squared_error(y_test, mean_baseline_pred))

    mae_improvement_pct = ((baseline_mae - model_mae) / baseline_mae) * 100.0

    # 6. Evaluate Anomaly Detection & Early Warning Lead Times
    # For each held-out test engine, find first sustained anomaly and lead time before failure
    lead_times: List[int] = []
    max_cycles_test = test_df.groupby("machine_id")["cycle"].max().to_dict()

    for mid, group in test_df.groupby("machine_id"):
        group = group.sort_values("cycle").reset_index(drop=True)
        max_cyc = max_cycles_test[mid]

        first_alert = None
        for i in range(len(group)):
            cyc = int(group.loc[i, "cycle"])
            if cyc < baseline_window:
                continue

            # Check if any key sensor drifted significantly (z >= 2.5)
            z_hits = 0
            for s in sensor_cols:
                raw_val = group.loc[i, s]
                z = abs((raw_val - baseline_means[s]) / baseline_stds[s])
                if z >= 2.5:
                    z_hits += 1

            if z_hits >= 2:  # Multi-sensor anomaly
                first_alert = cyc
                break

        if first_alert is not None:
            lead = max(0, max_cyc - first_alert)
            lead_times.append(lead)
        else:
            lead_times.append(0)

    avg_lead_time = float(np.mean(lead_times)) if lead_times else 0.0
    median_lead_time = float(np.median(lead_times)) if lead_times else 0.0
    early_warning_rate = float(np.mean([1 if lt >= 20 else 0 for lt in lead_times])) * 100.0

    # Print summary
    print("\n" + "-" * 75)
    print("   MODEL EVALUATION RESULTS (HELD-OUT TEST ENGINES)")
    print("-" * 75)
    print(f"Remaining Useful Life (RUL) Regression:")
    print(f"  * Ridge Model MAE:        {model_mae:.2f} cycles")
    print(f"  * Ridge Model RMSE:       {model_rmse:.2f} cycles")
    print(f"  * Ridge Model R2 Score:   {model_r2:.3f}")
    print(f"  * Mean Baseline MAE:      {baseline_mae:.2f} cycles")
    print(f"  * Error Reduction:        {mae_improvement_pct:.1f}% improvement over baseline")
    print(f"\nEarly Warning Anomaly Detection:")
    print(f"  * Average Lead Time:      {avg_lead_time:.1f} cycles before failure")
    print(f"  * Median Lead Time:       {median_lead_time:.1f} cycles before failure")
    print(f"  * Early Warning Rate:     {early_warning_rate:.1f}% (alert >= 20 cycles ahead)")
    print("-" * 75)

    report_payload = {
        "dataset_name": file_path.name,
        "dataset_mode": ds_id,
        "total_records": total_rows,
        "total_engines": num_engines,
        "train_engines_count": len(train_engine_ids),
        "test_engines_count": len(test_engine_ids),
        "split_method": "Independent Engine ID Split (70/30) without row mixing",
        "rul_target_capping": max_rul_cap,
        "healthy_baseline_window": baseline_window,
        "metrics": {
            "rul_ridge_mae": round(model_mae, 2),
            "rul_ridge_rmse": round(model_rmse, 2),
            "rul_ridge_r2": round(model_r2, 3),
            "baseline_mean_mae": round(baseline_mae, 2),
            "baseline_mean_rmse": round(baseline_rmse, 2),
            "mae_improvement_percent": round(mae_improvement_pct, 1),
            "early_warning_lead_time_mean_cycles": round(avg_lead_time, 1),
            "early_warning_lead_time_median_cycles": round(median_lead_time, 1),
            "early_warning_success_rate_percent": round(early_warning_rate, 1)
        },
        "evaluation_timestamp": pd.Timestamp.now().isoformat()
    }

    out_path = Path(output_report_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)

    print(f"\nEvaluation report successfully saved to: {out_path}\n")
    return report_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate TraceBack AI models without data leakage.")
    parser.add_argument("--file", type=str, default=None, help="Path to C-MAPSS or synthetic file")
    parser.add_argument("--train-ratio", type=float, default=0.70, help="Train/test engine split ratio")
    parser.add_argument("--out", type=str, default="data/model_evaluation_report.json", help="Output JSON path")
    args = parser.parse_args()

    run_model_evaluation(data_file=args.file, train_ratio=args.train_ratio, output_report_path=args.out)
