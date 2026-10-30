"""TraceBack AI - Fleet Repository

Data access layer for fleet-level overview, risk rankings, and aggregate health metrics.
"""
from typing import Dict, List, Optional, Tuple, Any
import pandas as pd
from backend.app.db.connection import DatabaseManager, get_db
from backend.app.schemas.fleet import MachineSummary, FleetSummary, FleetFilterParams


class FleetRepository:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def get_fleet_summary(self, dataset_id: Optional[str] = None) -> FleetSummary:
        """Retrieves fleet-level aggregate health statistics for the latest cycle of each machine."""
        dataset_filter = "WHERE dataset_id = :dataset_id" if dataset_id else ""
        params = {"dataset_id": dataset_id} if dataset_id else None

        # Fetch latest cycle per machine
        query = f"""
        WITH latest_cycles AS (
            SELECT machine_id, dataset_id, MAX(cycle) AS max_cycle
            FROM MACHINE_HEALTH
            {dataset_filter}
            GROUP BY machine_id, dataset_id
        ),
        latest_health AS (
            SELECT h.*
            FROM MACHINE_HEALTH h
            JOIN latest_cycles lc
              ON h.machine_id = lc.machine_id
             AND h.cycle = lc.max_cycle
             AND h.dataset_id = lc.dataset_id
        )
        SELECT
            COUNT(*) AS total_machines,
            COALESCE(SUM(CASE WHEN risk_category = 'HEALTHY' THEN 1 ELSE 0 END), 0) AS healthy_count,
            COALESCE(SUM(CASE WHEN risk_category = 'WATCH' THEN 1 ELSE 0 END), 0) AS watch_count,
            COALESCE(SUM(CASE WHEN risk_category = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS critical_count,
            COALESCE(SUM(CASE WHEN risk_category = 'INSUFFICIENT_DATA' THEN 1 ELSE 0 END), 0) AS insufficient_count,
            COALESCE(AVG(health_score), 100.0) AS avg_health,
            COALESCE(AVG(risk_score), 0.0) AS avg_risk
        FROM latest_health;
        """

        df = self.db.export_to_pandas(query, params)
        if df.empty or int(df.iloc[0]["total_machines"]) == 0:
            return FleetSummary(
                total_machines=0,
                healthy_count=0,
                watch_count=0,
                critical_count=0,
                insufficient_data_count=0,
                average_health_score=100.0,
                average_risk_score=0.0,
                active_dataset_id=dataset_id
            )

        row = df.iloc[0]
        return FleetSummary(
            total_machines=int(row["total_machines"]),
            healthy_count=int(row["healthy_count"]),
            watch_count=int(row["watch_count"]),
            critical_count=int(row["critical_count"]),
            insufficient_data_count=int(row["insufficient_count"]),
            average_health_score=round(float(row["avg_health"]), 2),
            average_risk_score=round(float(row["avg_risk"]), 2),
            active_dataset_id=dataset_id
        )

    def get_fleet_machines(
        self,
        filters: FleetFilterParams,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[MachineSummary], int]:
        """Retrieves paginated machines ranked by risk or custom criteria."""
        where_clauses = []
        params: Dict[str, Any] = {}

        if filters.dataset_id:
            where_clauses.append("h.dataset_id = :dataset_id")
            params["dataset_id"] = filters.dataset_id

        if filters.risk_category:
            where_clauses.append("UPPER(h.risk_category) = :risk_category")
            params["risk_category"] = filters.risk_category.upper()

        if filters.search:
            where_clauses.append("h.machine_id LIKE :search")
            params["search"] = f"%{filters.search}%"

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        # Validate sort column
        allowed_sorts = {
            "risk_score": "h.risk_score",
            "health_score": "h.health_score",
            "machine_id": "h.machine_id",
            "cycle": "h.cycle"
        }
        sort_col = allowed_sorts.get(filters.sort_by, "h.risk_score")
        sort_dir = "ASC" if filters.sort_order.lower() == "asc" else "DESC"

        # Count total
        count_query = f"""
        WITH latest_cycles AS (
            SELECT machine_id, dataset_id, MAX(cycle) AS max_cycle
            FROM MACHINE_HEALTH
            GROUP BY machine_id, dataset_id
        ),
        latest_health AS (
            SELECT h.*
            FROM MACHINE_HEALTH h
            JOIN latest_cycles lc
              ON h.machine_id = lc.machine_id
             AND h.cycle = lc.max_cycle
             AND h.dataset_id = lc.dataset_id
        )
        SELECT COUNT(*) AS total_count
        FROM latest_health h
        {where_sql};
        """
        count_df = self.db.export_to_pandas(count_query, params)
        total_count = int(count_df.iloc[0]["total_count"]) if not count_df.empty else 0

        if total_count == 0:
            return [], 0

        # Paginated items
        offset = (page - 1) * page_size
        params["limit"] = page_size
        params["offset"] = offset

        data_query = f"""
        WITH latest_cycles AS (
            SELECT machine_id, dataset_id, MAX(cycle) AS max_cycle
            FROM MACHINE_HEALTH
            GROUP BY machine_id, dataset_id
        ),
        latest_health AS (
            SELECT h.*
            FROM MACHINE_HEALTH h
            JOIN latest_cycles lc
              ON h.machine_id = lc.machine_id
             AND h.cycle = lc.max_cycle
             AND h.dataset_id = lc.dataset_id
        )
        SELECT
            h.machine_id,
            h.cycle,
            h.health_score,
            h.risk_score,
            h.risk_category,
            h.contributing_sensor_count,
            h.first_sustained_anomaly_cycle,
            h.estimated_rul,
            h.dataset_id,
            CAST(h.created_at AS VARCHAR(32)) AS last_updated
        FROM latest_health h
        {where_sql}
        ORDER BY {sort_col} {sort_dir}
        LIMIT :limit OFFSET :offset;
        """

        df = self.db.export_to_pandas(data_query, params)
        items = []
        for _, row in df.iterrows():
            items.append(MachineSummary(
                machine_id=str(row["machine_id"]),
                cycle=int(row["cycle"]),
                health_score=round(float(row["health_score"]), 2),
                risk_score=round(float(row["risk_score"]), 2),
                risk_category=str(row["risk_category"]),
                contributing_sensor_count=int(row["contributing_sensor_count"]) if pd.notnull(row["contributing_sensor_count"]) else 0,
                first_sustained_anomaly_cycle=int(row["first_sustained_anomaly_cycle"]) if pd.notnull(row["first_sustained_anomaly_cycle"]) else None,
                estimated_rul=round(float(row["estimated_rul"]), 1) if pd.notnull(row["estimated_rul"]) else None,
                dataset_id=str(row["dataset_id"]),
                last_updated=str(row["last_updated"]) if pd.notnull(row["last_updated"]) else None
            ))

        return items, total_count
