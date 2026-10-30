"""TraceBack AI - Benchmarking Service

Measures real execution time of analytical stages and queries using monotonic timer.
"""
import time
import uuid
import platform
from typing import Dict, Any, List, Optional
import pandas as pd
from backend.app.db.connection import DatabaseManager, db_manager
from backend.app.schemas.benchmark import BenchmarkResult, BenchmarkSummary
from backend.app.core.logging import logger


class BenchmarkService:
    def __init__(self, db: DatabaseManager = db_manager):
        self.db = db

    def run_benchmarks(
        self,
        dataset_id: str = "NASA_FD001",
        repeats: int = 3
    ) -> BenchmarkSummary:
        """Runs a series of performance benchmarks across core database queries."""
        logger.info(f"Executing analytical benchmarks on dataset '{dataset_id}' ({repeats} repeats)...")

        # Get dataset sizes
        stats_df = self.db.export_to_pandas(
            "SELECT COUNT(DISTINCT machine_id) AS machine_count, COUNT(*) AS cycle_count FROM MACHINE_READINGS WHERE dataset_id = :ds",
            {"ds": dataset_id}
        )
        if stats_df.empty or int(stats_df.iloc[0]["machine_count"]) == 0:
            machine_count, cycle_count = 0, 0
        else:
            machine_count = int(stats_df.iloc[0]["machine_count"])
            cycle_count = int(stats_df.iloc[0]["cycle_count"])

        env_metadata = f"Python {platform.python_version()} on {platform.system()} {platform.release()} - Database: {'MockEngine' if self.db.is_mock else 'Exasol'}"
        run_id = f"bench_{uuid.uuid4().hex[:8]}"

        operations = {
            "Fleet Risk Aggregation": """
                SELECT h.risk_category, COUNT(*), AVG(h.health_score)
                FROM MACHINE_HEALTH h
                WHERE h.dataset_id = :ds
                GROUP BY h.risk_category
            """,
            "Sensor Drift Query": """
                SELECT sensor_name, AVG(smoothed_deviation), MAX(drift_rate)
                FROM SENSOR_DRIFT
                WHERE dataset_id = :ds
                GROUP BY sensor_name
            """,
            "Root-Cause Ranking Query": """
                SELECT sensor_name, COUNT(*) AS hit_count, AVG(contribution_score)
                FROM ROOT_CAUSE_EVIDENCE
                WHERE rank <= 3
                GROUP BY sensor_name
            """
        }

        results: List[BenchmarkResult] = []

        for op_name, sql in operations.items():
            for rep in range(1, repeats + 1):
                start_time = time.perf_counter()
                try:
                    self.db.export_to_pandas(sql, {"ds": dataset_id})
                except Exception as e:
                    logger.warning(f"Benchmark error on {op_name}: {e}")
                duration_ms = (time.perf_counter() - start_time) * 1000.0

                result = BenchmarkResult(
                    run_id=run_id,
                    dataset_id=dataset_id,
                    machine_count=machine_count,
                    cycle_count=cycle_count,
                    operation_name=op_name,
                    measured_duration_ms=round(duration_ms, 2),
                    repeat_number=rep,
                    environment_metadata=env_metadata,
                    created_at=pd.Timestamp.now().isoformat()
                )
                results.append(result)

                # Persist to BENCHMARK_RUNS table
                self._record_benchmark(result)

        return BenchmarkSummary(
            total_runs=len(results),
            results=results,
            fastest_operation=min(results, key=lambda x: x.measured_duration_ms).operation_name if results else None,
            slowest_operation=max(results, key=lambda x: x.measured_duration_ms).operation_name if results else None
        )

    def _record_benchmark(self, res: BenchmarkResult) -> None:
        try:
            self.db.execute(
                """
                INSERT INTO BENCHMARK_RUNS (
                    run_id, dataset_id, machine_count, cycle_count,
                    operation_name, measured_duration, repeat_number, environment_metadata
                ) VALUES (
                    :run_id, :dataset_id, :machine_count, :cycle_count,
                    :operation_name, :measured_duration, :repeat_number, :environment_metadata
                );
                """,
                {
                    "run_id": res.run_id,
                    "dataset_id": res.dataset_id,
                    "machine_count": res.machine_count,
                    "cycle_count": res.cycle_count,
                    "operation_name": res.operation_name,
                    "measured_duration": res.measured_duration_ms,
                    "repeat_number": res.repeat_number,
                    "environment_metadata": res.environment_metadata
                }
            )
        except Exception as e:
            logger.warning(f"Could not persist benchmark result: {e}")

    def get_benchmark_history(self) -> BenchmarkSummary:
        """Retrieves past benchmark runs."""
        df = self.db.export_to_pandas("SELECT * FROM BENCHMARK_RUNS ORDER BY created_at DESC LIMIT 50;")
        results = [
            BenchmarkResult(
                run_id=str(r["run_id"]),
                dataset_id=str(r["dataset_id"]),
                machine_count=int(r["machine_count"]),
                cycle_count=int(r["cycle_count"]),
                operation_name=str(r["operation_name"]),
                measured_duration_ms=round(float(r["measured_duration"]), 2),
                repeat_number=int(r["repeat_number"]),
                environment_metadata=str(r["environment_metadata"]) if pd.notnull(r["environment_metadata"]) else None,
                created_at=str(r["created_at"]) if pd.notnull(r["created_at"]) else None
            )
            for _, r in df.iterrows()
        ]
        return BenchmarkSummary(total_runs=len(results), results=results)
