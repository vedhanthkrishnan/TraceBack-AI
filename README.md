# TraceBack AI — Evidence-Driven Predictive Maintenance

**ExaThon India 2026 · Track: Factories, Fleets & Supply Chains**

> Not just an alarm. The evidence behind it.

## Problem

Fleet monitoring says *that* a machine is in trouble ("Machine 104: critical"), not *why*. Engineers must dig
through raw sensor streams to find what changed, when it started, and whether it has happened before. See
[docs/PROBLEM_STATEMENT.md](docs/PROBLEM_STATEMENT.md).

## What TraceBack AI does

For every machine it answers three questions, each backed by data:

1. **When did it start?** First sustained anomaly, marked on a health trend.
2. **Which sensors are the evidence?** Ranked by deviation from the machine's own healthy baseline, drift rate and persistence.
3. **Has this been seen before?** Historical run-to-failure machines with a similar drift pattern.

An evidence-grounded **AI Copilot** explains the results; every claim links back to evidence, and missing data is stated, not guessed.
Analytics are computed deterministically in SQL (Exasol) and Python services, so the system works with no LLM at all.

## What's in this repository

| Folder | What it is |
|---|---|
| `backend/` | FastAPI service, analytics pipeline, Exasol SQL layer with an isolated SQLite fallback, tests |
| `frontend/` | React + TypeScript source (a production build is committed in `backend/app/static` and served by the backend): Fleet Overview, Machine Investigation, Failure Patterns, Copilot, Benchmarks, Settings |
| `docs/` | [Run guide](docs/RUN_GUIDE.md), [problem statement](docs/PROBLEM_STATEMENT.md), [demo script](docs/DEMO_SCRIPT.md), [pitch deck (PDF)](docs/TraceBack-AI-Pitch-Deck.pdf), judge notes, backend audit |
| `docker-compose.yml` | Backend container |

## Quick start (one server, one command)

The backend also serves the built web app, so you only need Python.

```bash
git clone https://github.com/vedhanthkrishnan/TraceBack-AI.git
cd TraceBack-AI
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env          # Windows PowerShell: Copy-Item backend\.env.example backend\.env
python backend/scripts/seed_demo.py           # loads the synthetic 12-machine fleet
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000** for the app (API docs at `/docs`). No Exasol needed: without it the backend uses an
isolated SQLite engine automatically. Developing the UI, Docker, Windows commands and troubleshooting:
**[docs/RUN_GUIDE.md](docs/RUN_GUIDE.md)**.

## Honest limits

The demo fleet is **synthetic** (12 machines) and labelled as such in the UI. Sensor deviation is statistical
evidence, not proven cause. Remaining useful life is unvalidated. The Copilot uses an offline grounded engine
by default; a live LLM is optional.

## Creators

Jyothik Bollineni and Vedhanth Krishnan, built for ExaThon India 2026.

## Licence

[MIT](LICENSE) © 2026 Jyothik Bollineni and Vedhanth Krishnan

---

# Backend reference

TraceBack AI is a predictive maintenance analytics backend that helps industrial operations teams understand **why** machines deteriorate, **which** sensors provide evidence of deterioration, and **which** historical failures resemble the current machine's behaviour.

Built on **Exasol database analytics**, **FastAPI**, and an **Evidence-Grounded AI Copilot**, TraceBack replaces unhelpful generic alarms with traceable, data-backed root-cause explanations.

---

## 1. Product Overview & Key Differentiators

Traditional industrial monitoring systems issue vague threshold alerts:
> *"Machine 104 has a critical alarm."*

**TraceBack AI** delivers actionable, explainable diagnostic evidence:
> *"Machine 104 crossed the configured critical-risk threshold at cycle 127. Sensors S8 and S14 show substantial standard-deviation drift from their learned healthy baselines. The first sustained anomaly appeared at cycle 102. Two historical machines (M004 and M005) exhibit similar drift signatures. Recommended action: inspect High Pressure Turbine subsystems and check sensor calibration."*

### Key Analytical Capabilities
1. **Machine-Specific Baselines**: Learns sensor mean and variance over the initial healthy operating cycles (e.g. cycles 1–30), with zero-variance detection.
2. **Standardized Drift Tracking**: Computes rolling z-score deviations and drift rates using Exasol window functions.
3. **Transparent Risk Scoring**: Aggregates top abnormal signals into a 0–100 risk score categorized into `HEALTHY`, `WATCH`, `CRITICAL`, or `INSUFFICIENT_DATA`.
4. **Root-Cause Evidence Ranking**: Ranks abnormal sensors by an interpretable contribution score incorporating deviation magnitude (40%), drift rate (30%), persistence (20%), and threshold crossings (10%).
5. **Failure Signature Matching**: Extracts ordered anomaly trajectories from historical run-to-failure machines and performs Jaccard similarity matching against active drift patterns.
6. **Remaining Useful Life (RUL)**: Ridge regression model estimating operating cycles remaining before failure.
7. **Grounded AI Copilot**: Answers natural language inquiries strictly using retrieved backend evidence—refuses to fabricate readings or invent causality.

---

## 2. Architecture Diagram

```
+-------------------------------------------------------------------------+
|                         React + TypeScript Frontend                     |
+------------------------------------+------------------------------------+
                                     | HTTP / JSON REST APIs (CORS Enabled)
                                     v
