"""TraceBack AI - Isolated Mock Database Engine

Provides an isolated local engine for development and testing when an active
Exasol instance is not running on localhost:8563.
Clearly labelled and isolated from the real Exasol client path.
"""
import sqlite3
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from backend.app.core.logging import logger


class MockExasolEngine:
    """Isolated local SQLite mock engine implementing the Exasol schema and operations."""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            data_dir = Path("data")
            data_dir.mkdir(parents=True, exist_ok=True)
            self.db_path = str(data_dir / "traceback_mock.db")
        else:
            self.db_path = db_path
        self._init_sqlite_schema()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite_schema(self) -> None:
        """Initializes tables matching the Exasol schema in SQLite."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executescript("""
            CREATE TABLE IF NOT EXISTS MACHINE_READINGS (
                machine_id TEXT NOT NULL,
                cycle INTEGER NOT NULL,
                op_setting_1 REAL,
                op_setting_2 REAL,
                op_setting_3 REAL,
                s1 REAL, s2 REAL, s3 REAL, s4 REAL, s5 REAL,
                s6 REAL, s7 REAL, s8 REAL, s9 REAL, s10 REAL,
                s11 REAL, s12 REAL, s13 REAL, s14 REAL, s15 REAL,
                s16 REAL, s17 REAL, s18 REAL, s19 REAL, s20 REAL,
                s21 REAL,
                dataset_id TEXT NOT NULL,
                batch_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (machine_id, cycle, dataset_id)
            );

            CREATE TABLE IF NOT EXISTS MACHINE_BASELINES (
                machine_id TEXT NOT NULL,
                sensor_name TEXT NOT NULL,
                sample_count INTEGER NOT NULL,
                baseline_mean REAL NOT NULL,
                baseline_std REAL NOT NULL,
                baseline_median REAL,
                baseline_mad REAL,
                baseline_method TEXT DEFAULT 'STANDARD_NORMAL',
                window_start_cycle INTEGER NOT NULL,
                window_end_cycle INTEGER NOT NULL,
                is_valid INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                baseline_version TEXT NOT NULL,
                PRIMARY KEY (machine_id, sensor_name, baseline_version)
            );

            CREATE TABLE IF NOT EXISTS SENSOR_DRIFT (
                machine_id TEXT NOT NULL,
                cycle INTEGER NOT NULL,
                sensor_name TEXT NOT NULL,
                raw_value REAL NOT NULL,
                normalised_deviation REAL NOT NULL,
                smoothed_deviation REAL NOT NULL,
                drift_rate REAL NOT NULL,
                anomaly_score REAL NOT NULL,
                threshold_crossed INTEGER NOT NULL,
                is_sustained INTEGER NOT NULL,
                calculation_version TEXT NOT NULL,
                dataset_id TEXT NOT NULL,
                PRIMARY KEY (machine_id, cycle, sensor_name, calculation_version)
            );

            CREATE TABLE IF NOT EXISTS MACHINE_HEALTH (
                machine_id TEXT NOT NULL,
                cycle INTEGER NOT NULL,
                health_score REAL NOT NULL,
                risk_score REAL NOT NULL,
                risk_category TEXT NOT NULL,
                contributing_sensor_count INTEGER NOT NULL,
                first_sustained_anomaly_cycle INTEGER,
                estimated_rul REAL,
                rul_confidence REAL,
                calculation_version TEXT NOT NULL,
                dataset_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (machine_id, cycle, calculation_version)
            );

            CREATE TABLE IF NOT EXISTS ROOT_CAUSE_EVIDENCE (
                machine_id TEXT NOT NULL,
                cycle INTEGER NOT NULL,
                sensor_name TEXT NOT NULL,
                rank INTEGER NOT NULL,
                raw_reading REAL NOT NULL,
                baseline_mean REAL NOT NULL,
                baseline_std REAL NOT NULL,
                deviation_magnitude REAL NOT NULL,
                drift_rate REAL NOT NULL,
                persistence INTEGER NOT NULL,
                contribution_score REAL NOT NULL,
                first_sustained_anomaly_cycle INTEGER,
                evidence_explanation TEXT NOT NULL,
                ranking_method_version TEXT NOT NULL,
                PRIMARY KEY (machine_id, cycle, sensor_name, ranking_method_version)
            );

            CREATE TABLE IF NOT EXISTS FAILURE_SIGNATURES (
                machine_id TEXT NOT NULL,
                signature_id TEXT NOT NULL,
                ordered_sensor_events TEXT NOT NULL,
                signature_features TEXT NOT NULL,
                source_dataset TEXT NOT NULL,
                historical_outcome TEXT NOT NULL,
                total_cycles INTEGER NOT NULL,
                extraction_version TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (machine_id, extraction_version)
            );

            CREATE TABLE IF NOT EXISTS SIGNATURE_GROUPS (
                group_id TEXT NOT NULL,
                group_name TEXT NOT NULL,
                representative_signature TEXT NOT NULL,
                clustering_method TEXT NOT NULL,
                algorithm_parameters TEXT NOT NULL,
                cluster_version TEXT NOT NULL,
                member_count INTEGER NOT NULL,
                validation_metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, cluster_version)
            );

            CREATE TABLE IF NOT EXISTS PIPELINE_RUNS (
                run_id TEXT NOT NULL PRIMARY KEY,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                dataset_id TEXT NOT NULL,
                rows_processed INTEGER DEFAULT 0,
                machines_processed INTEGER DEFAULT 0,
                pipeline_version TEXT NOT NULL,
                status TEXT NOT NULL,
                error_summary TEXT,
                processing_duration REAL
            );

            CREATE TABLE IF NOT EXISTS BENCHMARK_RUNS (
                run_id TEXT NOT NULL,
                dataset_id TEXT NOT NULL,
                machine_count INTEGER NOT NULL,
                cycle_count INTEGER NOT NULL,
                operation_name TEXT NOT NULL,
                measured_duration REAL NOT NULL,
                repeat_number INTEGER NOT NULL,
                environment_metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS INGESTION_BATCHES (
                batch_id TEXT NOT NULL PRIMARY KEY,
                source_name TEXT NOT NULL,
                source_checksum TEXT,
                import_status TEXT NOT NULL,
                row_count INTEGER DEFAULT 0,
                machine_count INTEGER DEFAULT 0,
                validation_results TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );
            """)
            conn.commit()

    def execute(self, query: str, params: Optional[Dict[str, Any]] = None) -> Any:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            conn.commit()
            return cursor

    def export_to_pandas(self, query: str, params: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        with self.get_connection() as conn:
            if params:
                return pd.read_sql_query(query, conn, params=params)
            return pd.read_sql_query(query, conn)

    def import_from_pandas(self, df: pd.DataFrame, table_name: str) -> int:
        with self.get_connection() as conn:
            # Clean table name
            clean_table = table_name.split(".")[-1]
            df.to_sql(clean_table, conn, if_exists="append", index=False)
            return len(df)
