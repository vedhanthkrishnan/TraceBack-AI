-- Root-Cause Evidence Ranking for Exasol
-- Ranks abnormal sensors by interpretable contribution metrics with human-readable rationale

MERGE INTO TRACEBACK_AI.ROOT_CAUSE_EVIDENCE dest
USING (
    WITH sensor_first_sustained AS (
        SELECT
            machine_id,
            sensor_name,
            MIN(cycle) AS first_anomaly_cycle
        FROM TRACEBACK_AI.SENSOR_DRIFT
        WHERE is_sustained = TRUE
          AND calculation_version = :calculation_version
          AND dataset_id = :dataset_id
        GROUP BY machine_id, sensor_name
    ),
    scored_evidence AS (
        SELECT
            d.machine_id,
            d.cycle,
            d.sensor_name,
            d.raw_value AS raw_reading,
            b.baseline_mean,
            b.baseline_std,
            ABS(d.smoothed_deviation) AS deviation_magnitude,
            d.drift_rate,
            CASE WHEN d.is_sustained THEN 10 ELSE 1 END AS persistence,
            (0.40 * ABS(d.smoothed_deviation) + 0.30 * ABS(d.drift_rate * 10.0) + 0.20 * CASE WHEN d.is_sustained THEN 2.0 ELSE 0.0 END + 0.10 * CASE WHEN d.threshold_crossed THEN 1.0 ELSE 0.0 END) AS contribution_score,
            sfs.first_anomaly_cycle AS first_sustained_anomaly_cycle,
            'Sensor ' || d.sensor_name || ' deviated by ' || CAST(ROUND(ABS(d.smoothed_deviation), 2) AS VARCHAR(16)) || ' std deviations from healthy baseline (mean: ' || CAST(ROUND(b.baseline_mean, 2) AS VARCHAR(16)) || '), with drift rate ' || CAST(ROUND(d.drift_rate, 4) AS VARCHAR(16)) || '/cycle.' AS evidence_explanation
        FROM TRACEBACK_AI.SENSOR_DRIFT d
        JOIN TRACEBACK_AI.MACHINE_BASELINES b
            ON d.machine_id = b.machine_id
            AND d.sensor_name = b.sensor_name
            AND b.baseline_version = :baseline_version
        LEFT JOIN sensor_first_sustained sfs
            ON d.machine_id = sfs.machine_id
            AND d.sensor_name = sfs.sensor_name
        WHERE d.calculation_version = :calculation_version
          AND d.dataset_id = :dataset_id
          AND b.is_valid = TRUE
    ),
    ranked_evidence AS (
        SELECT
            machine_id,
            cycle,
            sensor_name,
            ROW_NUMBER() OVER (
                PARTITION BY machine_id, cycle
                ORDER BY contribution_score DESC
            ) AS rank,
            raw_reading,
            baseline_mean,
            baseline_std,
            deviation_magnitude,
            drift_rate,
            persistence,
            contribution_score,
            first_sustained_anomaly_cycle,
            evidence_explanation,
            :ranking_method_version AS ranking_method_version
        FROM scored_evidence
    )
    SELECT * FROM ranked_evidence WHERE rank <= 10
) src
ON (dest.machine_id = src.machine_id AND dest.cycle = src.cycle AND dest.sensor_name = src.sensor_name AND dest.ranking_method_version = src.ranking_method_version)
WHEN MATCHED THEN UPDATE SET
    dest.rank = src.rank,
    dest.raw_reading = src.raw_reading,
    dest.baseline_mean = src.baseline_mean,
    dest.baseline_std = src.baseline_std,
    dest.deviation_magnitude = src.deviation_magnitude,
    dest.drift_rate = src.drift_rate,
    dest.persistence = src.persistence,
    dest.contribution_score = src.contribution_score,
    dest.first_sustained_anomaly_cycle = src.first_sustained_anomaly_cycle,
    dest.evidence_explanation = src.evidence_explanation
WHEN NOT MATCHED THEN INSERT VALUES (
    src.machine_id,
    src.cycle,
    src.sensor_name,
    src.rank,
    src.raw_reading,
    src.baseline_mean,
    src.baseline_std,
    src.deviation_magnitude,
    src.drift_rate,
    src.persistence,
    src.contribution_score,
    src.first_sustained_anomaly_cycle,
    src.evidence_explanation,
    src.ranking_method_version
);
