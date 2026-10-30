# TraceBack AI — Frontend Integration Guide

This guide provides the React/TypeScript frontend engineering team with everything required to integrate with the TraceBack AI backend API.

---

## 1. Base URL & Connection Information

- **Development API Base URL:** `http://127.0.0.1:8000/api/v1`
- **Interactive Swagger UI:** `http://127.0.0.1:8000/docs`
- **Interactive ReDoc:** `http://127.0.0.1:8000/redoc`
- **CORS Configured Origins:** `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5173`, `http://127.0.0.1:5173`
- **Request ID Header:** Every response includes `X-Request-ID` in headers and in the JSON response body.

---

## 2. Standard Response Envelope

All API endpoints return JSON conforming to the generic envelope schema:

```typescript
export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  message: string | null;
  request_id: string;
}
```

### Standard Error Response Example (e.g. 404 Machine Not Found)
```json
{
  "success": false,
  "data": null,
  "error": "MachineNotFoundError",
  "message": "Machine 'M999' was not found in the database.",
  "details": {
    "machine_id": "M999"
  },
  "request_id": "8482024b-325d-4f12-a169-dcf82d02a0a2"
}
```

---

## 3. System Health & Environment Transparency

### `GET /api/v1/health`
Returns high-level service status and database connectivity.
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "TraceBack AI Predictive Maintenance Engine",
    "version": "1.0.0",
    "timestamp": "1761805500.12",
    "database": {
      "connected": true,
      "engine": "Mock Engine (Isolated SQLite)",
      "is_mock": true,
      "dsn": "localhost:8563"
    },
    "copilot": {
      "provider": "TraceBack Grounded Engine (Offline / Mock)",
      "is_configured": true
    }
  },
  "request_id": "5fa23e01-..."
}
```

### `GET /api/v1/readiness`
Provides full transparency on the active database engine, active dataset provenance, and pipeline state. Use this to display the status pill in the UI header!
```json
{
  "success": true,
  "data": {
    "ready": true,
    "database_connected": true,
    "schema_initialized": true,
    "engine": "Mock Engine (Isolated SQLite)",
    "is_mock": true,
    "dataset_mode": "SYNTHETIC_FLEET_DEMO",
    "active_dataset": "SYNTHETIC_FLEET_DEMO",
    "llm_provider": "TraceBack Grounded Engine (Offline / Mock)",
    "pipeline_status": "SUCCESS",
    "notes": [
      "Database responsive on Mock Engine (Isolated SQLite)",
      "Relational schema verified",
      "Loaded dataset: SYNTHETIC_FLEET_DEMO"
    ]
  },
  "request_id": "993f18cb-..."
}
```

> **UI Guidance on `dataset_mode`:**
> - `REAL_NASA_CMAPSS_FD001`: Render badge `"NASA Turbofan C-MAPSS FD001 (Authentic Data)"`.
> - `SYNTHETIC_FLEET_DEMO`: Render badge `"Synthetic Industrial Fleet Demo"`.
> - `NO_DATA`: Prompt user or judge to click `"Seed Demo Fleet"`.

---

## 4. Fleet Overview Endpoints

### `GET /api/v1/fleet/summary`
Returns aggregate risk counts across the monitored fleet.
```json
{
  "success": true,
  "data": {
    "total_machines": 12,
    "healthy_count": 2,
    "watch_count": 8,
    "critical_count": 2,
    "insufficient_data_count": 0,
    "average_health_score": 53.4,
    "average_risk_score": 46.6,
    "active_dataset_id": "SYNTHETIC_FLEET_DEMO"
  }
}
```

### `GET /api/v1/fleet?page=1&page_size=10&sort_by=risk_score&sort_order=desc`
Returns paginated machines ranked by risk.
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "machine_id": "M011",
        "cycle": 127,
        "health_score": 6.16,
        "risk_score": 93.84,
        "risk_category": "CRITICAL",
        "contributing_sensor_count": 4,
        "first_sustained_anomaly_cycle": 102,
        "estimated_rul": 28.4,
        "dataset_id": "SYNTHETIC_FLEET_DEMO",
        "last_updated": "2026-10-30 11:57:17"
      }
    ],
    "total": 12,
    "page": 1,
    "page_size": 10,
    "total_pages": 2
  }
}
```