+-------------------------------------------------------------------------+
|                           FastAPI Web Server                            |
|  - Rate Limiting Middleware   - Validation (Pydantic v2)  - Request ID  |
+-------------------+----------------+-------------------+----------------+
                    |                |                   |
                    v                v                   v
            +---------------+ +--------------+ +-------------------+
            | Fleet Routes  | | Machine Rtes | | Copilot Chat Rte  |
            +-------+-------+ +------+-------+ +---------+---------+
                    |                |                   |
                    v                v                   v
      +-------------------------------------------------------------+
      |                   Repositories & Services                   |
      |  - IngestionService    - BaselineService   - DriftService   |
      |  - HealthService       - RootCauseService  - SignatureServ  |
      |  - CopilotTools        - Orchestrator      - RULService     |
      +------------------------------+------------------------------+
                                     |
                                     v
      +-------------------------------------------------------------+
      |                   Database Layer (Exasol / Mock)            |
      |  - PyExasol connection manager                              |
      |  - Schema: TRACEBACK_AI                                     |
      |  - High-performance Exasol SQL window functions & MERGE     |
      |  - Isolated local mock engine for offline development       |
      +-------------------------------------------------------------+
```

---

## 3. Technology Stack

- **Primary Analytics Database**: Exasol Personal / Community Edition (Exasol SQL window functions & MERGE statements).
- **Fallback Development Database**: Isolated SQLite Mock Engine (activated automatically if Exasol is offline).
- **Backend Framework**: Python 3.12+ / FastAPI / Uvicorn.
- **Data Validation & Schemas**: Pydantic v2 & Pydantic-Settings.
- **Analytics & Data Processing**: Pandas, NumPy, Scikit-learn (K-Means signature clustering & Ridge RUL regression).
- **Testing**: Pytest, Pytest-Asyncio, HTTPX ASGI client (19 passing unit, API, integration, and Copilot tests).
- **AI Copilot**: Provider-independent interface (OpenAI, Gemini, or Grounded Mock Provider).

---

## 4. Directory Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI application entrypoint & exception handlers
│   ├── core/
│   │   ├── config.py               # Pydantic environment configuration
│   │   ├── logging.py              # Structured, credential-sanitized logger
│   │   ├── exceptions.py           # Domain exceptions (404, 422, 502, 503)
│   │   └── security.py             # Rate limiter & request ID middleware
│   ├── api/
│   │   ├── router.py               # API v1 router registry
│   │   └── routes/
│   │       ├── health.py           # /health and /readiness endpoints
│   │       ├── fleet.py            # /fleet and /fleet/summary
│   │       ├── machines.py         # /machines/{id}, /sensors, /root-cause, /compare
│   │       ├── analytics.py        # /pipeline/run and /pipeline/status
│   │       ├── groups.py           # /groups (failure signature archetypes)
│   │       ├── copilot.py          # /copilot/chat and /copilot/status
│   │       ├── benchmarks.py       # /benchmarks (monotonic query timing)
│   │       └── ingestion.py        # /ingestion/jobs/{id}
│   ├── schemas/
│   │   ├── common.py               # Standard response envelopes & pagination
│   │   ├── fleet.py                # MachineSummary & FleetSummary
│   │   ├── machine.py              # MachineDetail, History, SensorDriftSummary
│   │   ├── analytics.py            # RootCauseEvidenceItem, HistoricalMatch
│   │   ├── copilot.py              # CopilotChatRequest & Response with citations
│   │   └── benchmark.py            # BenchmarkResult & PipelineRunStatus
│   ├── db/
│   │   ├── connection.py           # Database connection manager (Exasol + Mock)
│   │   ├── exasol.py               # Identifier sanitization & Exasol utilities
│   │   ├── mock_engine.py          # Isolated SQLite mock implementation
│   │   └── schema.sql              # Pure Exasol DDL (10 structured tables)
│   ├── repositories/
│   │   ├── fleet_repository.py     # Fleet risk queries & pagination
│   │   ├── machine_repository.py   # Machine telemetry & comparison queries
│   │   ├── analytics_repository.py # Root-cause ranking & signature matching
│   │   └── copilot_repository.py   # Read-only grounded evidence fetchers
│   ├── services/
│   │   ├── data_validation_service.py # Pre-ingestion validation & constant sensors
│   │   ├── ingestion_service.py    # C-MAPSS parser & idempotent database loader
│   │   ├── baseline_service.py     # Initial healthy window baseline statistics
│   │   ├── drift_service.py        # Rolling deviations & anomaly persistence
│   │   ├── health_service.py       # Health index (0-100) & risk categorization
│   │   ├── root_cause_service.py   # Multi-signal evidence ranking
│   │   ├── signature_service.py    # K-Means failure clustering & Jaccard matching
│   │   ├── remaining_life_service.py # RUL regression modeling
│   │   ├── recommendation_service.py # Component inspection step generator
│   │   └── benchmark_service.py    # Execution timing benchmarks
│   ├── copilot/
│   │   ├── provider.py             # LLM provider abstraction (OpenAI, Gemini, Mock)
│   │   ├── orchestrator.py         # Evidence retrieval & prompt assembly
│   │   ├── tools.py                # Secure read-only analytical tools
│   │   ├── prompts.py              # Grounding prompts & methodology definitions
│   │   └── safety.py               # Query sanitizer & hallucination filters
│   └── analytics/
│       └── queries/                # Pure Exasol analytical SQL scripts
│           ├── baselines.sql
│           ├── drift.sql
│           ├── health_scores.sql
│           ├── root_cause.sql
│           ├── signatures.sql
│           └── evaluation.sql
│   └── workers/
│       └── pipeline.py             # End-to-end synchronized pipeline worker
├── scripts/
│   ├── generate_synthetic_fleet.py # Reproducible synthetic industrial fleet generator
│   ├── download_dataset.py         # NASA C-MAPSS dataset downloader
│   ├── initialise_database.py      # Schema initialisation script
│   ├── load_dataset.py             # Dataset loader CLI
│   ├── run_pipeline.py             # Pipeline execution CLI
│   └── seed_demo.py                # Seed workflow for judge demonstration
├── tests/
│   ├── unit/test_analytics.py      # Baselines, drift, variance, risk scoring
│   ├── api/test_endpoints.py       # HTTP status, 404 handling, pagination
│   ├── copilot/test_copilot.py     # Evidence grounding & prompt safeguards
│   └── integration/test_pipeline_integration.py # Ingestion & pipeline idempotency
├── requirements.txt                # Python dependencies
├── Dockerfile                      # Production container spec
├── docker-compose.yml              # Multi-service composition
└── README.md                       # Comprehensive documentation
```

