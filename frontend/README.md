# TraceBack AI — Frontend

React + TypeScript (strict) + Vite + Tailwind v4 + React Router + TanStack Query + Zod + Recharts + Lucide.
Built against the real FastAPI backend in `../backend` (`/api/v1`). The API contract was taken from the backend
source and OpenAPI document, not invented; every response is validated with Zod at runtime
(`src/schemas/api.ts` is the single source of truth, TypeScript types are inferred from it).

## Pages

| Route | Purpose |
|---|---|
| `/` | Fleet Overview — risk counts, risk distribution (click to filter), pipeline status, sortable/filterable/paginated machine table |
| `/machines/:id` | Machine Investigation — health trajectory, ranked sensor evidence, per-sensor deviation, timeline, historical matches (+ compare), embedded Copilot |
| `/patterns` | Failure Patterns — signature groups, members, per-machine nearest historical matches |
| `/copilot` | AI Copilot — session-only chat with evidence citations that deep-link into the investigation |
| `/benchmarks` | Measured query timings, with environment caveats shown |
| `/settings` | Read-only view of backend / dataset / provider state |

The core workflow: click an abnormal sensor → see when it deviated (health chart + timeline, `?sensor=` / `?cycle=` in the URL)
→ "Ask Copilot why *sX* matters" → Copilot cites evidence → clicking a citation returns to the exact sensor/cycle.

> Picking this up later? Read `HANDOFF.md` (status, next steps) and `docs/DESIGN.md` (palette + design rules).

## Run

```bash
# 1. Backend (from the repository root; see ../docs/RUN_GUIDE.md)
pip install -r backend/requirements.txt
python backend/scripts/seed_demo.py
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# 2. Frontend
cd frontend
cp .env.example .env
npm install
npm run dev            # http://127.0.0.1:5173
```

The backend can also serve the UI itself: `npm run build:backend` writes a same-origin production build to `../backend/app/static`,
after which <http://127.0.0.1:8000> shows the app with no separate dev server.

CORS on the backend allows `localhost`/`127.0.0.1` on ports 3000 and 5173 only.

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000/api/v1` | Backend base URL |
| `VITE_DATA_MODE` | `live` | `live` or `mock` |
| `VITE_REQUEST_TIMEOUT_MS` | `15000` | Per-request timeout (Copilot ×3, pipeline run ×8) |
| `VITE_WATCH_RISK_THRESHOLD` | `45` | Displayed "configured" Watch threshold (risk score) |
| `VITE_CRITICAL_RISK_THRESHOLD` | `75` | Displayed "configured" Critical threshold |

The threshold variables only affect chart reference lines/labels. The backend does not expose its thresholds, so they are
labelled *configured*, not learned.

### Mock mode

`VITE_DATA_MODE=mock npm run dev`. A banner and header badge state that all data is demo fixtures. Mock mode is **only** enabled
explicitly; if the live backend fails, the UI shows an error — it never silently falls back to fixtures. In mock mode no
request leaves the browser (verified: 0 requests to `:8000`).

## Quality checks

```bash
npm run typecheck   # tsc -b
npm run lint        # eslint (no-explicit-any = error)
npm test            # vitest (57 tests: API client, hooks, components, palette sync)
npm run build       # tsc -b && vite build
npm run test:e2e    # Playwright against live backend + dev server (9 tests)
```

## Honesty / presentation rules implemented

- Risk is conveyed by label + icon + colour, never colour alone.
- Health = 100 − risk; labelled as a statistical score from a healthy baseline, not a failure probability.
- RUL is labelled *unvalidated*; `0` is shown as a "model floor" (backend clamps), not "fails now".
- Historical similarity is labelled pattern overlap (Jaccard), not likelihood.
- Timeline events are tagged Observed / Derived from history / Predicted.
- Copilot: only backend-returned `evidence_references` become links; backend `limitations` are always shown; the offline
  grounded engine is labelled as such (it is not an LLM); errors never produce a fabricated answer; conversations are kept in memory only.
- Unknown / null fields render "—" (never zero or invented values).

## Integration limitations (backend contract gaps)

1. No per-cycle sensor series endpoint → the sensor chart is a **current-cycle** σ-deviation snapshot, not a time series.
2. Thresholds, pipeline run history, and a strongest-sensor field in the fleet list are not exposed.
3. `estimated_rul` is clamped at 0 and `rul_confidence` is a constant 0.82 in the sample data → not presented as validated.
4. `GET /benchmarks` has a side effect (it can record a run) and defaults to the `NASA_FD001` dataset, which is empty in the demo,
   so timings can be for 0 machines; the UI warns when that is the case.
5. `mock_fallback_active` is `false` for the backend's offline engine; the UI detects it from the provider name instead.
6. Group member lists are only available from the group detail endpoint.

## Backend issues found (not modified)

- `backend/scripts/generate_synthetic_fleet.py` used `Optional[str]` without importing `Optional`, so `seed_demo.py` crashed with
  `NameError`. Fixed during submission prep (`from typing import Dict, Any, List, Optional`).

## Not verified

- Only headless Chromium was used (no Firefox/Safari). No real screen-reader pass; keyboard flow and ARIA roles were
  exercised by tests only. Only the synthetic demo dataset (12 machines) against the SQLite mock engine was exercised —
  not an Exasol instance and not NASA C-MAPSS data. The Copilot was tested only against the offline grounded engine, not a live LLM.
