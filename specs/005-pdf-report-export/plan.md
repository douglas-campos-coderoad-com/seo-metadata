# Implementation Plan: PDF Report Export

**Branch**: `005-pdf-report-export` | **Date**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-pdf-report-export/spec.md`

## Summary

Export one completed analysis as a single, self-contained, client-facing PDF
containing the three scores and their breakdowns, the GEO visibility narrative,
every finding grouped by category, every recommendation with its full current and
suggested markup, and — when one exists — the optimizer's output.

**Technical approach**: a new read-only endpoint `GET /api/v1/report/{analysis_id}/pdf`
assembles a normalised, browser-free view model from the stored `UrlAnalysis` (and
optional `UrlOptimization`) rows, renders it through a Jinja2 HTML/CSS template, and
prints that page to PDF with **the Playwright Chromium already installed in the
backend image**. No new system dependency, no LLM call, no network access at render
time, and no new persisted table — the report is composed on demand.

The design's centre of gravity is the split between a **pure, browser-free view-model
builder** (where all the edge cases and all the cheap tests live) and a **thin
renderer** (one expensive integration test). See [research.md](research.md) for the
decisions behind every choice below.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.3 / React 18 / Next.js 15 (frontend)

**Primary Dependencies**: FastAPI 0.104, Pydantic v2, SQLAlchemy 2.0 (async),
Playwright 1.40 + Chromium (**already installed** — `backend/Dockerfile:18-21`),
Jinja2 (**new direct pip dependency**, currently only transitive)

**Storage**: PostgreSQL — read-only for this feature. Reads `url_analyses`,
`url_optimizations`, `ingested_urls`. **No new table and no migration**: the spec's
Assumptions state the report is generated on demand and not persisted.

**Testing**: pytest + httpx (backend, `asyncio_mode=auto`, SQLite in-memory per
`backend/tests/conftest.py`); Vitest + React Testing Library (frontend)

**Target Platform**: Linux container (`python:3.12-slim-bookworm`) via Docker Compose

**Project Type**: Web application — `backend/` + `frontend/`

**Performance Goals**: p95 < 8s request-to-last-byte for a typical analysis
(≤ 40 findings), excluding cold browser launch. Sits inside SC-004's 10s
user-facing promise. See research.md §12.

**Constraints**: Self-contained output — no network fetch at render time and none
required to view (FR-020). All content inside the printable area (FR-019). Max 2
concurrent renders (`REPORT_RENDER_CONCURRENCY`, research.md §4). Individual markup
block capped at 20,000 chars with a visible truncation note (`REPORT_MAX_CODE_CHARS`,
research.md §10).

**Scale/Scope**: One analysis per export. Typical 10–40 findings; the design must
not fail at several hundred. Roughly 6 new backend modules, 2 templates, 2 frontend
files.

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1 design.*

| # | Principle | Verdict | Notes |
|---|---|---|---|
| I | Spec-Driven & Contract-First | **PASS (with pre-existing drift noted)** | Spec exists and is checklist-clean; the endpoint is declared in `contracts/` before code. Pre-existing drift: the repo has no `packages/api-client` and `frontend/src/lib/api-client.ts` is hand-written. Not introduced by this feature; not remediated here. |
| II | Type Safety End to End | **PASS** | Pydantic v2 view models at the boundary; `mypy --strict` already configured (`pyproject.toml`). Frontend types are explicit; no `any` across the boundary. |
| III | Test-First With Meaningful Coverage | **PASS** | Tests are written from the spec's acceptance scenarios before implementation. The pure/renderer split (research.md §8) means edge cases are unit-tested without a browser, so SC-008 coverage is cheap and fast. |
| IV | Clear Frontend/Backend Boundary | **PASS** | All composition, normalisation, and status gating live in the backend. The frontend only triggers a download and renders a busy state. |
| V | Secure & Private By Default | **DEVIATION — see Complexity Tracking** | Input validation, output escaping, and a full threat note are covered (research.md §7). **However**: the endpoint carries no auth dependency, because the sibling read it mirrors (`GET /api/v1/analyze/{id}`) has none. Documented and justified below. |
| VI | Observability & Operability | **PASS** | Structured logging + request id already applied app-wide via `RequestIDMiddleware`. This feature logs render duration, finding count, and outcome, and never swallows an exception (FR-021). |
| VII | Performance Budgets & Accessibility | **DEVIATION — see Complexity Tracking** | The default read SLO (p95 < 300ms) is unattainable for document rendering; this feature declares an explicit p95 < 8s instead. The export button meets WCAG 2.2 AA (accessible name, busy state announced, keyboard reachable). |
| VIII | Simplicity & Small Vertical Slices | **PASS** | One vertical slice, synchronous, no job queue, no new table, no new service. Reuses the browser already in the image. |

**Gate result**: proceed. Two deviations, both explicitly justified and recorded in
Complexity Tracking rather than silently accepted.

### Post-Phase-1 re-evaluation

Re-checked after `data-model.md` and `contracts/` were written. No new violation
introduced by the design. Two points confirmed rather than assumed:

- The view model carries **no database identifiers into the rendered document**
  (SC-005) — ids exist on the Pydantic models for logging and linking only, and the
  template never emits them.
- The severity/colour parity test (research.md §6) keeps FR-013 enforceable rather
  than aspirational, which is what moved Principle IV from "probably fine" to PASS.

## Project Structure

### Documentation (this feature)

```text
specs/005-pdf-report-export/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── report-api.md    # Phase 1 output — endpoint contract
├── checklists/
│   └── requirements.md  # Pre-existing spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── Dockerfile                              # MODIFIED: add fonts-noto-core, fonts-noto-color-emoji
├── requirements.txt                        # MODIFIED: add jinja2 as a direct dependency
└── src/
    ├── main.py                             # MODIFIED: include report_router; browser startup/shutdown
    ├── api/
    │   └── report.py                       # NEW: GET /api/v1/report/{analysis_id}/pdf
    ├── schemas/
    │   └── report.py                       # NEW: ReportDocument view models (Pydantic v2)
    ├── services/
    │   ├── report_service.py               # NEW: DB row -> ReportDocument (pure, browser-free)
    │   ├── report_mappings.py              # NEW: severity collapse, colours, category labels
    │   └── pdf_renderer.py                 # NEW: Chromium lifecycle + HTML -> PDF
    └── templates/report/
        ├── report.html.j2                  # NEW: cover, scores, findings, recs, optimizer
        └── report.css                      # NEW: print CSS, inlined at render time

