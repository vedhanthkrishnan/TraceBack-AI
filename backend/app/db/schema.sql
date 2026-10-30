-- TraceBack AI - Exasol Database Schema
-- Version: 1.0.0

-- Create and switch to schema
CREATE SCHEMA IF NOT EXISTS TRACEBACK_AI;
OPEN SCHEMA TRACEBACK_AI;

-- 1. Machine Readings Table: Cycle-level sensor data per machine
CREATE TABLE IF NOT EXISTS MACHINE_READINGS (
    machine_id VARCHAR(64) NOT NULL,
    cycle INTEGER NOT NULL,
    op_setting_1 DOUBLE PRECISION,
    op_setting_2 DOUBLE PRECISION,
    op_setting_3 DOUBLE PRECISION,
    s1 DOUBLE PRECISION,
    s2 DOUBLE PRECISION,
    s3 DOUBLE PRECISION,
    s4 DOUBLE PRECISION,
    s5 DOUBLE PRECISION,
    s6 DOUBLE PRECISION,
    s7 DOUBLE PRECISION,
    s8 DOUBLE PRECISION,
    s9 DOUBLE PRECISION,
    s10 DOUBLE PRECISION,
    s11 DOUBLE PRECISION,
    s12 DOUBLE PRECISION,
    s13 DOUBLE PRECISION,
    s14 DOUBLE PRECISION,
    s15 DOUBLE PRECISION,
    s16 DOUBLE PRECISION,
    s17 DOUBLE PRECISION,
    s18 DOUBLE PRECISION,
    s19 DOUBLE PRECISION,
    s20 DOUBLE PRECISION,
    s21 DOUBLE PRECISION,
    dataset_id VARCHAR(64) NOT NULL,
    batch_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_machine_readings PRIMARY KEY (machine_id, cycle, dataset_id)
);

-- 2. Machine Baselines Table: Learned healthy behavior window per sensor
CREATE TABLE IF NOT EXISTS MACHINE_BASELINES (
    machine_id VARCHAR(64) NOT NULL,
    sensor_name VARCHAR(32) NOT NULL,
    sample_count INTEGER NOT NULL,
    baseline_mean DOUBLE PRECISION NOT NULL,
    baseline_std DOUBLE PRECISION NOT NULL,
    baseline_median DOUBLE PRECISION,
    baseline_mad DOUBLE PRECISION,
    baseline_method VARCHAR(32) DEFAULT 'STANDARD_NORMAL',
    window_start_cycle INTEGER NOT NULL,
    window_end_cycle INTEGER NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    baseline_version VARCHAR(32) NOT NULL,
    CONSTRAINT pk_machine_baselines PRIMARY KEY (machine_id, sensor_name, baseline_version)
);

-- 3. Sensor Drift Table: Cycle-by-cycle standardized deviations and anomaly tracking
CREATE TABLE IF NOT EXISTS SENSOR_DRIFT (
    machine_id VARCHAR(64) NOT NULL,
    cycle INTEGER NOT NULL,
    sensor_name VARCHAR(32) NOT NULL,
    raw_value DOUBLE PRECISION NOT NULL,
    normalised_deviation DOUBLE PRECISION NOT NULL,
    smoothed_deviation DOUBLE PRECISION NOT NULL,
    drift_rate DOUBLE PRECISION NOT NULL,
    anomaly_score DOUBLE PRECISION NOT NULL,
    threshold_crossed BOOLEAN NOT NULL,
    is_sustained BOOLEAN NOT NULL,
    calculation_version VARCHAR(32) NOT NULL,
    dataset_id VARCHAR(64) NOT NULL,
    CONSTRAINT pk_sensor_drift PRIMARY KEY (machine_id, cycle, sensor_name, calculation_version)
);

-- 4. Machine Health Table: Composite health score and risk category per machine cycle
CREATE TABLE IF NOT EXISTS MACHINE_HEALTH (
    machine_id VARCHAR(64) NOT NULL,
    cycle INTEGER NOT NULL,
    health_score DOUBLE PRECISION NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL,
    risk_category VARCHAR(32) NOT NULL,
    contributing_sensor_count INTEGER NOT NULL,
    first_sustained_anomaly_cycle INTEGER,
    estimated_rul DOUBLE PRECISION,
    rul_confidence DOUBLE PRECISION,
    calculation_version VARCHAR(32) NOT NULL,
    dataset_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_machine_health PRIMARY KEY (machine_id, cycle, calculation_version)
);

