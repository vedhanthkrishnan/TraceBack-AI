-- Baseline computation query for Exasol
-- Calculates healthy baseline stats (mean, std, median, validity) per machine and sensor
-- Uses an initial healthy observation window (e.g., cycle <= 30)

MERGE INTO TRACEBACK_AI.MACHINE_BASELINES dest
USING (
    WITH unpivoted AS (
        SELECT machine_id, cycle, dataset_id, 's1' AS sensor_name, s1 AS val FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's2', s2 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's3', s3 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's4', s4 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's5', s5 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's6', s6 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's7', s7 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's8', s8 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's9', s9 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's10', s10 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's11', s11 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's12', s12 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's13', s13 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's14', s14 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's15', s15 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's16', s16 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's17', s17 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's18', s18 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's19', s19 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's20', s20 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
        UNION ALL SELECT machine_id, cycle, dataset_id, 's21', s21 FROM TRACEBACK_AI.MACHINE_READINGS WHERE cycle <= :baseline_window AND dataset_id = :dataset_id
    )
    SELECT
        machine_id,
        sensor_name,
        COUNT(val) AS sample_count,
        COALESCE(AVG(val), 0.0) AS baseline_mean,
        CASE
            WHEN COUNT(val) <= 1 THEN 0.000001
            WHEN STDDEV_SAMP(val) IS NULL OR STDDEV_SAMP(val) < 0.000001 THEN 0.000001
            ELSE STDDEV_SAMP(val)
        END AS baseline_std,
        COALESCE(MEDIAN(val), 0.0) AS baseline_median,
        0.0 AS baseline_mad,
        'STANDARD_NORMAL' AS baseline_method,
        1 AS window_start_cycle,
        :baseline_window AS window_end_cycle,
        CASE
            WHEN STDDEV_SAMP(val) IS NULL OR STDDEV_SAMP(val) < 0.000001 THEN FALSE
            ELSE TRUE
        END AS is_valid,
        CURRENT_TIMESTAMP AS created_at,
        :baseline_version AS baseline_version
    FROM unpivoted
    WHERE val IS NOT NULL
    GROUP BY machine_id, sensor_name
) src
ON (dest.machine_id = src.machine_id AND dest.sensor_name = src.sensor_name AND dest.baseline_version = src.baseline_version)
WHEN MATCHED THEN UPDATE SET
    dest.sample_count = src.sample_count,
    dest.baseline_mean = src.baseline_mean,
    dest.baseline_std = src.baseline_std,
    dest.baseline_median = src.baseline_median,
    dest.is_valid = src.is_valid,
    dest.created_at = src.created_at
WHEN NOT MATCHED THEN INSERT VALUES (
    src.machine_id,
    src.sensor_name,
    src.sample_count,
    src.baseline_mean,
    src.baseline_std,
    src.baseline_median,
    src.baseline_mad,
    src.baseline_method,
    src.window_start_cycle,
    src.window_end_cycle,
    src.is_valid,
    src.created_at,
    src.baseline_version
);
