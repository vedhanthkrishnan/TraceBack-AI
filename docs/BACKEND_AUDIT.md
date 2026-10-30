# TraceBack AI — Comprehensive Backend Audit Report

**Date:** October 30, 2026  
**Auditor:** Senior Backend, ML & Database Reviewer  
**Audit Target:** TraceBack AI Predictive Maintenance Backend  
**Active Python Runtime:** Python 3.14.8 on Windows x86_64  
**Primary Database Engine:** Exasol Personal / Community Edition  
**Fallback Engine:** Isolated SQLite Mock Engine (`data/traceback_mock.db`)  

---

## 1. Executive Summary

This audit evaluated the complete TraceBack AI backend across architecture, database integration, analytical validity, machine-learning models, AI Copilot grounding, API contracts, security, and demo readiness.

The current implementation has established a modular architecture with strict repository/service separation, type-checked Pydantic v2 schemas, parameter-validated analytical tools, and a 19-test automated test suite. 

However, this audit identified **critical correctness defects and transparency gaps** that must be resolved to achieve full hackathon judge readiness:
1. **[P0] NASA C-MAPSS Downloader Fallback Masking**: The primary URL for NASA C-MAPSS (`nasa/cmaps/master/CMAPSSData/train_FD001.txt`) was a dead 404 link. The previous code caught the HTTP error and generated synthetic trajectories into `data/train_FD001.txt`, silently presenting synthetic data as genuine NASA turbofan data.
2. **[P0] RUL Model Evaluation & Leakage Check Absence**: Ridge regression was trained on 70% of engines and used to predict cycles, but no evaluation script or metrics (MAE, RMSE, R2, baseline comparisons) were computed or saved.
3. **[P1] Execution Mode Transparency in Readiness Endpoint**: The `/api/v1/readiness` endpoint did not explicitly report the active engine (`exasol` vs `sqlite_mock`), dataset mode (`REAL_NASA_FD001` vs `SYNTHETIC_FLEET_DEMO`), or LLM provider status.
4. **[P1] SQL Parameter Incompatibilities in `drift.sql`**: In `drift.sql`, the window frame clause `ROWS BETWEEN (:drift_window - 1) PRECEDING AND CURRENT ROW` used dynamic parameter arithmetic in an ISO SQL frame bound, which is unsupported on strict Exasol SQL engines.
5. **[P1] Copilot Adversarial & Multi-Turn Test Coverage**: Existing Copilot tests verified basic Q&A, but lacked adversarial regression tests (prompt injection handling, refusal to invent physical root causes, handling of empty/malformed inputs).
6. **[P2] Benchmark Provenance Documentation**: Previous benchmark figures (2.81ms to 14.27ms) were collected on the local SQLite mock engine without prominent contextual labeling, which could mislead judges into assuming they were collected on an Exasol cluster.

---

## 2. Feature & Implementation Status Matrix

