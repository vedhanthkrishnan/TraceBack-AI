-- Failure Signature Extraction Query for Exasol
-- Aggregates run-to-failure trajectories into ordered sensor anomaly events and profile features

SELECT
    d.machine_id,
    d.dataset_id AS source_dataset,
    MAX(d.cycle) AS total_cycles,
    'RUN_TO_FAILURE' AS historical_outcome,
    d.sensor_name,
    MIN(CASE WHEN d.is_sustained = TRUE THEN d.cycle END) AS onset_cycle,
    MAX(ABS(d.smoothed_deviation)) AS peak_deviation,
    AVG(d.drift_rate) AS avg_drift_rate
FROM TRACEBACK_AI.SENSOR_DRIFT d
WHERE d.calculation_version = :calculation_version
  AND d.dataset_id = :dataset_id
GROUP BY d.machine_id, d.dataset_id, d.sensor_name
HAVING MIN(CASE WHEN d.is_sustained = TRUE THEN d.cycle END) IS NOT NULL
ORDER BY d.machine_id, onset_cycle ASC;