---

## 5. Machine Deep-Dive Endpoints

### `GET /api/v1/machines/{machine_id}`
Returns the machine's risk diagnosis, remaining life, and onset cycle.
```json
{
  "success": true,
  "data": {
    "machine_id": "M011",
    "current_cycle": 127,
    "health_score": 6.16,
    "risk_score": 93.84,
    "risk_category": "CRITICAL",
    "contributing_sensor_count": 4,
    "first_sustained_anomaly_cycle": 102,
    "estimated_rul": 28.4,
    "rul_confidence": 0.82,
    "dataset_id": "SYNTHETIC_FLEET_DEMO",
    "data_quality_state": "VALID",
    "baseline_window": 30,
    "explanation": "Machine M011 is evaluated at cycle 127. Classification: CRITICAL (Risk score: 93.8/100). Top contributing sensor signals: s8, s14, s3. First sustained anomaly observed at cycle 102."
  }
}
```

### `GET /api/v1/machines/{machine_id}/history`
Returns health & risk scores over all cycles for drawing the trajectory trend line.
```json
{
  "success": true,
  "data": {
    "machine_id": "M011",
    "total_cycles": 127,
    "history": [
      { "cycle": 1, "health_score": 100.0, "risk_score": 0.0, "risk_category": "INSUFFICIENT_DATA" },
      { "cycle": 30, "health_score": 98.2, "risk_score": 1.8, "risk_category": "HEALTHY" },
      { "cycle": 102, "health_score": 52.0, "risk_score": 48.0, "risk_category": "WATCH" },
      { "cycle": 127, "health_score": 6.16, "risk_score": 93.84, "risk_category": "CRITICAL" }
    ]
  }
}
```

### `GET /api/v1/machines/{machine_id}/sensors`
Returns sensor baselines and current cycle standardized deviations (z-scores and drift rates).
```json
{
  "success": true,
  "data": {
    "machine_id": "M011",
    "cycle": 127,
    "baselines": [
      {
        "sensor_name": "s8",
        "sample_count": 30,
        "mean": 2388.0512,
        "std": 0.0714,
        "window_start_cycle": 1,
        "window_end_cycle": 30,
        "is_valid": true,
        "baseline_method": "STANDARD_NORMAL"
      }
    ],
    "drifts": [
      {
        "sensor_name": "s8",
        "current_raw_value": 2387.6821,
        "baseline_mean": 2388.0512,
        "baseline_std": 0.0714,
        "current_z_score": -5.16,
        "smoothed_z_score": -5.16,
        "drift_rate": -0.1034,
        "anomaly_score": 5.16,
        "is_sustained": true,
        "threshold_crossed": true
      }
    ]
  }
}
```

### `GET /api/v1/machines/{machine_id}/root-cause`
Returns ranked sensor evidence with deviation magnitudes, drift rates, and human-readable explanations.
```json
{
  "success": true,
  "data": {
    "machine_id": "M011",
    "cycle": 127,
    "health_score": 6.16,
    "risk_score": 93.84,
    "risk_category": "CRITICAL",
    "evidence_items": [
      {
        "rank": 1,
        "sensor_name": "s8",
        "raw_reading": 2387.6821,
        "baseline_mean": 2388.0512,
        "baseline_std": 0.0714,
        "deviation_magnitude": 5.16,
        "drift_rate": -0.1034,
        "persistence": 10,
        "contribution_score": 4.47,
        "first_sustained_anomaly_cycle": 102,
        "evidence_explanation": "Sensor s8 deviated by 5.16 standard deviations from its healthy baseline (mean: 2388.05), exhibiting a drift rate of -0.1034/cycle."
      }
    ],
    "methodology_note": "Contribution score is an interpretable ranking metric derived from normalized deviation magnitude, rolling drift rate, persistence, and temporal onset order."
  }
}
```

