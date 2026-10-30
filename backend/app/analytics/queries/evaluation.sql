-- Evaluation & Benchmark Analytics Query for Exasol
-- Measures early warning lead time, alert precision, and sensor involvement before failure

WITH machine_endpoints AS (
    SELECT
        machine_id,
        dataset_id,
        MAX(cycle) AS failure_cycle
    FROM TRACEBACK_AI.MACHINE_READINGS
    WHERE dataset_id = :dataset_id
    GROUP BY machine_id, dataset_id
),
alert_onsets AS (
    SELECT
        h.machine_id,
        MIN(CASE WHEN h.risk_category IN ('WATCH', 'CRITICAL') THEN h.cycle END) AS first_alert_cycle,
        MIN(CASE WHEN h.risk_category = 'CRITICAL' THEN h.cycle END) AS first_critical_cycle
    FROM TRACEBACK_AI.MACHINE_HEALTH h
    WHERE h.calculation_version = :calculation_version
      AND h.dataset_id = :dataset_id
    GROUP BY h.machine_id
)
SELECT
    m.machine_id,
    m.failure_cycle,
    a.first_alert_cycle,
    a.first_critical_cycle,
    (m.failure_cycle - a.first_alert_cycle) AS lead_time_cycles,
    CASE
        WHEN a.first_alert_cycle IS NOT NULL AND a.first_alert_cycle < m.failure_cycle THEN TRUE
        ELSE FALSE
    END AS early_warning_achieved
FROM machine_endpoints m
LEFT JOIN alert_onsets a
    ON m.machine_id = a.machine_id
ORDER BY m.machine_id;