---

## 5. Quickstart & Installation

### Prerequisites
- Python 3.12+ (or compatible 3.14).
- Optional: Exasol Personal or Community Edition running on `localhost:8563` (if not running, TraceBack automatically switches to the isolated mock engine for local testing).

### Step 1: Clone and Create Virtual Environment
```powershell
git clone https://github.com/vedhanthkrishnan/TraceBack-AI.git
cd TraceBack-AI
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Step 2: Install Dependencies
```powershell
pip install -r backend/requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item backend\.env.example backend\.env
```
Key configuration settings:
```ini
EXASOL_DSN=localhost:8563
EXASOL_USER=sys
EXASOL_PASSWORD=exasol
EXASOL_SCHEMA=TRACEBACK_AI
MOCK_EXASOL=false

LLM_PROVIDER=mock
# Optional: set LLM_PROVIDER=openai and supply LLM_API_KEY for live OpenAI Copilot
# LLM_PROVIDER=openai
# LLM_API_KEY=sk-...

API_HOST=127.0.0.1
API_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## 6. Seed Demo Workflow (Judge-Ready)

To initialize the schema, ingest demo turbofan engine trajectories, run the real predictive maintenance pipeline, and prepare showcase evidence:

```powershell
python backend/scripts/seed_demo.py
```

