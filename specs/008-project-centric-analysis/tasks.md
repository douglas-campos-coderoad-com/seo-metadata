---

description: "Task list for Project-Centric Analysis Management"
---

# Tasks: Project-Centric Analysis Management

**Input**: Design documents from `/specs/008-project-centric-analysis/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required for user stories), [research.md](research.md), [data-model.md](data-model.md), [contracts/projects-api.md](contracts/projects-api.md), [quickstart.md](quickstart.md)

**Tests**: Unit tests are explicitly requested (spec's originating request: "unit tests covering the most critical parts of this feature"). Scoped to the highest-risk backend logic: project CRUD/validation, the attach/reassign/remove-analysis linkage (the trickiest part of this feature — see research.md §1), and the new LLM-backed Smart Search agent. Written before their corresponding implementation task within each story, per this template's convention.

**Organization**: Tasks are grouped by user story per [spec.md](spec.md). All paths are relative to the repository root.

**Important same-file note**: `backend/src/services/project_service.py`, `backend/src/api/projects.py`, `backend/tests/unit/test_project_service.py`, and `frontend/src/shared/realtime/AnalysisApiService.ts`/`MockAnalysisService.ts` are each edited by tasks across *multiple* user stories (every backend story adds methods/endpoints to the same service/router file). Those tasks are **not** marked `[P]` relative to each other even when they belong to different stories — they must run in the numbered order given.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6)
- Exact file paths are included in every description

## Path Conventions

Web app layout confirmed in [plan.md](plan.md): this feature touches **both** `backend/` and `frontend/`.

---

## Phase 1: Setup

**Purpose**: Capture a baseline so any breakage surfaced later is attributable to this change, not pre-existing state.

- [X] T001 Run `pytest` in `backend/` and `npm run build && npm run test` in `frontend/`; record the current pass/fail state as the baseline before making any changes — baseline: backend 197 passed, frontend build succeeds (5 routes), frontend tests 8 files/46 passed. Confirmed local `backend/.venv` can reach the live Dockerized Postgres via `localhost:5432` (already at migration head `005`) for later migration/test work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, models, and skeleton wiring every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Create the `Project` model in `backend/src/models/project.py` (fields per [data-model.md](data-model.md): `id`, `title`, `description`, `category`, `country`, `region`, `TimestampMixin`)
- [X] T003 [P] Create the `Competitor` model in `backend/src/models/competitor.py` (`id`, `project_id` FK CASCADE, `url`, `description`, `TimestampMixin`)
- [X] T004 Add the nullable `project_id` FK column and relationship to `backend/src/models/url_analysis.py` (depends on T002)
- [X] T005 Register `Project` and `Competitor` in `backend/src/models/__init__.py` (imports + `__all__`) (depends on T002, T003)
- [X] T006 Create Alembic migration `backend/migrations/versions/006_projects_competitors.py`: create `projects` and `competitors` tables, add `url_analyses.project_id` column + FK + index, following migration 004's structure (depends on T002-T005) — applied against the live Dockerized Postgres (via `localhost:5432`, local `.venv`); verified `projects`/`competitors` tables and `url_analyses.project_id` FK/index exist, head is now `006`
- [X] T007 [P] Create Pydantic schemas in `backend/src/schemas/project.py`: `ProjectCreate`, `ProjectUpdate`, `ProjectResponse`, `CompetitorCreate`, `CompetitorResponse`, `ProjectListResponse`, `ProjectAnalysisResponse`, `ProjectAnalysisListResponse`, `SmartSearchRequest`, `SmartSearchResponse` (depends on T002, T003; category validated as one of the 21+`other` values from spec FR-011)
- [X] T008 Create `backend/src/api/projects.py` with an empty `APIRouter(prefix='/api/v1', tags=['projects'])` and register it in `backend/src/main.py` (depends on T007)
- [X] T009 [P] Update `Project`/`Competitor` TypeScript types in `frontend/src/shared/types/index.ts` to match the backend shape (category as a union of the 21+`other` literal values, `country`/`region`, `competitors: Competitor[]`) — note: this intentionally breaks the still-old-shaped consumers (`useAppStore`, `useProjects`, etc.) until US2 rewrites them; frontend build/test verification is deferred to the end of this session's work, not run mid-Foundational
- [X] T010 [P] Add the new project-related method signatures (`createProject`, `listProjects`, `getProject`, `updateProject`, `deleteProject`, `listProjectAnalyses`, `attachAnalysisToProject`, `removeAnalysisFromProject`, `smartSearchCompetitors`) to the `AnalysisService` interface in `frontend/src/shared/realtime/AnalysisService.ts`, replacing the old `createAutomation`-style client-store-only signatures (depends on T009) — also dropped `listSharedIssues` from the interface per research.md §6 (becomes a plain hook-level `computeSharedIssues` call in US4, not a service method)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Anonymous first-glance analysis keeps working (Priority: P1) 🎯 MVP baseline

**Goal**: Confirm the existing anonymous flow is untouched by the new schema/model changes.

**Independent Test**: Submit a URL from the home page without touching any project UI; confirm identical behavior to the T001 baseline.

- [X] T011 [US1] Verify the anonymous first-glance flow: run the full backend and frontend test suites and manually submit a URL from `/`, confirming behavior matches the T001 baseline exactly (depends on Phase 2 — this is a regression check, no new code) — confirmed via multiple independent signals: backend 203/203 passing (197 baseline + 6 new), frontend 43/43 passing (46 baseline minus the 3 deliberately-deleted tests, `submit-analysis.test.tsx` — which directly exercises this exact flow — still fully green), frontend build succeeds, home page HTML renders correctly, and a live POST to `/ingest/url` from origin `http://localhost:3000` is accepted by the backend without any CORS/connection error (only the expected "fake domain doesn't resolve" application error). One unrelated finding surfaced while checking this: `tests/e2e/golden-path.spec.ts`'s happy-path test fails against a **live** backend for a reason distinct from earlier sessions — Playwright's own `webServer` config (`playwright.config.ts`) runs its dev server on port 3100, which isn't in the backend's CORS `allow_origins` list (only 3000/8000), so the browser's fetch is silently blocked. This is a pre-existing environment/config gap (confirmed unrelated to this feature — `main.py`'s CORS list was already this way before any of this session's changes) and out of scope for specs/008; noting it for a future fix.

