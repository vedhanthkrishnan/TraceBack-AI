-- Machine Health Index & Risk Classification for Exasol
-- Calculates composite health scores (0-100), risk scores (0-100), and risk categories

MERGE INTO TRACEBACK_AI.MACHINE_HEALTH dest
USING (
    WITH ranked_sensor_anomalies AS (
        SELECT
            machine_id,
            cycle,
            dataset_id,
            anomaly_score,
            is_sustained,
            threshold_crossed,
            ROW_NUMBER() OVER (
                PARTITION BY machine_id, cycle
                ORDER BY anomaly_score DESC
            ) AS sensor_rank
        FROM TRACEBACK_AI.SENSOR_DRIFT
        WHERE calculation_version = :calculation_version
          AND dataset_id = :dataset_id
    ),
    cycle_aggregates AS (
        SELECT
            machine_id,
            cycle,
            dataset_id,
            AVG(CASE WHEN sensor_rank <= 5 THEN anomaly_score END) AS top5_anomaly_mean,
            COUNT(CASE WHEN threshold_crossed = TRUE OR is_sustained = TRUE THEN 1 END) AS contributing_sensors
        FROM ranked_sensor_anomalies
        GROUP BY machine_id, cycle, dataset_id
    ),
    first_sustained_events AS (
        SELECT
            machine_id,
            MIN(cycle) AS first_sustained_cycle
        FROM TRACEBACK_AI.SENSOR_DRIFT
        WHERE is_sustained = TRUE
          AND calculation_version = :calculation_version
          AND dataset_id = :dataset_id
        GROUP BY machine_id
    )
    SELECT
        c.machine_id,
        c.cycle,
        -- Health score: 100 = healthy, 0 = critical
        CASE
            WHEN c.cycle < :baseline_window THEN 100.0
            ELSE GREATEST(0.0, 100.0 - LEAST(100.0, (c.top5_anomaly_mean / 4.0) * 100.0))
        END AS health_score,
        -- Risk score: 0 = healthy, 100 = critical
        CASE
            WHEN c.cycle < :baseline_window THEN 0.0
            ELSE LEAST(100.0, GREATEST(0.0, (c.top5_anomaly_mean / 4.0) * 100.0))
        END AS risk_score,
        -- Risk category
        CASE
            WHEN c.cycle < :baseline_window THEN 'INSUFFICIENT_DATA'
            WHEN (c.top5_anomaly_mean / 4.0) * 100.0 >= :critical_threshold THEN 'CRITICAL'
            WHEN (c.top5_anomaly_mean / 4.0) * 100.0 >= :watch_threshold THEN 'WATCH'
            ELSE 'HEALTHY'
        END AS risk_category,
        c.contributing_sensors AS contributing_sensor_count,
        f.first_sustained_cycle AS first_sustained_anomaly_cycle,
        NULL AS estimated_rul,
        NULL AS rul_confidence,
        :calculation_version AS calculation_version,
        c.dataset_id,
        CURRENT_TIMESTAMP AS created_at
    FROM cycle_aggregates c
    LEFT JOIN first_sustained_events f
        ON c.machine_id = f.machine_id
) src
ON (dest.machine_id = src.machine_id AND dest.cycle = src.cycle AND dest.calculation_version = src.calculation_version)
WHEN MATCHED THEN UPDATE SET
    dest.health_score = src.health_score,
    dest.risk_score = src.risk_score,
    dest.risk_category = src.risk_category,
    dest.contributing_sensor_count = src.contributing_sensor_count,
    dest.first_sustained_anomaly_cycle = src.first_sustained_anomaly_cycle,
    dest.created_at = src.created_at
WHEN NOT MATCHED THEN INSERT VALUES (
    src.machine_id,
    src.cycle,
    src.health_score,
    src.risk_score,
    src.risk_category,
    src.contributing_sensor_count,
    src.first_sustained_anomaly_cycle,
    src.estimated_rul,
    src.rul_confidence,
    src.calculation_version,
    src.dataset_id,
    src.created_at
);