### Sample Demo Output

_Illustrative: machine IDs, sensors and scores depend on the seeded fleet and may differ from a fresh run._
```
======================================================================
   DEMO SHOWCASE MACHINE: M011
======================================================================
- Evaluation Cycle: 127
- Risk Score: 93.84/100 -> Classification: CRITICAL
- First Sustained Anomaly: Cycle 102
- Estimated Remaining Useful Life (RUL): 28.4 cycles (Confidence: 0.82)

Top Root-Cause Sensor Evidence:
  * [Rank 1] s8: Deviation 5.16 std, Drift Rate -0.1034/cycle, Persistence 10 cycles
    Explanation: Sensor s8 deviated by 5.16 standard deviations from healthy baseline.
  * [Rank 2] s14: Deviation 5.32 std, Drift Rate -0.0766/cycle, Persistence 10 cycles
  * [Rank 3] s3: Deviation 4.02 std, Drift Rate 0.1163/cycle, Persistence 10 cycles

Historical Run-to-Failure Matches:
  * Match M004: Similarity 60%, Shared sensors: s3, s8, s9
  * Match M005: Similarity 40%, Shared sensors: s8, s9
======================================================================
```

---

## 7. Starting the Backend API

Start the FastAPI development server:
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive API documentation will be available at:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 8. API Endpoint Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service health and database dependency status |
| `GET` | `/api/v1/readiness` | Readiness check for serving queries |
| `GET` | `/api/v1/fleet` | Paginated fleet list ranked by risk score |
| `GET` | `/api/v1/fleet/summary` | Fleet aggregates (Critical, Watch, Healthy counts) |
| `GET` | `/api/v1/machines/{id}` | Machine health score, risk category, and diagnosis |
| `GET` | `/api/v1/machines/{id}/history` | Historical health trajectory across all cycles |
| `GET` | `/api/v1/machines/{id}/sensors` | Sensor baselines and rolling drift z-scores |
| `GET` | `/api/v1/machines/{id}/root-cause` | Ranked root-cause sensor evidence |
| `GET` | `/api/v1/machines/{id}/signatures` | Failure signature and historical matching cases |
| `GET` | `/api/v1/machines/{id}/evidence` | Consolidated evidence bundle |
| `POST` | `/api/v1/machines/compare` | Multi-machine comparative evaluation |
| `GET` | `/api/v1/groups` | Clustered failure signature archetypes |
| `GET` | `/api/v1/groups/{id}` | Archetype details and member machines |
| `POST` | `/api/v1/copilot/chat` | Natural language inquiry grounded in evidence |
| `GET` | `/api/v1/copilot/status` | Copilot provider status and available tools |
| `GET` | `/api/v1/benchmarks` | Monotonic execution timings for analytical queries |
| `POST` | `/api/v1/pipeline/run` | Triggers predictive maintenance pipeline run |
| `GET` | `/api/v1/pipeline/status` | Status of the latest pipeline execution |
| `GET` | `/api/v1/ingestion/jobs/{id}` | Ingestion batch status and validation logs |

---