| Subsystem / Feature | Claimed State | Actual Implemented State | Verified Status | Evidence |
|---|---|---|---|---|
| **Exasol DDL Schema** | 10 Relational Tables | 10 Tables defined in `backend/app/db/schema.sql` | **Implemented & Tested (Offline)** | Exasol DDL script valid; mirrored in `MockExasolEngine` |
| **Exasol Connectivity** | `pyexasol` client | Connection manager in `backend/app/db/connection.py` | **Implemented with Auto-Fallback** | Auto-detects offline Exasol (target refused port 8563) and activates isolated mock engine |
| **Execution Mode Visibility** | Visible active mode | Present in `/health`, incomplete in `/readiness` | **Partially Implemented (P1)** | `/health` exposes `is_mock`; `/readiness` lacks `dataset_mode` and `engine` fields |
| **C-MAPSS Data Ingestion** | Space-delimited parser | Space-delimited parser in `ingestion_service.py` | **Functional with P0 Data Bug** | Parser functions cleanly, but downloader fallback masked synthetic data as `train_FD001.txt` |
| **Synthetic Fleet Generator** | Reproducible generator | `generate_synthetic_fleet.py` with seed | **Verified Functional** | Generates 21-sensor trajectories with controlled degradation drift |
| **Sensor Baselines** | Mean, std, zero-var safe | `baseline_service.py` + `baselines.sql` | **Verified Functional** | Handles zero-variance sensors with safe `1e-6` fallback |
| **Sensor Drift & Anomaly** | Rolling z-score & persistence | `drift_service.py` + `drift.sql` | **Functional with SQL frame defect (P1)** | Python mock calculates correctly; SQL frame bound requires constant |
| **Risk Index & Category** | 0-100 score + categories | `health_service.py` + `health_scores.sql` | **Verified Functional** | Maps top 5 abnormal sensors to 0-100 score; protects early cycles (<30) |
| **Root-Cause Ranking** | 4-signal contribution score | `root_cause_service.py` + `root_cause.sql` | **Verified Functional** | Weights: 40% dev mag, 30% drift rate, 20% persistence, 10% threshold |
| **Failure Signatures** | K-Means + Jaccard match | `signature_service.py` + `analytics_repo.py` | **Verified Functional** | Clusters into 3 archetypes; Jaccard matches historical run-to-failure cases |
| **Remaining Useful Life (RUL)** | Ridge regression | `remaining_life_service.py` | **Implemented, Not Evaluated (P0)** | Fits model but lacks evaluation script and metrics reporting |
| **AI Copilot Grounding** | Evidence-based assistant | `orchestrator.py`, `tools.py`, `safety.py` | **Verified Functional** | Retrieves database evidence; refuses to invent numbers; offline mock works |
| **REST APIs** | REST v1 endpoints | 18 endpoints in `backend/app/api/` | **Verified Functional** | All endpoints return uniform `APIResponse` envelope |
| **Automated Tests** | Automated test suite | 19 passing tests in `backend/tests/` | **Verified Functional** | Passes in 11.7s on Python 3.14 |

---

## 3. Confirmed Defects & Severity Classification

### P0 — Critical Defects (Must Fix Before Submission)
- **DEF-01: NASA C-MAPSS URL 404 & Silent Synthetic Masking**  
  *Severity:* P0  
  *Location:* `backend/scripts/download_dataset.py`  
  *Issue:* `https://raw.githubusercontent.com/nasa/cmaps/master/CMAPSSData/train_FD001.txt` returned 404 Not Found. The script caught the exception and generated a synthetic dataset saving it to `data/train_FD001.txt`.  
  *Risk:* Violates Rule B ("Never fake verification"). Judges checking dataset provenance would discover synthetic data masquerading as genuine NASA turbofan data.  
  *Remedy:* Configure verified working mirror (`https://raw.githubusercontent.com/hankroark/Turbofan-Engine-Degradation/master/CMAPSSData/train_FD001.txt`). When offline, save synthetic fleet strictly under `data/synthetic_fleet_demo.csv` and tag `dataset_id = "SYNTHETIC_FLEET_DEMO"`.

- **DEF-02: Missing RUL Model Evaluation Script & Metrics**  
  *Severity:* P0  
  *Location:* `backend/app/services/remaining_life_service.py`  
  *Issue:* RUL was assigned to database rows, but no independent validation script existed to measure held-out MAE, RMSE, or R2 against a baseline.  
  *Risk:* Claiming an ML model is functional without evaluation metrics invalidates hackathon judging criteria.  
  *Remedy:* Implement `backend/scripts/evaluate_models.py` to evaluate held-out engine splits (70/30 train/test by engine ID), compute MAE/RMSE vs baseline, and output a verifiable evaluation report.

