-- Sensor Drift Analytics for Exasol
-- Calculates normalized deviations, smoothed rolling drift, drift rates, and sustained anomalies
-- Uses window functions inside Exasol

MERGE INTO TRACEBACK_AI.SENSOR_DRIFT dest
USING (
    WITH unpivoted_readings AS (
        SELECT machine_id, cycle, dataset_id, 's1' AS sensor_name, s1 AS raw_value FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's2', s2 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's3', s3 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's4', s4 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's5', s5 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's6', s6 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's7', s7 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's8', s8 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's9', s9 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's10', s10 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's11', s11 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's12', s12 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's13', s13 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's14', s14 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's15', s15 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's16', s16 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's17', s17 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's18', s18 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's19', s19 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's20', s20 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's21', s21 FROM TRACEBACK_AI.MACHINE_READINGS WHERE dataset_id = :dataset_id
    ),
    raw_deviations AS (
        SELECT
            r.machine_id,
            r.cycle,
            r.sensor_name,
            r.raw_value,
            r.dataset_id,
            b.is_valid,
            CASE
                WHEN b.is_valid = FALSE OR b.baseline_std <= 0.000001 THEN 0.0
                ELSE (r.raw_value - b.baseline_mean) / b.baseline_std
            END AS norm_dev
        FROM unpivoted_readings r
        JOIN TRACEBACK_AI.MACHINE_BASELINES b
            ON r.machine_id = b.machine_id
            AND r.sensor_name = b.sensor_name
            AND b.baseline_version = :baseline_version
        WHERE r.raw_value IS NOT NULL
    ),
    smoothed_stats AS (
        SELECT
            machine_id,
            cycle,
            sensor_name,
            raw_value,
            dataset_id,
            norm_dev,
            AVG(norm_dev) OVER (
                PARTITION BY machine_id, sensor_name
                ORDER BY cycle
                ROWS BETWEEN :drift_window_preceding PRECEDING AND CURRENT ROW
            ) AS smooth_dev,
            LAG(norm_dev, :drift_window_lag) OVER (
                PARTITION BY machine_id, sensor_name
                ORDER BY cycle
            ) AS lagged_dev,
            COUNT(CASE WHEN ABS(norm_dev) >= 2.0 THEN 1 END) OVER (
                PARTITION BY machine_id, sensor_name
                ORDER BY cycle
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) AS recent_anomaly_hits
        FROM raw_deviations
    )
    SELECT
        machine_id,
        cycle,
        sensor_name,
        raw_value,
        norm_dev AS normalised_deviation,
        smooth_dev AS smoothed_deviation,
        CASE
            WHEN lagged_dev IS NULL THEN 0.0
            ELSE (smooth_dev - lagged_dev) / :drift_window
        END AS drift_rate,
        ABS(smooth_dev) AS anomaly_score,
        CASE WHEN ABS(smooth_dev) >= 2.5 THEN TRUE ELSE FALSE END AS threshold_crossed,
        CASE WHEN recent_anomaly_hits >= 5 THEN TRUE ELSE FALSE END AS is_sustained,
        :calculation_version AS calculation_version,
        dataset_id
    FROM smoothed_stats
) src
ON (dest.machine_id = src.machine_id AND dest.cycle = src.cycle AND dest.sensor_name = src.sensor_name AND dest.calculation_version = src.calculation_version)
WHEN MATCHED THEN UPDATE SET
    dest.raw_value = src.raw_value,
    dest.normalised_deviation = src.normalised_deviation,
    dest.smoothed_deviation = src.smoothed_deviation,
    dest.drift_rate = src.drift_rate,
    dest.anomaly_score = src.anomaly_score,
    dest.threshold_crossed = src.threshold_crossed,
    dest.is_sustained = src.is_sustained
WHEN NOT MATCHED THEN INSERT VALUES (
    src.machine_id,
    src.cycle,
    src.sensor_name,
    src.raw_value,
    src.normalised_deviation,
    src.smoothed_deviation,
    src.drift_rate,
    src.anomaly_score,
    src.threshold_crossed,
    src.is_sustained,
    src.calculation_version,
    src.dataset_id
);