### `GET /api/v1/machines/{machine_id}/signatures`
Returns matching historical run-to-failure machines with similarity scores and shared sensors.
```json
{
  "success": true,
  "data": {
    "machine_id": "M011",
    "current_cycle": 127,
    "current_signature": {
      "sustained_sensors": ["s3", "s8", "s9", "s14"],
      "cycle": 127
    },
    "matches": [
      {
        "matched_machine_id": "M004",
        "similarity_score": 0.60,
        "shared_sensor_evidence": ["s3", "s8", "s9"],
        "historical_total_cycles": 118,
        "outcome": "RUN_TO_FAILURE",
        "observation_window": "Cycles 1 - 118",
        "similarity_interpretation": "Machine M004 exhibited sustained degradation across matching sensors: s3, s8, s9. Reached run-to-failure at cycle 118."
      }
    ],
    "message": "Found 2 resembling historical failure trajectory cases."
  }
}
```

### `GET /api/v1/machines/{machine_id}/evidence`
Consolidated evidence package bringing together health, root-cause, drift highlights, historical matches, and summary verdict in a single call.

---

## 6. AI Copilot Integration

### `POST /api/v1/copilot/chat`

**Request Body:**
```json
{
  "question": "Why is Machine M011 critical and which sensors show the strongest evidence?",
  "machine_id": "M011",
  "conversation_history": [
    { "role": "user", "content": "What is the fleet status?" },
    { "role": "assistant", "content": "The fleet currently has 2 critical machines." }
  ]
}
```

**Response Body:**
```json
{
  "success": true,
  "data": {
    "answer": "Machine M011 is classified as CRITICAL with a risk score of 93.84/100 at cycle 127. The first sustained anomaly was detected at cycle 102. The leading abnormal indicators are sensor s8 (deviated by 5.16 std, drift rate -0.1034/cycle) and sensor s14 (deviated by 5.32 std). Historical machine M004 showed 60% similarity across sensors s3, s8, and s9.",
    "machine_id": "M011",
    "evidence_references": [
      {
        "evidence_type": "HEALTH_SCORE",
        "cycle": 127,
        "metric_value": 93.84,
        "detail": "Machine M011 classified as CRITICAL with risk score 93.84/100 at cycle 127."
      },
      {
        "evidence_type": "ROOT_CAUSE",
        "sensor_name": "s8",
        "metric_value": 5.16,
        "detail": "Sensor s8 deviated by 5.16 std deviations (Drift rate: -0.1034/cycle)."
      }
    ],
    "suggested_actions": [
      "Schedule immediate borescope or physical teardown inspection prior to next flight/shift.",
      "Conduct sensor diagnostic calibration test to rule out thermocouple/transducer drift.",
      "Inspect subsystem: High Pressure Turbine (Corresponds to abnormal signal s8)."
    ],
    "limitations": [
      "Evidence reflects statistical anomaly detection, not verified physical causality.",
      "RUL estimate represents learned trajectory regression with uncertainty."
    ],
    "provider": "TraceBack Grounded Engine (Offline / Mock)",
    "model": "gpt-4o-mini"
  }
}
```

---

## 7. Machine Comparison

### `POST /api/v1/machines/compare`
Cross-evaluates two or more machines.
```json
{
  "machine_ids": ["M011", "M001"]
}
```

---

## 8. Frontend State Machine Recommendations

| Machine State | `risk_category` | UI Badge Color | Action Required |
|---|---|---|---|
| **Normal** | `HEALTHY` | Green | Normal monitoring |
| **Early Drift** | `WATCH` | Amber / Yellow | Flag for inspection next shift |
| **Severe Deterioration** | `CRITICAL` | Red / Pulsing | Trigger inspection recommendation |
| **New Machine** | `INSUFFICIENT_DATA` | Gray | In initial baseline window (< 30 cycles) |