### P1 — Important Correctness & Transparency Defects
- **DEF-03: Execution Mode Transparency in Readiness Endpoint**  
  *Severity:* P1  
  *Location:* `backend/app/schemas/common.py` and `backend/app/api/routes/health.py`  
  *Issue:* `/api/v1/readiness` only reported `ready`, `database_connected`, `schema_initialized`, and `active_dataset`. It omitted `engine` (`exasol` vs `sqlite_mock`), `dataset_mode` (`REAL_NASA_FD001` vs `SYNTHETIC_FLEET_DEMO`), and `llm_provider`.  
  *Risk:* The React frontend and judges cannot determine from `/readiness` whether the backend is running live Exasol or local mock engine.  
  *Remedy:* Add `engine`, `dataset_mode`, `llm_provider`, and `pipeline_status` to `ReadinessStatus`.

- **DEF-04: Exasol SQL Parameter Syntax in `drift.sql`**  
  *Severity:* P1  
  *Location:* `backend/app/analytics/queries/drift.sql`  
  *Issue:* `ROWS BETWEEN (:drift_window - 1) PRECEDING AND CURRENT ROW` uses dynamic parameter subtraction inside a window frame specification. Strict SQL dialects (including Exasol) require integer constants in window frame bounds.  
  *Risk:* Executing `drift.sql` against a live Exasol database will raise a syntax error.  
  *Remedy:* Pre-bind or template the integer frame bound or use static constant `ROWS BETWEEN 14 PRECEDING AND CURRENT ROW` for standard 15-cycle drift.

- **DEF-05: Limited Copilot Adversarial & Refusal Testing**  
  *Severity:* P1  
  *Location:* `backend/tests/copilot/test_copilot.py`  
  *Issue:* Only 4 happy-path Copilot tests existed. Adversarial prompt injections, missing telemetry, and refusal to claim physical causality were not tested end-to-end via the API.  
  *Remedy:* Add comprehensive adversarial and edge-case tests in `test_copilot.py`.

### P2 — Performance & Documentation Improvements
- **DEF-06: Clarify Benchmark Provenance in Documentation**  
  *Severity:* P2  
  *Location:* `backend/app/api/routes/benchmarks.py`, `README.md`  
  *Issue:* Benchmark numbers (2.81ms, 13.94ms, 7.97ms) need unambiguous labeling indicating they were measured using the SQLite mock engine on local developer hardware, rather than an Exasol MPP cluster.  
  *Remedy:* Update benchmark docstrings, responses, and README to state the measurement environment clearly.

---

## 4. External Dependencies & Services Status

| Dependency | Configuration | Status in Current Environment | Verification Plan |
|---|---|---|---|
| **Python 3.14 / FastAPI** | Local environment | **Verified Active & Running** | All endpoints start and serve requests |
| **pyexasol Client** | `pyexasol 3.0.1` | **Installed & Verified** | Client installed; catches connection errors cleanly |
| **Exasol Daemon** | `localhost:8563` | **Offline / Unavailable** | Port 8563 refused connection; mock engine activated |
| **SQLite Mock Engine** | `data/traceback_mock.db` | **Verified Active & Seeded** | 1,055 records, 12 machines, 15,825 drift rows |
| **LLM Provider (OpenAI/Gemini)** | Configured via env | **Mock Provider Active** | Deterministic offline provider tested; external API keys optional |
| **NASA C-MAPSS Mirror** | GitHub Raw HTTPS | **Verified Working Mirror** | Mirror tested; 20,631 records / 100 engines verified |

---

## 5. Recommended Execution Plan

1. **Stage 2**: Fix `download_dataset.py` with verified NASA C-MAPSS mirror and explicit synthetic fallback separation.
2. **Stage 2**: Fix `drift.sql` window frame parameter syntax.
3. **Stage 2**: Enhance `/api/v1/readiness` and `/api/v1/health` with complete execution-mode and dataset-mode transparency.
4. **Stage 3**: Build `backend/scripts/evaluate_models.py` to evaluate held-out engine performance for RUL (MAE, RMSE, R2) and anomaly detection lead times.
5. **Stage 3**: Expand unit, integration, and Copilot adversarial tests.
6. **Stage 4**: Author `docs/FRONTEND_INTEGRATION.md` and `docs/JUDGE_TECHNICAL_NOTES.md`.
7. **Stage 5**: Rehearse end-to-end execution and record final benchmark and verification metrics.