-- 5. Root Cause Evidence Table: Ranked sensors with explainable signals
CREATE TABLE IF NOT EXISTS ROOT_CAUSE_EVIDENCE (
    machine_id VARCHAR(64) NOT NULL,
    cycle INTEGER NOT NULL,
    sensor_name VARCHAR(32) NOT NULL,
    rank INTEGER NOT NULL,
    raw_reading DOUBLE PRECISION NOT NULL,
    baseline_mean DOUBLE PRECISION NOT NULL,
    baseline_std DOUBLE PRECISION NOT NULL,
    deviation_magnitude DOUBLE PRECISION NOT NULL,
    drift_rate DOUBLE PRECISION NOT NULL,
    persistence INTEGER NOT NULL,
    contribution_score DOUBLE PRECISION NOT NULL,
    first_sustained_anomaly_cycle INTEGER,
    evidence_explanation VARCHAR(1000) NOT NULL,
    ranking_method_version VARCHAR(32) NOT NULL,
    CONSTRAINT pk_root_cause_evidence PRIMARY KEY (machine_id, cycle, sensor_name, ranking_method_version)
);

-- 6. Failure Signatures Table: Ordered sensor anomaly events and profile vectors
CREATE TABLE IF NOT EXISTS FAILURE_SIGNATURES (
    machine_id VARCHAR(64) NOT NULL,
    signature_id VARCHAR(64) NOT NULL,
    ordered_sensor_events VARCHAR(2000) NOT NULL,
    signature_features VARCHAR(4000) NOT NULL,
    source_dataset VARCHAR(64) NOT NULL,
    historical_outcome VARCHAR(64) NOT NULL,
    total_cycles INTEGER NOT NULL,
    extraction_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_failure_signatures PRIMARY KEY (machine_id, extraction_version)
);

-- 7. Signature Groups Table: Clustered pattern archetypes across historical failures
CREATE TABLE IF NOT EXISTS SIGNATURE_GROUPS (
    group_id VARCHAR(64) NOT NULL,
    group_name VARCHAR(128) NOT NULL,
    representative_signature VARCHAR(4000) NOT NULL,
    clustering_method VARCHAR(64) NOT NULL,
    algorithm_parameters VARCHAR(1000) NOT NULL,
    cluster_version VARCHAR(32) NOT NULL,
    member_count INTEGER NOT NULL,
    validation_metadata VARCHAR(2000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_signature_groups PRIMARY KEY (group_id, cluster_version)
);

-- 8. Pipeline Runs Table: Operational audit log of analytics executions
CREATE TABLE IF NOT EXISTS PIPELINE_RUNS (
    run_id VARCHAR(64) NOT NULL PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    dataset_id VARCHAR(64) NOT NULL,
    rows_processed INTEGER DEFAULT 0,
    machines_processed INTEGER DEFAULT 0,
    pipeline_version VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    error_summary VARCHAR(2000),
    processing_duration DOUBLE PRECISION
);

-- 9. Benchmark Runs Table: High-resolution performance metrics of analytics queries
CREATE TABLE IF NOT EXISTS BENCHMARK_RUNS (
    run_id VARCHAR(64) NOT NULL,
    dataset_id VARCHAR(64) NOT NULL,
    machine_count INTEGER NOT NULL,
    cycle_count INTEGER NOT NULL,
    operation_name VARCHAR(64) NOT NULL,
    measured_duration DOUBLE PRECISION NOT NULL,
    repeat_number INTEGER NOT NULL,
    environment_metadata VARCHAR(2000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Ingestion Batches Table: Tracking data source checksums and validation records
CREATE TABLE IF NOT EXISTS INGESTION_BATCHES (
    batch_id VARCHAR(64) NOT NULL PRIMARY KEY,
    source_name VARCHAR(128) NOT NULL,
    source_checksum VARCHAR(64),
    import_status VARCHAR(32) NOT NULL,
    row_count INTEGER DEFAULT 0,
    machine_count INTEGER DEFAULT 0,
    validation_results VARCHAR(2000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