backend/tests/
├── contract/test_report_api_contract.py    # NEW: status codes, headers, filename
├── test_report_service.py                  # NEW: view-model build + every spec edge case
├── test_report_mappings.py                 # NEW: severity/colour parity with the frontend
└── integration/test_report_pdf.py          # NEW: real Chromium render, text extraction

frontend/src/
├── app/runs/[runId]/page.tsx               # MODIFIED: mount the export button
├── features/analysis/components/
│   └── ExportReportButton.tsx              # NEW: busy state, error surface, download
└── features/analysis/hooks/
    └── useExportReport.ts                  # NEW: blob fetch + Content-Disposition filename
```

**Structure Decision**: Web application layout, matching the repo exactly as it
stands. The feature follows the established backend seam already used twice
(`analysis`, `optimization`): a router in `src/api/`, Pydantic schemas in
`src/schemas/`, orchestration in `src/services/`. The one new directory is
`src/templates/report/`, which has no existing home.

The deliberate structural choice is splitting `report_service.py` (pure, no browser,
no I/O beyond the DB read) from `pdf_renderer.py` (browser only, no domain
knowledge). Every edge case in the spec is a `report_service` unit test running in
milliseconds; only a handful of tests pay for a real Chromium launch.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Principle V** — new endpoint with no authentication dependency | FR-022 requires the export be "subject to the same authorization as viewing the analysis itself". `GET /api/v1/analyze/{id}` and `GET /api/v1/optimize/{id}` currently have **no** auth dependency, so matching them literally satisfies FR-022. The export exposes exactly the data those already-open endpoints return — it adds no new data exposure, only a new format. | Adding `Depends(get_current_user)` to this endpoint alone was rejected: `src/middleware/auth.py` issues JWTs but there is **no user table and no login endpoint** in the backend, so requiring a token would make the feature unreachable from the running app while leaving the identical data readable via the existing JSON endpoints. That is theatre, not security. **Remediation**: authentication belongs in a repo-wide spec covering all read endpoints together — flagged for the user, out of scope here. |
| **Principle VII** — p95 < 8s instead of the default p95 < 300ms for reads | Rendering a paginated document in a real browser cannot meet a 300ms budget. The constitution requires an SLO stated per feature in its plan; this states one explicitly rather than quietly missing the default. 8s keeps SC-004's 10s user promise intact even when one export is queued behind another. | A precomputed/cached PDF was rejected: the spec's Assumptions state the report is generated on demand and not persisted, and caching would add invalidation logic for no current need (Principle VIII). |
| **Jinja2 as a new direct dependency** | The report needs autoescaped templating; autoescape is the primary control against rendering untrusted markup as live HTML (research.md §7). | f-strings / `string.Template` were rejected — no autoescaping, making an injection defect a matter of when, not if. |

## Notes carried forward to `/speckit-tasks`

1. **Clarification was skipped.** `/speckit-clarify` ran but ended with 0 of 5
   questions answered. Those five ambiguities are resolved as documented decisions in
   research.md §9, each cheap to reverse. The two most worth a second look are the
   synchronous delivery model (§5) and the no-auth deviation above.
2. **The severity parity test is load-bearing**, not a nicety. It is the only thing
   that keeps FR-013 true after the next frontend change.
3. **The Dockerfile font change must land before the non-Latin/emoji edge case can
   pass** — it is a prerequisite task, not a polish task.