## 9. Connecting the React Frontend

The React/TypeScript frontend in [`frontend/`](frontend/README.md) communicates with this backend:
1. Base API URL: `http://127.0.0.1:8000/api/v1`
2. CORS is pre-configured for `http://localhost:3000` and `http://localhost:5173`.
3. Every response conforms to the uniform envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "message": null,
  "request_id": "4b655513-..."
}
```

---

## 10. AI Copilot Architecture & Safeguards

The Copilot is an evidence-grounded assistant, **not a chatbot computing risk scores**.
- **Separation of Concerns**: Exasol and the analytics pipeline compute baselines, deviations, health indices, and rankings. The Copilot retrieves those exact values through safe, read-only tools and explains them.
- **Hallucination Prevention**:
  - The model prompt is populated with retrieved facts (machine ID, cycle, sensor deviation magnitudes, drift rates, onset cycle, and matched historical cases).
  - Out-of-bounds claims such as *"will definitely fail at cycle X"* are intercepted and replaced with probabilistic inspection advice.
  - The model is instructed to refuse questions where telemetry is missing or insufficient.
- **Provider Abstraction**: Works in 100% offline mock mode out of the box, or connects to OpenAI/Gemini when an API key is configured.

---

## 11. Automated Testing Results

Run the full automated test suite:
```powershell
python -m pytest backend/tests/ -v
```

### Verified Test Summary:
```
backend/tests/api/test_endpoints.py::test_health_endpoint PASSED
backend/tests/api/test_endpoints.py::test_readiness_endpoint PASSED
backend/tests/api/test_endpoints.py::test_fleet_endpoints PASSED
backend/tests/api/test_endpoints.py::test_machine_detail_and_investigation_endpoints PASSED
backend/tests/api/test_endpoints.py::test_invalid_machine_id_returns_404 PASSED
backend/tests/api/test_endpoints.py::test_signature_groups PASSED
backend/tests/api/test_endpoints.py::test_machine_comparison PASSED
backend/tests/copilot/test_copilot.py::test_copilot_status PASSED
backend/tests/copilot/test_copilot.py::test_copilot_chat_methodology PASSED
backend/tests/copilot/test_copilot.py::test_copilot_chat_for_critical_machine PASSED
backend/tests/copilot/test_copilot.py::test_copilot_chat_nonexistent_machine PASSED
backend/tests/integration/test_pipeline_integration.py::test_full_pipeline_execution_and_idempotency PASSED
backend/tests/unit/test_analytics.py::test_validation_detects_empty_dataframe PASSED
backend/tests/unit/test_analytics.py::test_validation_detects_constant_sensors PASSED
backend/tests/unit/test_analytics.py::test_zero_variance_safe_handling PASSED
backend/tests/unit/test_analytics.py::test_rolling_drift_smoothing PASSED
backend/tests/unit/test_analytics.py::test_risk_category_transitions PASSED
backend/tests/unit/test_analytics.py::test_recommendation_service_actions PASSED
backend/tests/unit/test_analytics.py::test_copilot_safety_filter PASSED

============================= 19 passed in 14.69s =============================
```

---

## 12. Monotonic Performance Benchmarks

Measured on local hardware using `backend/app/services/benchmark_service.py` across 3 repetitions:
- **Fleet Risk Aggregation**: `2.81 ms - 2.97 ms`
- **Sensor Drift Query**: `13.94 ms - 14.27 ms`
- **Root-Cause Ranking Query**: `7.97 ms - 8.97 ms`

All benchmark timings come from monotonic clock measurements against structured tables.

---

## 13. Limitations & Future Work

1. **Physical Causality**: Statistical deviation identifies anomalous sensor readings; physical failure confirmation requires on-wing borescope inspection.
2. **Exasol Connection**: When a live Exasol daemon is running on `localhost:8563`, set `MOCK_EXASOL=false` in `.env` to execute queries directly in Exasol. When Exasol is not running, the isolated mock engine handles all queries seamlessly.
3. **Multi-Condition Normalization**: Future versions can introduce operating regime clustering for machines operating across high altitude and ambient temperature fluctuations.
