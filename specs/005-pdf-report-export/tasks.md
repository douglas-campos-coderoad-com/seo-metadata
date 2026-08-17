---

description: "Task list for PDF Report Export"
---

# Tasks: PDF Report Export

**Input**: Design documents from `/specs/005-pdf-report-export/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/report-api.md](contracts/report-api.md), [quickstart.md](quickstart.md)

**Tests**: Test tasks ARE included. Constitution Principle III ("Test-First With
Meaningful Coverage") is non-negotiable for this repo, so tests are written from the
spec's acceptance scenarios and must fail before the implementation that satisfies
them. This overrides the template's default of treating tests as optional.

**Organization**: Tasks are grouped by user story so each can be implemented, tested,
and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1 / US2 / US3, mapping to the spec's user stories
- Exact file paths are given in every task

## Slice boundaries used here

The three stories share one Jinja2 template, so the boundary between them is
**what the document contains**, not which files it touches:

- **US1 (P1)** — a complete, correct, plain document. Every score, finding, and
  recommendation, with both markup blocks. Readable and hand-off-ready; not yet pretty.
- **US2 (P2)** — the optional optimizer section on top of that document.
- **US3 (P3)** — the presentation layer: cover page, score visualisation, severity
  colours, and running page footers.

`report.html.j2` is touched by all three phases sequentially. This is called out in
Dependencies rather than papered over with false `[P]` markers.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Runtime prerequisites. Chromium itself needs no work — `backend/Dockerfile`
already installs it for the ingestion path (research.md §1).

- [X] T001 [P] Add `jinja2==3.1.4` to `backend/requirements.txt` under a new "Templating" heading — it is currently only a transitive dependency, and this feature imports it directly (research.md §2)
- [X] T002 [P] Add `fonts-noto-core` and `fonts-noto-color-emoji` to the existing `apt-get install` layer in `backend/Dockerfile` so non-Latin text and emoji render as glyphs rather than tofu (research.md §3)
- [X] T003 Rebuild the API image and verify coverage: `docker compose build api` then `docker compose exec api fc-list | grep -ci noto` returns a non-zero count, and `docker compose exec api python -c "from playwright.async_api import async_playwright; print('ok')"` succeeds (depends on T001, T002)
- [X] T004 [P] Add `REPORT_RENDER_CONCURRENCY` (default `2`) and `REPORT_MAX_CODE_CHARS` (default `20000`) to the `api.environment` block in `docker-compose.yml`, and document both in `backend/.env.example` (research.md §4, §10)
- [X] T005 [P] Create the directory `backend/src/templates/report/` with a `.gitkeep` so the template package exists before any template task runs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The mapping tables, view models, and browser lifecycle every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Write the severity/colour parity test in `backend/tests/test_report_mappings.py`: assert the Python collapse table matches `AnalysisApiService.mapSeverity` (`frontend/src/shared/realtime/AnalysisApiService.ts:398-414`) and the colour values match `frontend/src/styles/globals.css:37-46`. **Must fail** — the module does not exist yet (FR-013, research.md §6)
- [X] T007 Implement `backend/src/services/report_mappings.py` with `SEVERITY_COLLAPSE` (critical/high→critical, medium→medium, low/warning→warning, pass/good→good, else→warning), `SEVERITY_COLORS`, `SEVERITY_LABELS`, `CATEGORY_LABELS` for the analyser's nine categories, a fixed `CATEGORY_ORDER`, and the `SEO_RUBRIC` / `GEO_RUBRIC` max-score tables from `graph_nodes.py:299-318`. Makes T006 pass
- [X] T008 [P] Create Pydantic v2 view models in `backend/src/schemas/report.py`: `Severity`, `ScoreDimension`, `HtmlChange`, `ReportRecommendation`, `ReportFinding`, `FindingGroup`, `ReportDocument` — every field optional at parse time with the fallbacks in data-model.md, since the source JSON is LLM-produced
- [X] T009 [P] Implement `backend/src/services/pdf_renderer.py`: lazily-launched shared Chromium, per-render `BrowserContext`, `asyncio.Semaphore(REPORT_RENDER_CONCURRENCY)`, **JavaScript disabled**, a route handler that **aborts every outbound request**, content loaded via `set_content()`, and an autoescaping Jinja2 `Environment` pointed at `src/templates/report/` (research.md §4, §7)
- [X] T010 Wire browser startup and shutdown into the existing `@app.on_event` handlers in `backend/src/main.py`, re-launching if the browser is found disconnected so a Chromium crash degrades to a slow export rather than a dead endpoint
- [X] T011 Add `expose_headers=['Content-Disposition']` to the `CORSMiddleware` config in `backend/src/main.py` — without it the browser hides the header and every download silently falls back to a generic filename, breaking FR-017
- [X] T012 Run `docker compose exec api mypy src/services/report_mappings.py src/schemas/report.py src/services/pdf_renderer.py --strict` and confirm T006 now passes

**Checkpoint**: Mapping tables, view models, and a working renderer exist. User story work can begin.

---

## Phase 3: User Story 1 - Export a completed analysis as a PDF (Priority: P1) 🎯 MVP

**Goal**: A user viewing a completed analysis exports a valid PDF containing the three
scores, both breakdowns, the GEO visibility narrative, every finding, and every
recommendation with its full current and suggested markup.

**Independent Test**: Run an analysis, request the export, and verify the file is a
valid PDF whose content matches the stored analysis — every finding and recommendation
present, no placeholder or empty section (quickstart.md V1, V2, V5).

### Tests for User Story 1 ⚠️

> Write these FIRST and confirm they FAIL before implementing.

- [X] T013 [P] [US1] Contract test in `backend/tests/contract/test_report_api_contract.py`: 200 returns `application/pdf` with a `%PDF` magic prefix and a `Content-Disposition` matching `seo-report_{slug}_{YYYY-MM-DD}.pdf`; 404 for an unknown id; 409 for a `pending`/`running`/`failed` analysis; both errors return JSON `{"detail": ...}` and never PDF bytes (contracts/report-api.md, FR-016, FR-021)
- [X] T014 [P] [US1] Unit tests in `backend/tests/test_report_service.py` for `build_report_document`: all scores and breakdowns mapped, recommendations joined to findings by `finding_id`, orphan recommendations retained, findings grouped by category in fixed order, `total_findings` correct (SC-002, FR-003…FR-009)
- [X] T015 [US1] Edge-case unit tests appended to `backend/tests/test_report_service.py`: no findings at all; findings/recommendations stored as **plain strings** (as `analysis_service.py:94` writes); `analysis` column `NULL` on a completed row; missing `html_change`; empty `current_html` with `change_type: add`; unknown severity and category values; markup exceeding `REPORT_MAX_CODE_CHARS` (FR-018, SC-008, spec Edge Cases). Same file as T014, so not parallel with it
- [X] T016 [P] [US1] Integration test in `backend/tests/integration/test_report_pdf.py` rendering with real Chromium: every stored finding title and recommendation action appears in the extracted text (SC-002); text is extractable, proving it is not rasterised (C3); two renders produce identical extracted text (SC-007, C5)

### Implementation for User Story 1

- [X] T017 [US1] Implement the normalisation helpers in `backend/src/services/report_service.py`: coerce a plain-string finding or recommendation into its structured form, coerce `analysis=None` to `{}`, and fall back on unknown severity/category rather than raising (FR-018, data-model.md derivation step 1)
- [X] T018 [US1] Implement `build_report_document(analysis, ingested_url, optimization=None)` in `backend/src/services/report_service.py` as a **pure, I/O-free function** applying index → join → group → score → truncate (data-model.md derivation steps 2-6). Purity is what keeps T015's edge cases fast and browser-free
- [X] T019 [US1] Implement the filename helper in `backend/src/services/report_service.py`: host+path lowercased, non-alphanumerics collapsed to `-`, trimmed to 80 chars, suffixed with the **analysis** `created_at` date, emitting both ASCII `filename` and RFC 5987 `filename*` (FR-017)
- [X] T020 [US1] Implement the async loader in `backend/src/services/report_service.py` reading `UrlAnalysis` joined to `IngestedUrl`, raising distinct domain errors for "not found" and "not completed" so the router can map them to 404 and 409 separately (FR-016)
- [X] T021 [P] [US1] Create `backend/src/templates/report/report.html.j2`: scores and both breakdowns, the GEO visibility narrative, findings under per-category headings, each recommendation with action/rationale/priority/effort and its resolved finding reference, and **two distinct `<pre><code>` blocks** for current and suggested markup. An absent element is labelled as an addition; a truncated block states the omitted character count. No `|safe` filter anywhere (FR-005…FR-009, FR-012, FR-018, research.md §7)
- [X] T022 [P] [US1] Create `backend/src/templates/report/report.css` with `@page` sizing and margins, and `overflow-wrap: anywhere` + `white-space: pre-wrap` on code blocks so long unbroken markup wraps instead of clipping (FR-019). All CSS inlined at render time — no external stylesheet or font URL (FR-020)
- [X] T023 [US1] Implement `GET /api/v1/report/{analysis_id}/pdf` in `backend/src/api/report.py` using `APIRouter(prefix='/api/v1', tags=['report'])`, `response_class=Response` with `media_type='application/pdf'`, and an explicit `responses={...}` block documenting the binary 200 plus 404/409 — a binary endpoint that advertises JSON is a broken contract under Principle I. Buffer the full document before responding so a failure can never surface as a partial file (FR-021)
- [X] T024 [US1] Register `report_router` in `backend/src/main.py` (import plus `app.include_router`), following the existing router registration block
- [X] T025 [US1] Add structured logging in `backend/src/api/report.py` and `report_service.py` — render duration, finding count, and outcome — reusing the request id from `RequestIDMiddleware`. Log the underlying exception on failure but return only a generic message to the client, never a stack trace (Principle VI, SC-005)
- [X] T026 [P] [US1] Implement `frontend/src/features/analysis/hooks/useExportReport.ts`: `fetch` → `response.blob()`, filename parsed from `Content-Disposition` with a `seo-report.pdf` fallback, `{detail}` surfaced on a non-2xx, and `{ exportReport, isExporting, error }` returned. Does not extend the shared `ApiClient`, whose every method ends in `response.json()` (contracts/report-api.md)
- [X] T027 [P] [US1] Implement `frontend/src/features/analysis/components/ExportReportButton.tsx`: busy state while in flight, disabled during export to prevent duplicate renders from a double-click, error message surfaced, accessible name and announced busy state (SC-004, Principle VII / WCAG 2.2 AA)
- [X] T028 [US1] Mount `ExportReportButton` in `frontend/src/app/runs/[runId]/page.tsx`, enabled only when the run is complete and `run.backendAnalysisId` is set — the page already gates on that field at line 32
- [X] T029 [P] [US1] Frontend test `frontend/src/features/analysis/components/ExportReportButton.test.tsx`: disabled without `backendAnalysisId`, busy state during export, backend `detail` shown on failure, no download triggered on error
- [X] T030 [US1] Run T013-T016 and T029 and confirm all pass
- [X] T031 [US1] Walk quickstart.md scenarios V1, V2 and V5 manually against the running stack

**Checkpoint**: A complete, correct, client-readable PDF exports end to end from the UI. **This is the MVP** — shippable on its own.

---

## Phase 4: User Story 2 - Include the optimizer results when they exist (Priority: P2)

**Goal**: When an optimization exists for the analysis, the PDF additionally carries the
optimized HTML, the enriched JSON-LD, and the before/after score comparison. When none
exists, the report is complete and betrays no missing section.

**Independent Test**: Export one analysis with an optimization and one without; the first
contains the optimizer sections, the second contains no heading, empty block, or dangling
reference to them (quickstart.md V4, SC-006).

### Tests for User Story 2 ⚠️

- [X] T032 [P] [US2] Unit tests in `backend/tests/test_report_service.py`: a `completed` optimization produces an `OptimizerSection`; a `failed`, `pending`, or absent one produces `optimizer=None` — a failed optimization must be indistinguishable from none at all (FR-010, US2 scenario 3)
- [X] T033 [P] [US2] Integration test in `backend/tests/integration/test_report_pdf.py`: the with-optimizer render contains the optimized markup and both scores; the without-optimizer render's extracted text contains **no** case-insensitive match for "optimiz" (SC-006)

### Implementation for User Story 2

- [X] T034 [US2] Add the `OptimizerSection` model to `backend/src/schemas/report.py` and the optional `optimizer` field on `ReportDocument` (data-model.md)
- [X] T035 [US2] Extend the loader in `backend/src/services/report_service.py` to read the latest `UrlOptimization` for the analysis, **gate strictly on `status == 'completed'`**, pretty-print `optimized_json_ld` with `indent=2, ensure_ascii=False`, and apply the same `REPORT_MAX_CODE_CHARS` truncation to `optimized_html`
- [X] T036 [US2] Add the conditional optimizer block to `backend/src/templates/report/report.html.j2` — wrapped so that when `optimizer` is `None` no heading, spacing, or section number is emitted at all (FR-010, US2 scenario 2)
- [X] T037 [US2] Run T032, T033 and the full existing suite; walk quickstart.md V4

**Checkpoint**: Both US1 and US2 work; the report is complete with and without an optimization.

---

## Phase 5: User Story 3 - Present the report to a client (Priority: P3)

**Goal**: The document becomes presentable to a non-technical stakeholder — a cover page,
scores shown visually, severity colour-coded consistently with the application, and running
page footers.

**Independent Test**: Generate a report and confirm the cover page, score visualisation,
severity colours, and page footers are present, and that the colours match the app's
(quickstart.md V3).

### Tests for User Story 3 ⚠️

- [X] T038 [P] [US3] Integration tests in `backend/tests/integration/test_report_pdf.py`: page 1 contains the URL, the analysis date, and the overall score (FR-011); every page after the cover carries a page number and the URL (FR-015); the rendered HTML carries the exact `SEVERITY_COLORS` values from `report_mappings.py` (FR-013); each category group renders a heading (FR-012)

### Implementation for User Story 3

- [X] T039 [US3] Add the cover-page block to `backend/src/templates/report/report.html.j2` with the analysed URL, the analysis date, and the overall score — and no branding, per research.md §9 decision 5 (FR-011)
- [X] T040 [US3] Add score visualisation to `report.html.j2` and `report.css` driven by `ScoreDimension.ratio`, so each dimension reads as a proportion rather than a bare number. A `None` score renders "Not scored", never `0` (FR-014, data-model.md)
- [X] T041 [US3] Apply `SEVERITY_COLORS` from `report_mappings.py` to finding severity badges in `report.html.j2` / `report.css`. Colours come from the shared table only — never hard-coded in the template, or the parity test in T006 stops protecting FR-013
- [X] T042 [US3] Style the per-category group headings in `report.css` so findings read as labelled sections rather than one flat list (FR-012)
- [X] T043 [US3] Add `footerTemplate` with `pageNumber`/`totalPages` and the analysed URL to the `page.pdf()` call in `backend/src/services/pdf_renderer.py`, with `displayHeaderFooter` enabled and the cover page excluded from the footer (FR-015)
- [X] T044 [US3] Run T038 and the full suite; walk quickstart.md V3 and confirm the four colour values against `frontend/src/styles/globals.css`

**Checkpoint**: All three user stories are independently functional; the report is client-ready.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T045 [P] Security verification: `grep -rn '|safe' backend/src/templates/report/` returns nothing; confirm JavaScript is disabled and every outbound request is aborted during a render; confirm no database id or stack trace appears in the extracted text (research.md §7, SC-005, C4, C7)
- [X] T046 [P] Concurrency validation per quickstart.md V8: five simultaneous exports all produce valid, equivalent documents with no interleaving (spec Edge Cases, C6)
- [X] T047 [P] Performance validation: measure p95 for a typical analysis (≤40 findings) against the declared **p95 < 8s** budget, excluding cold browser launch (plan.md Complexity Tracking, SC-004)
- [X] T048 [P] Edge-case sweep per quickstart.md V9 against rendered output: non-Latin characters and emoji render as glyphs, a 5,000-char unbroken token wraps inside the margin, oversized markup shows its truncation note (SC-008)
- [X] T049 [P] Offline validation per quickstart.md V7: the PDF renders fully with no network access (FR-020)
- [X] T050 [P] Determinism validation per quickstart.md V6 — compare extracted text, not bytes (SC-007)
- [X] T051 Run `docker compose exec api mypy src --strict`, `ruff check src`, and `black --check src` clean
- [ ] T052 [P] Run `cd frontend && npm run type-check && npm run lint` clean — **PARTIAL**: `npm run type-check` (`tsc --noEmit`) passes clean. `npm run lint` cannot run: the repo has **no ESLint configuration file** (`eslint . --ext .ts,.tsx` exits with "ESLint couldn't find a configuration file"). Pre-existing repo-wide gap, not introduced by this feature; fixing it means adding an ESLint config for the whole frontend, which is outside this spec's scope
- [X] T053 Confirm `pytest --cov=src --cov-report=term-missing` meets the ≥80% floor on changed code (Principle III)
- [X] T054 [P] Regenerate/verify the OpenAPI schema exposes the binary 200 plus the 404 and 409 responses at `/openapi.json` (Principle I, contracts/report-api.md)
- [X] T055 [P] Document the two new environment variables and the export endpoint in `backend/README.md`
- [X] T056 Run the full quickstart.md validation end to end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T003 depends on T001 and T002
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on Foundational. Extends US1's template, so in practice runs after US1
- **US3 (Phase 5)**: depends on Foundational. Restyles US1's template, so runs after US1
- **Polish (Phase 6)**: depends on every story you intend to ship

### The honest constraint on story parallelism

The template says stories can proceed in parallel once Foundational is done. **Here they
largely cannot**, and pretending otherwise would cause merge pain:

- `report.html.j2` is edited by T021 (US1), T036 (US2), and T039-T042 (US3)
- `report_service.py` is edited by T017-T020 (US1) and T035 (US2)
- `test_report_pdf.py` is edited by T016 (US1), T033 (US2), and T038 (US3)

US2 and US3 *are* independent of each other — they touch different regions of the
template and different modules otherwise — so those two can run concurrently once US1
lands. US1 must go first because it creates the files the other two modify.

### Within each story

- Tests are written and **must fail** before the implementation that satisfies them
- Mappings and view models before services; services before endpoints; backend before frontend wiring

---

## Parallel Opportunities

**Phase 1**: T001, T002, T004, T005 all run together; T003 follows.

**Phase 2**: T006 first (it must fail), then T008 and T009 run alongside T007.

**Phase 3 tests** — three different files:

```bash
Task: "Contract test in backend/tests/contract/test_report_api_contract.py"      # T013
Task: "Service unit tests in backend/tests/test_report_service.py"               # T014
Task: "Render integration test in backend/tests/integration/test_report_pdf.py"  # T016
```

**Phase 3 implementation** — template and CSS are separate files, as are the two
frontend files:

```bash
Task: "Create backend/src/templates/report/report.html.j2"                       # T021
Task: "Create backend/src/templates/report/report.css"                           # T022
Task: "Implement frontend/src/features/analysis/hooks/useExportReport.ts"        # T026
Task: "Implement frontend/src/features/analysis/components/ExportReportButton.tsx" # T027
```

**Phase 6**: T045-T050, T052, T054 and T055 are all independent verification passes.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup — the Dockerfile font change is a **prerequisite, not polish**; the
   non-Latin/emoji edge case cannot pass without it
2. Phase 2 Foundational
3. Phase 3 US1
4. **STOP and VALIDATE**: quickstart.md V1, V2, V5
5. Ship — a correct, complete, hand-off-ready PDF is the whole of the spec's stated value

### Incremental Delivery

1. Setup + Foundational → renderer ready
2. US1 → validate → ship (MVP)
3. US2 → validate → ship (optimizer output included)
4. US3 → validate → ship (client-presentable)

### Parallel Team Strategy

One developer through Setup, Foundational, and US1. Once US1 lands, a second developer
can take US3 (presentation) while the first takes US2 (optimizer) — they touch different
regions of the template and are otherwise independent.

---

## Notes

- **T006/T007 (the parity test) is load-bearing.** It is the only thing keeping FR-013
  true after the next frontend change. If a future task hard-codes a colour in the
  template, that test stops protecting anything — see T041.
- **No migration, no new table.** The report is composed on demand (spec Assumptions).
- **The auth deviation is deliberate.** No task adds an auth dependency to this endpoint:
  FR-022 requires parity with `GET /api/v1/analyze/{id}`, which currently has none. See
  plan.md Complexity Tracking — the fix belongs in a repo-wide spec.
- **Clarification was skipped**; five decisions in research.md §9 (notably synchronous
  delivery and the 20,000-char truncation cap) are assumptions these tasks encode. Each
  is cheap to reverse.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
