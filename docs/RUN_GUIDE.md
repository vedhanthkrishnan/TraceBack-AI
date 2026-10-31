# Run guide

Three ways to run TraceBack AI, from fastest to most complete. All commands are run from the repository
root unless a `cd` says otherwise. Windows PowerShell and macOS/Linux variants are shown where they differ.

**Requirements:** Python 3.12+, Node.js 20+ and npm. Docker is optional. Exasol is optional: without it the
backend uses an isolated SQLite engine automatically.

---

## Option 1: Frontend only, demo data (about 1 minute)

No backend needed. The app shows built-in demo fixtures and says so in a banner.

```bash
cd frontend
npm install
cp .env.example .env
```

Set `VITE_DATA_MODE=mock` in `frontend/.env`, then:

```bash
npm run dev
```

Open <http://127.0.0.1:5173>.

---

## Option 2: Full app from the backend only (recommended)

The backend serves the built web app, so no Node.js is needed.

```bash
python -m venv .venv
# Windows PowerShell:  .\.venv\Scripts\Activate.ps1
# macOS / Linux:       source .venv/bin/activate
pip install -r backend/requirements.txt

# Windows PowerShell:  Copy-Item backend\.env.example backend\.env
cp backend/.env.example backend/.env

# Create the schema, load the 12-machine synthetic fleet and run the analytics pipeline
python backend/scripts/seed_demo.py

# Start API + app on one port
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000>. The header badge should read **API connected**. API docs: <http://127.0.0.1:8000/docs>.

If no Exasol server is running on `localhost:8563`, the backend switches to its isolated SQLite engine on
its own (`/api/v1/readiness` reports `"is_mock": true`). To force it, set `MOCK_EXASOL=true` in
`backend/.env`.

### Developing the frontend (hot reload)

Keep the backend running, then in a second terminal:

```bash
cd frontend
npm install
cp .env.example .env        # keep VITE_DATA_MODE=live
npm run dev                 # http://127.0.0.1:5173
```

CORS allows `localhost` and `127.0.0.1` on ports 3000 and 5173 only. After changing the UI, rebuild what the
backend serves:

```bash
cd frontend && npm run build:backend     # writes to backend/app/static
```

---

## Option 3: Backend in Docker

```bash
docker compose up --build
```

The API is served on <http://localhost:8000>. The compose file mounts `./data` for the local database and
uses the offline mock engine and offline Copilot by default. Seed demo data inside the container:

```bash
docker compose exec traceback-backend python backend/scripts/seed_demo.py
```

Then open <http://localhost:8000>; the app is served by the same container.

---

## Optional settings

| Setting | Where | Effect |
|---|---|---|
| `MOCK_EXASOL=false` + `EXASOL_*` | `backend/.env` | Use a real Exasol instance |
| `LLM_PROVIDER=openai` + `LLM_API_KEY` | `backend/.env` | Use a live LLM for the Copilot instead of the offline grounded engine |
| `VITE_API_BASE_URL` | `frontend/.env` | Point the frontend at a different backend |
| `VITE_DATA_MODE=mock` | `frontend/.env` | Frontend demo fixtures, no backend |

## Tests

```bash
python -m pytest backend/tests/ -v      # backend
cd frontend && npm test                 # frontend (Vitest)
```

## Troubleshooting

- **"Backend unreachable" in the frontend dev server (port 5173):** start the backend first and check port 8000. On port 8000 itself the app talks to the same server.
- **Port 8000 shows only JSON / no app:** `backend/app/static` is missing; run `cd frontend && npm run build:backend`.
- **Empty fleet:** run `python backend/scripts/seed_demo.py` before starting the API.
- **`python` not found on macOS/Linux:** use `python3`.
- **Port 5173 or 8000 already in use:** stop the other process, or change the port and set
  `VITE_API_BASE_URL` / `CORS_ORIGINS` to match.
