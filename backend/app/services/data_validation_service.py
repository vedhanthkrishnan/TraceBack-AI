"""TraceBack AI - Data Validation Service

Validates incoming industrial sensor data, detects malformed files, missing values,
and verifies schema constraints before database ingestion.
"""
from typing import Dict, List, Tuple, Any
import numpy as np
import pandas as pd
from backend.app.core.exceptions import DataValidationError
from backend.app.core.logging import logger


EXPECTED_READING_COLUMNS = [
    "machine_id", "cycle", "op_setting_1", "op_setting_2", "op_setting_3",
    "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10",
    "s11", "s12", "s13", "s14", "s15", "s16", "s17", "s18", "s19", "s20", "s21"
]


class DataValidationService:
    """Validates sensor readings and datasets before loading."""

    @staticmethod
    def validate_readings_dataframe(df: pd.DataFrame) -> Tuple[bool, Dict[str, Any]]:
        """Performs rigorous quality checks on sensor reading DataFrames."""
        issues: List[str] = []
        metrics: Dict[str, Any] = {}

        if df.empty:
            raise DataValidationError("Dataset is empty. At least one row is required.")

        # Check required columns
        missing_cols = [c for c in EXPECTED_READING_COLUMNS if c not in df.columns]
        if missing_cols:
            raise DataValidationError(f"Missing required columns: {missing_cols}")

        metrics["total_rows"] = len(df)
        metrics["unique_machines"] = df["machine_id"].nunique()

        # Check machine_id
        if df["machine_id"].isnull().any():
            issues.append("Null machine identifiers found.")

        # Check cycle numbers
        if not pd.api.types.is_integer_dtype(df["cycle"]) and not pd.api.types.is_float_dtype(df["cycle"]):
            issues.append("Cycle column contains non-numeric values.")
        elif (df["cycle"] <= 0).any():
            issues.append("Cycles must be positive integers.")

        # Check duplicates
        dups = df.duplicated(subset=["machine_id", "cycle"]).sum()
        if dups > 0:
            issues.append(f"Found {dups} duplicate (machine_id, cycle) records.")
            metrics["duplicate_count"] = int(dups)

        # Check missing or infinite values in sensor measurements
        sensor_cols = [f"s{i}" for i in range(1, 22)]
        null_counts = df[sensor_cols].isnull().sum().to_dict()
        inf_counts = np.isinf(df[sensor_cols].select_dtypes(include=np.number)).sum().to_dict()

        high_null_sensors = [s for s, count in null_counts.items() if count > 0]
        if high_null_sensors:
            issues.append(f"Sensors with missing values: {high_null_sensors}")

        # Check constant sensors (zero variance)
        constant_sensors = []
        for s in sensor_cols:
            if s in df.columns and df[s].std(skipna=True) < 1e-6:
                constant_sensors.append(s)
        metrics["constant_sensors"] = constant_sensors

        is_valid = len(issues) == 0
        metrics["issues"] = issues
        metrics["is_valid"] = is_valid

        logger.info(
            f"Validation complete: {metrics['total_rows']} rows, {metrics['unique_machines']} machines. "
            f"Valid: {is_valid}. Constant sensors: {len(constant_sensors)}."
        )

        return is_valid, metrics
