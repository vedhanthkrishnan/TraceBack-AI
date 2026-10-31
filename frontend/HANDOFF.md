# Handoff — where the frontend stands (2026-10-30)

## Status
All six pages work against the real backend and in explicit mock mode. Bright macaron theme (green/teal/yellow/orange/coral on light sky) applied and screen text trimmed to the essentials (see `docs/DESIGN.md`). The user said they may send a different palette — swap per the note at the top of DESIGN.md.
Checks last run: `tsc -b` ✔ · `eslint` ✔ · `vitest` 57 tests ✔ · `npm run build` ✔ · Playwright e2e 9/9 ✔ (live backend).
Visual check: headless Chromium at 1440 / 820 / 390 px, no horizontal overflow on any page.
Not verified: Firefox/Safari, screen readers, Exasol, NASA C-MAPSS data, a real LLM behind the Copilot, contrast of every
combination (only the critical-text tint was calculated).

## Resume in 3 commands
```bash
# backend (from repo root). First fix backend/scripts/generate_synthetic_fleet.py: import Optional from typing.
cd backend && pip install -r requirements.txt && python scripts/seed_demo.py && MOCK_EXASOL=true uvicorn app.main:app --port 8000
# frontend
cd frontend && cp .env.example .env && npm install && npm run dev      # http://127.0.0.1:5173
# mock mode, no backend needed
VITE_DATA_MODE=mock npm run dev
```
Before pushing work: `npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e` (e2e needs both servers).

## Map
- `src/schemas/api.ts` — Zod schemas = the API contract (types inferred). Change here first when the backend changes.
- `src/services/` — typed client (`apiClient.ts`) + endpoint wrappers (`api.ts`); mock transport in `src/mocks/`.
- `src/hooks/queries.ts` — all TanStack Query hooks (machine hooks are disabled for an empty id).
- `src/pages/`, `src/components/{layout,ui,charts,machine,copilot}/` — UI. Theme: `src/styles/globals.css`, `src/lib/palette.ts`.
- `e2e/workflow.spec.ts` — judge workflow: fleet → sensor → timeline → Copilot → citation → back.

## Good next steps
1. Landonorris-style extras not built yet (listed in `docs/DESIGN.md`).
2. When the backend exposes a per-cycle sensor series, replace the snapshot σ chart with a real time series so a judge can see *when* a sensor changed (largest remaining gap vs. the brief).
3. Backend asks: thresholds endpoint, pipeline run history, strongest sensor in the fleet list, non-mutating `GET /benchmarks`, honest RUL confidence.
4. Tests for `PriorityHero`, `CopilotPanel` message/citation rendering, and `useCopilotChat` (stop/retry/duplicate-send).
5. Cross-browser pass (Firefox/WebKit via Playwright projects) and a keyboard + screen-reader audit.
6. Run the Copilot against a real LLM provider and re-check that only backend `evidence_references` become links.

## Gotchas
- Dev servers die when the session restarts; backend deps may need reinstalling.
- Tailwind v4: tokens come from `@theme` in CSS; there is no `tailwind.config.js`.
- `.display` / `.micro` are CSS-uppercased/lowercased; don't rely on visual case in tests.