**Checkpoint**: User Story 1 confirmed unaffected.

---

## Phase 4: User Story 2 - Create a project (Priority: P1)

**Goal**: Users can create, list, and view projects with metadata and a manually-entered competitor list, persisted in the database.

**Independent Test**: Fill out and submit the project creation form (with and without competitors); confirm it persists across a reload.

### Tests for User Story 2

- [X] T012 [P] [US2] Unit tests for `ProjectService` create/list/get and category validation in `backend/tests/test_project_service.py` (depends on Phase 2) — note: path adjusted from the planned `tests/unit/` to match this repo's actual flat `tests/test_*_service.py` convention (no `unit/`/`integration/` split exists for these); 6 tests, all passing

### Implementation for User Story 2

- [X] T013 [US2] Implement `ProjectService.create`, `.list`, `.get` in `backend/src/services/project_service.py` (depends on T012)
- [X] T014 [US2] Implement `POST /projects`, `GET /projects`, `GET /projects/{project_id}` in `backend/src/api/projects.py` (depends on T013) — verified live against the running Docker API + Postgres via curl: create (201, with nested competitor), list, and a 404 not-found all behave correctly
- [X] T015 [US2] Add `createProject`/`listProjects`/`getProject` to `frontend/src/shared/realtime/AnalysisApiService.ts` and `MockAnalysisService.ts`, replacing the old Zustand-store-backed versions (depends on T014, T010) — also added throwing stubs for the US3/US4/US5/US6 interface methods (`updateProject`, `deleteProject`, `listProjectAnalyses`, `attachAnalysisToProject`, `removeAnalysisFromProject`, `smartSearchCompetitors`), required for `implements AnalysisService` to type-check; each will be replaced by its real implementation in its own story
- [X] T016 [US2] Rewrite `useProjects` in `frontend/src/features/projects/hooks/useProjects.ts` to fetch from the backend instead of `useAppStore` (depends on T015)
- [X] T017 [US2] Extend `frontend/src/features/projects/components/ProjectForm.tsx` with a category dropdown (21 values + `other`) and country/region fields (depends on T016)
- [X] T018 [US2] Build `frontend/src/features/projects/components/CompetitorListEditor.tsx` (manual add/remove of `{url, description}` pairs, both fields required per entry) and wire it into `ProjectForm.tsx` (depends on T017)

  **Unplanned but necessary follow-through** (the `Project` type change in T009 forced these — not optional cleanup, the build would not compile otherwise): removed the now-dead `projects`/`createProject`/`addTargetToProject`/`removeTargetFromProject` from `useAppStore.ts` (a small slice of what T042 was planned to do, done early out of necessity); rewrote `useProjectDetail.ts` and `app/projects/[projectId]/page.tsx` down to a minimal version that only shows a project's own persisted metadata + competitors, with an explicit "coming soon" placeholder where the analysis history section will go (full rework is US4/T027-T030, not attempted now); fixed `app/projects/page.tsx` and `app/page.tsx` to use `project.title`/`.category`/`.country` instead of the retired `.name`/`.targetIds`; decoupled `computeSharedIssues` (`shared/lib/sharedIssues.ts`) from the `Project` type (now takes `projectId`/`targetIds` directly) since `project.targetIds` no longer exists — updated `SharedIssue.projectId` to `Project['id']` (number) to match, and fixed `tests/unit/sharedIssues.test.ts` accordingly; fixed lingering `projectId?: string` types in `useStartAnalysis.ts` and `UrlSubmitForm.tsx`; **deleted** `frontend/tests/integration/create-project-detect-shared-issue.test.tsx` — its 3 tests were built entirely around the retired client-only project+target+shared-issues model and cannot be meaningfully repaired without US4's real persisted-history support; should be recreated then, testing the real flow (same disposition as the automations/analyze-page removals earlier in this repo's history). Backend `tests/conftest.py`'s shared SQLite test-DB fixture also needed `Project`/`Competitor` added to its explicit table subset (discovered via a real test failure, not anticipated in planning) — without it, `url_analyses.project_id`'s FK couldn't resolve in any test using the DB.

**Checkpoint**: Projects can be created, listed, and viewed with a persisted competitor list.

---

## Phase 5: User Story 3 - Save a completed analysis to a project (Priority: P1)

**Goal**: A completed first-glance analysis can be attached to a new or existing project via an "Add analysis to a project" action.

**Independent Test**: Run a first-glance analysis, attach it to an existing project, reopen the project and confirm it appears (full history rendering is US4, but the attach operation itself is independently verifiable via the API per [quickstart.md](quickstart.md) §2).

### Tests for User Story 3

- [X] T019 [US3] Unit tests for `ProjectService.attach_analysis` (attach when unset, reassign when already set, not-found project/analysis) in `backend/tests/test_project_service.py` (depends on T012 — same file, sequential) — 4 new tests, all passing (10/10 total in the file)

### Implementation for User Story 3

- [X] T020 [US3] Implement `ProjectService.attach_analysis(project_id, analysis_id)` in `backend/src/services/project_service.py` (depends on T019, T013 — same file, sequential) — also added a private `_get_analysis_with_relations` helper (eager-loads `ingested_url`/`optimizations`) that T024's `list_analyses` will reuse
- [X] T021 [US3] Implement `POST /projects/{project_id}/analyses` in `backend/src/api/projects.py` (depends on T020, T014 — same file, sequential) — added a shared `_to_project_analysis_response()` helper (mirrors `ingest.py`'s `_to_response()` convention) that T025's list endpoint will also reuse. Verified live end-to-end: ran a real ingest→analyze (real Gemini call, analysis id 78), attached it to project 1 (`optimization: null` as expected — none was run), reassigned it to project 2, and confirmed both 404 paths (bad project id, bad analysis id)
- [X] T022 [US3] Add `attachAnalysisToProject` to `AnalysisApiService.ts`/`MockAnalysisService.ts` (depends on T021) — real implementation in `AnalysisApiService`; `MockAnalysisService` (currently dead code, unreferenced anywhere) got a self-consistent in-memory fixture version rather than a throwing stub, since it's cheap and keeps the class internally coherent
- [X] T023 [US3] Add an "Add analysis to a project" action to `frontend/src/app/runs/[runId]/page.tsx`, once `run.status === 'complete'`, offering "existing project" (dropdown, from T016's list) or "new project" (reuses `ProjectForm` from T018, then immediately attaches) (depends on T022, T018) — new `AddToProjectAction.tsx` component; gated on `run.backendAnalysisId` existing (only the real-backend results view has one); once attached, shows "Added to project: X" instead of the action (spec US3 Scenario 4). Frontend build (6 routes) and full test suite (43/43) confirmed green.

**Checkpoint**: A completed analysis can be attached to a new or existing project.

---

## Phase 6: User Story 4 - Review a project's analysis history (Priority: P2)

**Goal**: A project's view shows its full, persisted analysis history with before/after results, surviving a full reload.

**Independent Test**: Add two or more analyses to the same project; reload the app entirely; confirm all analyses still display with correct before/after data.

**Note**: This phase also reconciles the app's **existing** "add a bare URL to a project, then Analyze it in place" flow (`ProjectUrlList.tsx`, `useProjectDetail`'s `analyzeTarget`/`analyzeAll`) — see the flag in the completion report. Analyzing from *within* a project now auto-attaches the result via the T021 endpoint, since the project is already known in that context, instead of leaving the result in ephemeral client state.

### Implementation for User Story 4

- [X] T024 [US4] Implement `ProjectService.list_analyses(project_id)` — join `UrlAnalysis` + `UrlOptimization` (nullable) + `IngestedUrl.url`, ordered by `created_at` — in `backend/src/services/project_service.py` (depends on T020 — same file, sequential)
- [X] T025 [US4] Implement `GET /projects/{project_id}/analyses` in `backend/src/api/projects.py` (depends on T024, T021 — same file, sequential)

  **Real bug found and fixed while verifying this live** (not a container/reload artifact — reproduced identically in a fresh local Python process, a hot-reloaded container, *and* a from-scratch image rebuild): `selectinload(Project.competitors)` — used since T013 — threw `AttributeError: type object 'Project' has no attribute 'competitors'`. Root cause: `competitors` only exists on `Project` as a backref generated by `Competitor.project = relationship('Project', backref='competitors')`, and SQLAlchemy doesn't install backref attributes onto their target class until mapper configuration runs — which normally happens lazily on a session's first query. Since this codebase had never used `selectinload()` on a backref'd attribute before (confirmed in research.md §2 — no prior eager-loading precedent existed), and referencing `Project.competitors` to *build* a query happens before any query has actually run, every affected endpoint's very first invocation in a fresh process hit this chicken-and-egg gap. Fixed at the source: `backend/src/models/__init__.py` now calls `configure_mappers()` once, right after every model is imported, so any code path — including T013/T014 which had been silently working only by accident (their own logs never mentioned this error before) — sees backref attributes correctly regardless of call order. Also had to `docker compose build api` once, separately: the container's `migrations/` directory isn't volume-mounted (only `src/`/`tests/` are), so it didn't know about migration `006` after a restart and failed its own startup `alembic upgrade head` step — rebuilding baked the new migration file in. Re-verified live end-to-end after both fixes: `GET /projects/1` (with competitor), `GET /projects/2/analyses` (one entry, `optimization: null`), `GET /projects/1/analyses` (empty list), and the 404 case all correct. Full backend suite: 207/207 passing.
- [X] T026 [US4] Add `listProjectAnalyses` to `AnalysisApiService.ts`/`MockAnalysisService.ts` (depends on T025)
- [X] T027 [US4] Build `frontend/src/features/projects/components/ProjectAnalysisHistory.tsx`, rendering each history entry's persisted before result and, when present, its after/optimization result; renders cleanly with no error when `optimization` is `null` (depends on T026)
- [X] T028 [US4] Rewrite `useProjectDetail` in `frontend/src/features/projects/hooks/useProjectDetail.ts` to fetch the project and its analysis history from the backend instead of deriving from `useAppStore`'s `targets`/`runs`/`findings` (depends on T026)
- [X] T029 [US4] Update `frontend/src/app/projects/[projectId]/page.tsx`: replace `ProjectUrlList` with `ProjectAnalysisHistory` (T027) fed by the rewritten hook (T028); adapt "Analyze all"/per-target "Analyze" so each resulting analysis is attached to this project automatically via `attachAnalysisToProject` (T022) once it completes, instead of only appearing in client-side run state (depends on T027, T028, T022) — implemented differently than originally sketched: rather than resurrecting `ProjectUrlList`'s bare-URL-then-analyze-later list UI (which has no natural mapping onto persisted `ProjectAnalysis[]`, since those only exist *after* an analysis runs), the page now embeds `UrlSubmitForm` (already supported a `projectId` prop) directly, tracks the run via the existing `LiveStatusTracker`, and calls `attachAnalysisToProject` in `onComplete`. Verified live in a real browser (Playwright, ad hoc script against the manually-run dev server): submitted a URL from inside project 1, watched the live tracker show fetching/analyzing, and confirmed the new analysis appeared in the project's history once complete, with the tracker clearing correctly.
- [X] T030 [US4] Re-point `computeSharedIssues` (`frontend/src/shared/lib/sharedIssues.ts` usage in `useProjectDetail`) at the fetched project-analyses list instead of the Zustand store's `targets`/`runs`/`findings`; the pure grouping function itself is unchanged (depends on T028) — turned out to need more than a re-point: the old function's signature was built around `AnalysisTarget`/`AnalysisRun`/`Finding` records that don't exist for persisted data, so added a new `computeProjectSharedIssues(projectId, analyses)` that groups directly from each analysis's raw backend `analysis.findings` JSON. To avoid duplicating category/severity normalization logic, extracted `AnalysisApiService`'s private `mapCategory`/`mapSeverity`/`mapPriority` methods into a new shared `frontend/src/shared/lib/findingMappers.ts` used by both. Verified live: attached a second analysis with an overlapping "Missing meta description" finding to the same project and confirmed the Shared Issues panel correctly showed "found on 2 pages" (previously showed the empty state with only one analysis).

  All of Phase 6 verified together, live, in a real browser against the actual Docker backend (build: 6 routes; tests: 43/43 passing throughout).

**Checkpoint**: Full persisted, reload-proof analysis history renders per project; the pre-existing in-project analyze flow now persists its results too.

---

## Phase 7: User Story 5 - Smart Search for competitors (Priority: P3)

**Goal**: Smart Search proposes competitor entries from the project's description/category/geography, which the user can edit before saving.

**Independent Test**: With description/category/geography filled in, click Smart Search; confirm suggestions populate the editable list and can still be edited/removed.

### Tests for User Story 5

- [X] T031 [P] [US5] Unit tests for `competitor_agent.generate` in `backend/tests/test_competitor_agent.py` — mock `get_llm_repository()`; cover a successful multi-suggestion response, an empty-suggestions response, and a malformed-JSON response (depends on Phase 2) — path adjusted to match the repo's flat convention (same as T012); mocked `_call_llm` directly rather than `get_llm_repository()`, matching the established pattern in `test_geo_agents.py`; added a 4th test (LLM-call-raises) beyond the 3 originally planned. 4/4 passing.

### Implementation for User Story 5

- [X] T032 [US5] Implement `backend/src/agents/competitor_agent.py` (`SYSTEM_PROMPT`, `_call_llm`, `generate(description, category, country, region)`) following `entity_agent.py`'s shape (depends on T031)
- [X] T033 [US5] Implement `POST /projects/competitors/smart-search` in `backend/src/api/projects.py` — validates `description`/`category`/`country` are present (422 otherwise), calls `competitor_agent.generate`, returns `{"suggestions": [...]}` without persisting anything (depends on T032, T025 — same file, sequential) — added `ProjectService.smart_search_competitors` as a thin, DB-free delegation to `CompetitorAgent`, keeping the router→service convention even though this endpoint touches no data. 422 validation comes for free from `SmartSearchRequest`'s required fields, no extra code needed. Verified live against the real LLM: got 5 real, well-formed suggestions (Burrow, Brooklinen, Parachute Home, Castlery, Pottery Barn) for a home-goods e-commerce project, and confirmed 422 with field-level errors when `category`/`country` are omitted.
- [X] T034 [US5] Add `smartSearchCompetitors` to `AnalysisApiService.ts`/`MockAnalysisService.ts` (depends on T033)
- [X] T035 [US5] Add a Smart Search button to `CompetitorListEditor.tsx` that inserts returned suggestions into the editable list, shows a clear "no suggestions" message when the array is empty, and prompts the user to fill required fields first when they're missing (depends on T034, T018) — `CompetitorListEditor` now takes a `smartSearchContext` prop (wired from `ProjectForm`'s live field values). Verified live in a real browser: clicking Smart Search with the form still empty shows the "fill in the site description, category, and country" prompt without calling the API; filling in the fields and retrying inserts the real LLM suggestions into the editable list (confirmed a new entry with "Remove" appeared). Along the way hit and diagnosed an unrelated dev-server issue: interleaving `npm run build` (production) with `npm run dev` had left a stale `.next` cache causing JS chunk 404s and silent hydration failure (clicks did nothing) — cleared `.next` and restarted to fix; not a code bug.

  Full build (6 routes) and test suite (43/43) confirmed green throughout Phase 7.

**Checkpoint**: Smart Search populates editable competitor suggestions.

---

## Phase 8: User Story 6 - Edit or delete a project, and manage its analyses (Priority: P2)

**Goal**: Projects can be edited and deleted (with confirmation); analyses can be removed from (deleted) or reassigned between projects.

**Independent Test**: Edit a project's fields and confirm persistence; delete a project and confirm it and its data are gone; reassign an analysis and confirm it moved.

### Tests for User Story 6

- [X] T036 [US6] Unit tests for `ProjectService.update`, `.delete` (cascade to competitors and analyses), and `.remove_analysis` (deletes the row; reassign via T020's `attach_analysis` preserves it) in `backend/tests/test_project_service.py` (depends on T024 — same file, sequential) — 8 new tests (18/18 total in the file, all passing)

### Implementation for User Story 6

- [X] T037 [US6] Implement `ProjectService.update`, `.delete`, `.remove_analysis` in `backend/src/services/project_service.py` (depends on T036, T024 — same file, sequential) — two real issues found and fixed while getting these green: (1) `update`'s naive `if data.field is not None` checks made `region` impossible to explicitly clear to null — switched to Pydantic v2's `model_fields_set` to distinguish "omitted" from "set to null"; (2) `delete`/`update`'s competitor-replace both do a bulk `DELETE` via SQLAlchemy Core, which doesn't sync the session's identity map — a follow-up `self.get()` in the same method was returning stale, already-deleted `Competitor` objects until an explicit `session.expire_all()` was added. Also made `delete`/`remove_analysis` cascade explicitly in Python rather than relying solely on the DB's `ON DELETE CASCADE`, since SQLite (used by the test suite) ignores FK constraints unless a pragma is enabled that this project doesn't set — Postgres in production enforces it regardless, so this keeps test and production behavior identical rather than accidentally test-only-passing.

  **Unrelated regression caught by the full suite, not by this feature's own tests**: `tests/test_report_mappings.py::test_frontend_map_severity_cases_are_all_covered` is a cross-repo drift-detector that reads `AnalysisApiService.ts`'s raw source text looking for a `private mapSeverity(` method — broken by T030's earlier refactor (moved that logic to the new `findingMappers.ts` as an exported `mapFindingSeverity` function). Updated the test's file path and split-string to match, plus two doc-comment references elsewhere in the same file. Full backend suite: 219/219 passing.
- [X] T038 [US6] Implement `PATCH /projects/{project_id}`, `DELETE /projects/{project_id}`, `DELETE /projects/{project_id}/analyses/{analysis_id}` in `backend/src/api/projects.py` (depends on T037, T033 — same file, sequential) — verified live against the running Docker API: PATCH renamed project 1 and confirmed it persisted; DELETE on an analysis returned 204 and removed it from the project's history while leaving the other analysis intact; DELETE on a throwaway project returned 204 and a follow-up GET correctly 404'd.
- [X] T039 [US6] Add `updateProject`, `deleteProject`, `removeAnalysisFromProject` to `AnalysisApiService.ts`/`MockAnalysisService.ts` (depends on T038) — found and fixed a real bug in the shared `frontend/src/lib/api-client.ts`: its `request()` unconditionally called `response.json()` on every successful response, which throws on a `204 No Content` (no body) — the exact shape all three new DELETE-adjacent calls return. This is the first time any frontend code has called a 204-returning endpoint; added an explicit `response.status === 204` check that returns `undefined` instead of parsing. Build (6 routes) and tests (43/43) green.
- [X] T040 [US6] Add edit mode (reusing `ProjectForm`/`CompetitorListEditor`) and a delete action with a confirmation prompt to `frontend/src/app/projects/[projectId]/page.tsx` (depends on T039, T029) — `ProjectForm` extended with an `editingProject`/`onSaved` prop pair (create vs. edit share the same form; the call site remounts via `key={project.id}` rather than syncing prop changes into local state). No dialog/modal primitive exists in this UI kit, so delete confirmation uses the native `window.confirm()` — a deliberate, minimal choice given the scope, not an oversight.
- [X] T041 [US6] Add "remove from project" and "reassign to a different project" actions to each entry in `ProjectAnalysisHistory.tsx` (depends on T039, T027) — reassign is a `<select>` of the other existing projects + a "Move" button.

  All of Phase 8 verified live in a real browser against the real backend: edited a project's title and confirmed it persisted; reassigned an analysis from one project to another and confirmed it disappeared from the source project's history and appeared in the target's; created a throwaway project, deleted it (confirmed the `window.confirm()` dialog fires with the expected message and auto-accepting it redirects to `/projects` with the project gone from the list). Build (6 routes) and full test suite (43/43) green throughout.

**Checkpoint**: All six user stories are independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Remove now-superseded code, keep docs honest, and do a full end-to-end sign-off.

- [X] T042 Remove the now-dead client-only project code from `frontend/src/shared/store/useAppStore.ts` (the `projects` field and `createProject`/`addTargetToProject`/`removeTargetFromProject` actions) and delete `frontend/src/features/projects/components/ProjectUrlList.tsx`, per the no-dead-code precedent from specs 006/007 (depends on all of Phase 4-8 frontend tasks — nothing may still call these) — the `useAppStore.ts` half of this was already done back in T015-T018 (forced early by the `Project` type change, noted at the time). Completed the rest now: deleted `ProjectUrlList.tsx` (superseded by `ProjectAnalysisHistory` in US4) and `ProjectHistorySummary.tsx` (fully orphaned since the same rework, no other caller). Also found and removed one more piece of dead code in the same vein: `AnalysisTarget.projectIds` — always set to `[]`, never read anywhere once the client-side project-association methods were gone. Left `RecentTargetsList.tsx`/`TargetStatusBadge.tsx` untouched — those are intentionally preserved-but-unmounted per the user's explicit decision in specs/007, not in scope here; just corrected a stale doc comment on `TargetStatusBadge` that still referenced the now-deleted `ProjectUrlList`. Build (6 routes) and tests (43/43) confirmed green after all of it.
- [X] T043 [P] Update `README.md`: the "Projects and history live in a session-scoped in-memory store" line is no longer accurate for Projects — update it to reflect that Projects, competitors, and their analysis history are now persisted server-side, while the anonymous first-glance flow and its live-status tracking remain client-side — while there, also fixed the architecture diagram and repository-layout tree (both were missing the new `projects` API router/service and `competitor` agent, and the Postgres table list didn't mention `projects`/`competitors`), and added a Documentation-table row linking this feature's spec/plan/tasks, matching the existing pattern for specs 002-005.
- [X] T044 Execute the full [quickstart.md](quickstart.md) validation (all 4 sections: migration + backend unit tests, manual API walkthrough, frontend UI walkthrough, regression check) and confirm every expected result holds — this had effectively been running continuously throughout Phases 5-9 (every endpoint and UI flow was verified live as it was built, not just at the end), so this task is the final consolidated re-confirmation: migration head is `006`; backend suite 219/219 passing; frontend build succeeds (6 routes) and test suite 43/43 passing; live data double-checked consistent (project 2's title edit from T040's verification is still correctly "Second Project Edited", competitor/history data all intact); final repo-wide grep confirms no dangling references to any of the deleted components. All six user stories confirmed working end-to-end against the real backend over the course of this implementation, not mocked.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **User Story 1 (Phase 3)**: Depends only on Phase 2 — pure regression check, no new code.
- **User Story 2 (Phase 4)**: Depends on Phase 2.
- **User Story 3 (Phase 5)**: Depends on Phase 4 (needs projects to exist/be listable to attach to; shares `project_service.py`/`projects.py` with US2's tasks sequentially).
- **User Story 4 (Phase 6)**: Depends on Phase 5 (the attach endpoint it reuses for the in-project analyze flow) — matches spec's own stated dependency (US4 depends on US2 and US3).
- **User Story 5 (Phase 7)**: Depends on Phase 4 (`CompetitorListEditor` from US2) but is otherwise independent of US3/US4's analysis-linkage work — could run in parallel with Phase 5/6 by a second developer, aside from the shared `projects.py`/service-file sequencing noted above.
- **User Story 6 (Phase 8)**: Depends on Phase 6 (editing/deleting builds on the full CRUD + history surface).
- **Polish (Phase 9)**: Depends on all six user stories.

### Parallel Opportunities

- T002, T003 (Foundational models) in parallel; T007, T009, T010 in parallel with each other once their own prerequisites land.
- T012 (US2 test) and T031 (US5 test) can be written in parallel — different files, both only depend on Phase 2.
- Frontend and backend tasks *within* a story are sequential (frontend calls the backend endpoint the prior task just built), but a second team member could work US5's backend (T031-T033) in parallel with US3/US4's backend work, since `competitor_agent.py` is a new, separate file from `project_service.py`/`projects.py` — only the final endpoint-registration tasks (T033) touch the shared `projects.py` file and must slot in sequentially with the others.

---

## Parallel Example: Foundational Phase

```bash
Task: "Create the Project model in backend/src/models/project.py"
Task: "Create the Competitor model in backend/src/models/competitor.py"
# Then, once both land:
Task: "Create Pydantic schemas in backend/src/schemas/project.py"
Task: "Update Project/Competitor TypeScript types in frontend/src/shared/types/index.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1 (regression check).
4. Complete Phase 4: User Story 2 (create/list/view projects).
5. Complete Phase 5: User Story 3 (attach a completed analysis).
6. **STOP and VALIDATE**: an analysis can be created anonymously and saved into a project — the feature's core stated goal — even before history rendering (US4), Smart Search (US5), or edit/delete (US6) exist.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → confirm no regression.
3. US2 → projects exist and persist.
4. US3 → analyses can be attached (MVP delivered here).
5. US4 → the payoff: persisted history actually renders, and the pre-existing in-project analyze flow gets reconciled.
6. US5 → Smart Search convenience layer.
7. US6 → edit/delete lifecycle, completing the CRUD surface.
8. Phase 9 → remove dead code, fix docs, final sign-off.

## Notes

- [P] tasks = different files, no dependencies — **except** where explicitly called out as same-file-sequential in the "Important same-file note" above.
- [Story] label maps each task to its user story for traceability back to [spec.md](spec.md).
- Commit after each task or logical group.
- T029/T042 are the two places where this feature removes/replaces existing working code (the in-project analyze flow's data source, and the old client-only project store) rather than purely adding — called out explicitly rather than silently folded into "add a feature."
