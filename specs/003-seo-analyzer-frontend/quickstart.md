# Quickstart: Visora Analyzer Application

Validation guide for this feature once implemented. Assumes `frontend/` dependencies are installed (`npm install`, run in `frontend/`) and daisyUI/Zustand have been added per `plan.md`.

## Prerequisites

- Node version matching `frontend/.node-version`
- `npm install` run inside `frontend/`
- No backend/database setup required — everything in this feature is mocked (see `research.md` §2, §6)

## Run the app

```bash
cd frontend
npm run dev
```

Open the printed local URL (default `http://localhost:3000`).

## Scenario 1 — Analyze a single URL (validates User Story 1 / FR-001–FR-013)

1. From the landing page, follow the call-to-action into the analyze flow (`/analyze`).
2. Enter any URL (mock data does not require real reachability) and submit.
3. **Expect**: status visibly progresses `queued → fetching → analyzing → complete` without a manual refresh (FR-003).
4. **Expect**: results view shows an overall score badge (0–100), findings grouped by category (meta tags, content, HTML structure, file size), each with a color matching its severity (FR-006, FR-007).
5. **Expect**: at least one finding shows a "Copy" control that copies a code snippet to the clipboard (FR-012).
6. Submit an obviously malformed string (e.g., `not a url`) — **expect** an inline validation error before any run is created (FR-002).

## Scenario 2 — Projects and shared issues (validates User Story 2 / FR-014–FR-017)

1. Go to `/projects`, create a new project, and add 2–3 URLs to it.
2. Trigger analysis on each URL in the project (concurrently — **expect** independent progress trackers for each, FR-003/FR-015).
3. Once complete, open the project summary — **expect** any finding that appears on 2+ of the URLs to be listed as a shared/systemic issue, visually distinct from single-page findings (FR-016).
4. Add the same URL used in Scenario 1 to this project — **expect** it to reuse the existing target and history rather than starting a fresh, empty one (global identity, `data-model.md`).

## Scenario 3 — Historical timeline (validates User Story 3 / FR-018–FR-020)

1. Re-run analysis on a URL already analyzed in Scenario 1.
2. Open that URL's history (`/targets/[targetId]/history`) — **expect** both runs listed as dated points, most recent status/score visible per point.
3. Open the earlier (first) run from the timeline — **expect** it renders that run's own results, not the latest ones.

## Scenario 4 — Automations (validates User Story 4 / FR-021–FR-024)

1. From a project or a single target, open the automation setup and configure a recurring schedule (e.g., weekly on Monday, 9:00 AM).
2. **Expect** the schedule renders back in plain language (e.g., "Every Monday at 9:00 AM") and shows a computed next-run time (FR-022).
3. Pause the automation — **expect** it's clearly marked inactive and stops being counted as upcoming (FR-023).
4. (Simulated trigger, per Assumptions) If the implementation exposes a way to fast-forward/force a scheduled run for demo purposes, trigger one — **expect** the resulting run appears in the same history timeline as manual runs, with no special treatment required to understand it (FR-024).

## Scenario 5 — Responsive layout (validates FR-026 / SC-006)

1. Resize the browser (or use device emulation) to a mobile viewport (e.g., 375px wide) on: landing, analyze, results, projects, project detail, history, automations.
2. **Expect**: no horizontal scrolling, no clipped content, all findings/snippets remain readable and the copy control remains usable, on every screen.

## Scenario 6 — Reload resets session state (validates Clarifications: in-memory-only persistence)

1. After completing Scenario 1 or 2, perform a full browser reload (not client-side navigation).
2. **Expect**: all previously created projects/targets/history are gone — the app returns to its empty/landing state, confirming no accidental persistence (localStorage/cookies) was introduced.

## Automated checks

- `npm run type-check` — TypeScript strict mode passes
- `npm run test` (Vitest) — unit/integration suites for `shared/lib/severity.ts`, `shared/realtime/MockAnalysisService`, shared-issue detection, and recurrence-label formatting
- `npm run e2e` (Playwright) — golden-path (Scenario 1), shared-issue (Scenario 2), and a mobile-viewport project (Scenario 5)
