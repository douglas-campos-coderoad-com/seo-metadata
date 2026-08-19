---

description: "Task list for Project & Analysis UX Improvements"
---

# Tasks: Project & Analysis UX Improvements

**Input**: Design documents from `/specs/009-project-analysis-ux/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/single-analysis-endpoint.md](contracts/single-analysis-endpoint.md), [quickstart.md](quickstart.md)

**Tests**: Included — plan.md's Project Structure explicitly lists test files for the new backend endpoint and for the new Modal/history-view frontend surfaces, so test tasks are part of scope (not the sample-template default).

**Organization**: Tasks are grouped by user story (per spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paths are exact, relative to repository root

## Path Conventions

Web application: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` — per plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: Establish a clean regression baseline before touching any shared or story code

- [x] T001 Confirm a clean baseline on branch `009-project-analysis-ux`: run `cd backend && pytest -q` and `cd frontend && npm run build` and record both as green before any change in this feature (no file changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one piece of shared infrastructure multiple later tasks build on — generalizing the existing findings parser so both the live run path (unchanged behavior) and the new historical view (Phase 4) can share it

**⚠️ CRITICAL**: US2's historical route (Phase 4) depends on this being done first

- [x] T002 Generalize `buildFindings` (currently a private method on `AnalysisApiService`, coupled to a client `runId: string`) into a standalone, exported function that accepts an arbitrary owner-id string, alongside the existing category/severity helpers in `frontend/src/shared/lib/findingMappers.ts`; update the existing live-path call site in `frontend/src/shared/realtime/AnalysisApiService.ts` to use it, preserving identical behavior (research.md §4)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Attach an analysis to a project via a modal (Priority: P1) 🎯 MVP

**Goal**: Replace the cramped inline "attach to a project" content with a proper modal that supports both creating a new project and choosing an existing one; dismissing it attaches nothing.

**Independent Test**: From the results page of a just-completed analysis, trigger "add to a project"; confirm it opens as a modal (not inline page content) offering both "create new" and "choose existing"; confirm dismissing the modal leaves the analysis unattached.

### Tests for User Story 1

- [x] T003 [P] [US1] Unit test for the new `Modal` component — opens/closes on backdrop click and Escape key, calls `onClose` in both cases — in `frontend/tests/unit/modal.test.tsx` (NEW)
- [x] T004 [P] [US1] Unit test confirming dismissing `AddToProjectAction`'s modal (backdrop/Escape/close button) calls neither the create-project nor the attach-analysis API, and discards in-progress form input in `frontend/tests/unit/AddToProjectAction.test.tsx` (NEW or EDIT if a test file already exists)

### Implementation for User Story 1

- [x] T005 [US1] Create a lightweight, dependency-free `Modal` component — fixed-position backdrop, centered panel, closes on backdrop click and Escape, calls an `onClose` prop either way — in `frontend/src/shared/components/ui/modal.tsx` (NEW) (research.md §5)
- [x] T006 [US1] Wrap `AddToProjectAction`'s existing create-new/choose-existing content inside the new `Modal`, triggered by the "add to a project" action, in `frontend/src/features/projects/components/AddToProjectAction.tsx` (depends on T005; the underlying create/choose logic from specs/008 is unchanged, only its presentation moves inside the modal)

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - View and re-run a past analysis from project history (Priority: P1)

**Goal**: Each history entry gets a "View" action opening a fully interactive, re-hydrated results view showing the original before (and after, when present) results, without re-triggering optimization; a fresh analysis from that view creates a new history entry and never touches the original.

**Independent Test**: Open a project with a historical analysis that has both a before and an after (optimized) result; click its view action; confirm the full interactive results view opens showing both; confirm running a new analysis from that view adds a new, separate history entry without altering the one just viewed.

### Tests for User Story 2

- [x] T007 [P] [US2] Backend tests for `GET /projects/{project_id}/analyses/{analysis_id}` — success returns the same shape as a list-endpoint item, 404 when the project doesn't exist, 404 with the same message when the analysis doesn't exist or belongs to a different project — in `backend/tests/test_project_service.py` (EDIT)
- [x] T008 [P] [US2] Frontend test for `useOptimize().loadExisting(analysisId)` — issues a GET (never a POST) to `/optimize/{id}` and populates the same `optimization`/`geoScore` state `run()` populates — in `frontend/tests/unit/useOptimize.test.ts` (NEW or EDIT)
- [x] T009 [P] [US2] Frontend test for `BeforeAfterViewer` rendering immediately with `initialOptimization`/`initialGeoScore` props — starts `optimized = true`, shows no "click to optimize" prompt, triggers no POST — while the existing no-props (live) path is unchanged, in `frontend/tests/unit/BeforeAfterViewer.test.tsx` (NEW or EDIT)
- [x] T010 [P] [US2] Frontend test for the new historical route confirming a fresh analysis submitted from it creates a new project-history entry and leaves the originally-viewed entry byte-for-byte unchanged on re-open (re-run-preserves-history) in `frontend/tests/unit/runsHistoryPage.test.tsx` (NEW)

### Implementation for User Story 2

- [x] T011 [US2] Add `ProjectService.get_analysis(project_id, analysis_id)` — calls the existing `_get_analysis_with_relations(analysis_id)`, raises `ValueError` if the result's `project_id` doesn't match (→ router 404) — in `backend/src/services/project_service.py`
- [x] T012 [US2] Add route `GET /api/v1/projects/{project_id}/analyses/{analysis_id}` delegating to `ProjectService.get_analysis` and reusing the existing `_to_project_analysis_response` helper, in `backend/src/api/projects.py` (depends on T011)
- [x] T013 [P] [US2] Add `getAnalysis(projectId: number, analysisId: number): Promise<ProjectAnalysis>` to the `AnalysisService` interface in `frontend/src/shared/realtime/AnalysisService.ts`
- [x] T014 [US2] Implement `getAnalysis` in `AnalysisApiService` — `GET /projects/{projectId}/analyses/{analysisId}`, mapped through the existing `mapProjectAnalysis` — in `frontend/src/shared/realtime/AnalysisApiService.ts` (depends on T012, T013)
- [x] T015 [P] [US2] Implement matching `getAnalysis` in `MockAnalysisService` against its in-memory fixture store, for dev/test parity, in `frontend/src/shared/realtime/MockAnalysisService.ts` (depends on T013)
- [x] T016 [US2] Add `loadExisting(analysisId)` to `useOptimize` — GET-only via `apiClient.get<OptimizationData>('/optimize/{id}')`, populating the same `optimization`/`geoScore` state as the existing `run()` method, without ever POSTing — in `frontend/src/features/analysis/hooks/useOptimize.ts`
- [x] T017 [US2] Add optional `initialOptimization`/`initialGeoScore` props to `BeforeAfterViewer`; when both are present, start with `optimized = true` and render them immediately with no button and no POST; when omitted, behavior is byte-for-byte unchanged from the existing live-run call site — in `frontend/src/features/analysis/components/BeforeAfterViewer.tsx` (depends on T002) — **implemented as `preloadedOptimization`/`preloadedAfterGeoScore`**, since `initialGeoScore` was already taken by the existing "before" numeric GEO score prop
- [x] T018 [US2] Add a "View" action to each entry in `ProjectAnalysisHistory`, linking to `/runs/history/[projectId]/[analysisId]` for that entry's ids, in `frontend/src/features/projects/components/ProjectAnalysisHistory.tsx`
- [x] T019 [US2] Create the historical results route: on mount, call `getAnalysis(projectId, analysisId)` for the "before" side (via the generalized `buildFindings` from T002) and `useOptimize().loadExisting(analysisId)` for the "after" side when present; render through the same `ScoreSummary`/`FindingsList`/`BeforeAfterViewer` components the live run page uses; support submitting a fresh analysis (URL pre-filled) that attaches to the same project and produces a new history entry via the existing, unchanged analysis pipeline — in `frontend/src/app/runs/history/[projectId]/[analysisId]/page.tsx` (NEW) (depends on T002, T014, T016, T017)

**Checkpoint**: User Stories 1 AND 2 both work independently — this is the P1 MVP scope

---

## Phase 5: User Story 3 - Jump back to the owning project from a historical analysis (Priority: P2)

**Goal**: The historical view shows its owning project's name as a clickable label that navigates to that project's page.

**Independent Test**: Open a historical analysis from a project; confirm the owning project's name is visible and, when clicked, navigates to that project's page.

### Implementation for User Story 3

- [x] T020 [P] [US3] Create `ProjectLabelLink` — a small component rendering a project's name as a link to `/projects/[projectId]` — in `frontend/src/features/projects/components/ProjectLabelLink.tsx` (NEW)
- [x] T021 [US3] Render `ProjectLabelLink` on the historical route page using the project data already available from `getAnalysis`/route params, in `frontend/src/app/runs/history/[projectId]/[analysisId]/page.tsx` (depends on T019 from Phase 4, and T020)

**Checkpoint**: User Stories 1–3 all work independently

---

## Phase 6: User Story 4 - Create a project deliberately from the Projects page (Priority: P2)

**Goal**: The Projects page shows a "Create Project" button by default; the creation form only appears once clicked, unchanged in fields/validation/outcome.

**Independent Test**: Visit the Projects page with no action taken; confirm no creation form is visible by default, only a "Create Project" button; click it and confirm the form appears.

### Implementation for User Story 4

- [x] T022 [US4] Gate the existing `ProjectForm` behind a "Create Project" button with local show/hide state, replacing its current unconditional inline rendering, in `frontend/src/app/projects/page.tsx`

**Checkpoint**: User Stories 1–4 all work independently

---

## Phase 7: User Story 5 - Simplified project view without shared issues (Priority: P3)

**Goal**: The "shared issues" section no longer appears on the project page; the underlying computation and data stay untouched.

**Independent Test**: Open any project's page; confirm no "shared issues" section, heading, or panel appears anywhere in the UI, while every other part of the project view continues to work exactly as before.

### Implementation for User Story 5

- [x] T023 [US5] Remove the `<SharedIssuesPanel>` rendering and its "Shared issues" section from `frontend/src/app/projects/[projectId]/page.tsx`
- [x] T024 [US5] Drop the now-unused `sharedIssues` value (and its `useMemo` call) from `useProjectDetail`'s return value in `frontend/src/features/projects/hooks/useProjectDetail.ts`, leaving `computeProjectSharedIssues`, `frontend/src/shared/lib/sharedIssues.ts`, and `SharedIssuesPanel.tsx` in place and untouched per research.md §6 (depends on T023)

**Checkpoint**: All five user stories are independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Full-suite regression confirmation and end-to-end validation across all five stories

- [x] T025 [P] Run the full backend suite (`cd backend && pytest -q`) and confirm no regressions in specs/008's existing project/analysis functionality
- [x] T026 [P] Run the full frontend suite (`cd frontend && npm run build && npm run test -- --run`) and confirm no regressions
- [x] T027 Execute all five [quickstart.md](quickstart.md) validation scenarios end-to-end against a running dev stack (modal, gated creation, shared-issues absence, view/re-run + label, regression check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS User Story 2 (Phase 4), which relies on the generalized `buildFindings`
- **User Story 1 (Phase 3)**: Depends only on Setup — independent of Phase 2's `buildFindings` work
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2, T002)
- **User Story 3 (Phase 5)**: Depends on User Story 2 (Phase 4, T019) — the historical route must exist before a label can be added to it
- **User Story 4 (Phase 6)**: Depends only on Setup — fully independent of all other stories
- **User Story 5 (Phase 7)**: Depends only on Setup — fully independent of all other stories
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories
- **US2 (P1)**: Depends on Foundational (T002); no dependency on US1
- **US3 (P2)**: Depends on US2 (needs the historical route to attach the label to)
- **US4 (P2)**: No dependency on other stories
- **US5 (P3)**: No dependency on other stories

### Parallel Opportunities

- T003 and T004 (US1 tests) in parallel
- T007–T010 (US2 tests) in parallel with each other
- T013 and T015 (US2, different files) in parallel
- T020 (US3) can be built in parallel with the rest of US2, but T021 must wait on T019
- US1, US4, and US5 can all be implemented in parallel by different people once Setup is done — none depend on Phase 2 or each other
- T025 and T026 (Polish) in parallel

---

## Parallel Example: User Story 2

```bash
# Tests together:
Task: "Backend tests for GET /projects/{project_id}/analyses/{analysis_id} in backend/tests/test_project_service.py"
Task: "Frontend test for useOptimize().loadExisting in frontend/tests/unit/useOptimize.test.ts"
Task: "Frontend test for BeforeAfterViewer initial props in frontend/tests/unit/BeforeAfterViewer.test.tsx"
Task: "Frontend test for re-run-preserves-history in frontend/tests/unit/runsHistoryPage.test.tsx"

# Independent-file implementation together:
Task: "Add getAnalysis to AnalysisService interface in frontend/src/shared/realtime/AnalysisService.ts"
Task: "Implement getAnalysis in MockAnalysisService in frontend/src/shared/realtime/MockAnalysisService.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks US2)
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. **STOP and VALIDATE**: run quickstart.md §1 and §4 against a dev stack
6. Deploy/demo if ready — this is the real payoff of the feature (modal + usable history)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate independently → demo (modal works)
3. US2 → validate independently → demo (history is finally usable) — MVP complete
4. US3 → validate independently → demo (one-click back to project)
5. US4 → validate independently → demo (deliberate project creation)
6. US5 → validate independently → demo (decluttered project page)
7. Polish → full regression + quickstart pass

### Parallel Team Strategy

With multiple developers, after Setup + Foundational:

- Developer A: US1 (modal) → then US4 (gating), both frontend-only and independent
- Developer B: US2 (backend endpoint + historical route) → then US3 (label), since US3 depends on US2
- Developer C: US5 (shared-issues removal), fully independent, can start any time after Setup

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new persisted entities or schema changes anywhere in this feature (FR-007)
- The historical route (T019) is the single highest-risk task — it's the only place three new pieces (T002, T014/T016, T017) come together; validated manually against quickstart.md §4 (and via a live Playwright smoke test) as soon as it was wired up, not only at the end
- Verify tests fail before implementing, where tests are listed ahead of their implementation task
- Stop at any checkpoint to validate a story independently before moving to the next
