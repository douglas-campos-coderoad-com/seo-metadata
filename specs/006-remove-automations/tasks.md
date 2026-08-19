---

description: "Task list for Remove Automations Feature"
---

# Tasks: Remove Automations Feature

**Input**: Design documents from `/specs/006-remove-automations/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required for user stories), [research.md](research.md), [data-model.md](data-model.md), [contracts/analysis-service-interface.md](contracts/analysis-service-interface.md), [quickstart.md](quickstart.md)

**Tests**: No new tests are added — this is a subtractive feature. Existing tests that exist *only* to exercise the removed feature are deleted; tests that incidentally reference automation fields are edited to drop those fields.

**Organization**: Tasks are grouped by user story per [spec.md](spec.md). All paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Path Conventions

Web app layout confirmed in [plan.md](plan.md): this feature touches `frontend/` only. `backend/` is not modified.

---

## Phase 1: Setup

**Purpose**: Capture a baseline so any breakage surfaced later is attributable to this change, not pre-existing state.

- [X] T001 Run `npm run build` and `npm run test` in `frontend/` and record the current pass/fail state as the baseline before making any changes — baseline: build succeeds (7 routes incl. `/automations`), test suite green (10 files, 57 tests)

---

## Phase 2: Foundational

**Purpose**: Blocking prerequisites for all user stories.

**None required.** This is a subtractive change: User Story 1 (removing app-layer entry points) has no unmet prerequisite beyond the Setup baseline. Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - No automations entry points remain in the app (Priority: P1) 🎯 MVP

**Goal**: Remove every way a user can reach automations functionality — nav link, route, and embedded UI on the history and project-detail pages — without yet touching the underlying shared types/store/service code (which still compiles standalone).

**Independent Test**: Load the app; confirm no "Automations" nav link exists; visit the former `/automations` URL directly and confirm it resolves as a standard not-found page; open a target's history page and a project's detail page and confirm no scheduling/recurrence/"trigger now" UI is present. (See [quickstart.md](quickstart.md) §3.)

### Implementation for User Story 1

- [X] T002 [P] [US1] Remove the `{ href: '/automations', label: 'Automations' }` nav entry from `frontend/src/shared/components/ResponsiveNav.tsx`
- [X] T003 [P] [US1] Delete `frontend/src/app/automations/page.tsx` and remove the resulting empty `frontend/src/app/automations/` directory
- [X] T004 [P] [US1] In `frontend/src/app/targets/[targetId]/history/page.tsx`, remove the `useAutomations`, `ScheduleForm`, and `AutomationList` imports, the `handleCreateAutomation` handler, the `Recurrence` type import, and all JSX rendering the schedule form / automation list
- [X] T005 [P] [US1] In `frontend/src/app/projects/[projectId]/page.tsx`, remove the sentence "Automations are managed per URL — open a URL's history above to schedule one."

**Checkpoint**: User Story 1 is fully functional and testable independently — run the manual walkthrough in [quickstart.md](quickstart.md) §3. `features/automations/**`, the shared types, the store slice, and the service methods still exist but are now unreferenced from the app layer; the build stays green.

---

## Phase 4: User Story 2 - Analysis and project workflows are unaffected (Priority: P2)

**Goal**: Remove the automations module and every shared-layer trace of it (store slice, types, service interface/implementations) so the app carries no automation code at all, while manual analysis and project management keep working exactly as before.

**Note on task placement**: `frontend/tests/integration/schedule-automation.test.tsx` and `frontend/tests/unit/recurrence.test.ts` (User Story 3's FR-008) are deleted in *this* phase, not Phase 5 — they import directly from `features/automations/**`, so they must be removed in the same step as the module (T006) or the build breaks between checkpoints.

**Independent Test**: Submit a URL for manual analysis and confirm it completes normally; create a project, add the analyzed target, and confirm the project detail page renders correctly; revisit the target's history page and confirm the run appears with correct status/scores and no console errors. (See [quickstart.md](quickstart.md) §4.)

### Implementation for User Story 2

- [X] T006 [US2] Delete the entire `frontend/src/features/automations/` module: `components/AutomationList.tsx`, `components/RecurrenceSummary.tsx`, `components/ScheduleForm.tsx`, `hooks/useAutomations.ts`, `lib/recurrence.ts`, then remove the emptied directories (depends on T002-T005: those were its last app-layer consumers)
- [X] T007 [P] [US2] Delete `frontend/tests/integration/schedule-automation.test.tsx` (depends on T006 — imports the deleted module)
- [X] T008 [P] [US2] Delete `frontend/tests/unit/recurrence.test.ts` (depends on T006 — imports the deleted module)
- [X] T009 [US2] Remove the `automations: Record<string, Automation>` field and the `upsertAutomation`, `setAutomationActive`, `deleteAutomation` actions from `frontend/src/shared/store/useAppStore.ts` (depends on T006)
- [X] T010 [US2] Remove the `Automation`, `Recurrence`, `RecurrenceFrequency`, `RunTrigger` types and the `AnalysisRun.triggeredBy` field from `frontend/src/shared/types/index.ts` (depends on T006, T009; see [data-model.md](data-model.md))
- [X] T011 [P] [US2] Remove `createAutomation`, `setAutomationActive`, `deleteAutomation` from the `AnalysisService` interface and drop the now-unused `Automation`/`Recurrence` import in `frontend/src/shared/realtime/AnalysisService.ts` (depends on T010; see [contracts/analysis-service-interface.md](contracts/analysis-service-interface.md))
- [X] T012 [P] [US2] Remove `createAutomation`, `setAutomationActive`, `deleteAutomation`, the `computeNextRunAt`/`formatRecurrence` import, and the `'automation'`-valued `triggeredBy` assignment from `frontend/src/shared/realtime/AnalysisApiService.ts` (depends on T010)
- [X] T013 [P] [US2] Remove `createAutomation`, `setAutomationActive`, `deleteAutomation`, `triggerAutomationNow`, the `computeNextRunAt`/`formatRecurrence` import, and the `triggeredBy` parameter on `createAndScheduleRun` in `frontend/src/shared/realtime/MockAnalysisService.ts` (depends on T010)
- [X] T014 [P] [US2] Drop the `automations: {}` field from the `useAppStore.setState(...)` fixture reset in `frontend/tests/integration/submit-analysis.test.tsx` (depends on T009)
- [X] T015 [P] [US2] Drop the `automations: {}` field from the store-reset call and the `triggeredBy` field from `AnalysisRun` fixtures in `frontend/tests/integration/create-project-detect-shared-issue.test.tsx` (depends on T009, T010)
- [X] T016 [P] [US2] Drop the `triggeredBy` field from the `AnalysisRun` fixture in `frontend/tests/unit/sharedIssues.test.ts` (depends on T010)

**Checkpoint**: User Stories 1 AND 2 both work independently. Run `npm run build` and `npm run test` in `frontend/` — both pass with zero automation-related code remaining outside `README.md`.

---

## Phase 5: User Story 3 - Codebase has no leftover automation artifacts (Priority: P3)

**Goal**: Confirm nothing automation-related remains discoverable in active source or docs, and update currently-active documentation to stop describing automations as a capability.

**Independent Test**: Search the frontend codebase for automation-related identifiers and confirm none remain (outside historical `specs/003-seo-analyzer-frontend/**`, which is exempt per spec Assumptions); run the frontend build/test suite and confirm it passes. (See [quickstart.md](quickstart.md) §1-2.)

### Implementation for User Story 3

- [X] T017 [P] [US3] In `README.md`, remove the "**Automations** — recurring re-checks of a target." bullet, the `automations` entries in both ASCII directory-tree blocks, and the "schedule-automation" flow mention
- [X] T018 [US3] Run a case-insensitive, recursive search for `automation` across `frontend/src`, `frontend/tests`, and `README.md`; confirm zero matches (depends on T002-T017) — confirmed: 0 matches
- [X] T019 [US3] Run `npm run build` and `npm run test` in `frontend/`; confirm both pass with no automation-related failures or warnings (depends on T018) — confirmed: 8 test files/46 tests pass, build succeeds (6 routes, `/automations` gone)

**Checkpoint**: All user stories are independently functional; zero automation references remain in active code or docs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final end-to-end confirmation across all three stories together.

- [X] T020 Execute the full manual walkthrough in [quickstart.md](quickstart.md) (sections 1-4: build/grep check, automated tests, UI walkthrough, core-workflow regression) and confirm every expected result holds — confirmed live against the dev server: `/` has no Automations nav link, `/automations` returns 404 (identical to an arbitrary unknown route), `/projects` has no automation text

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Empty for this feature — no gate before User Story 1.
- **User Story 1 (Phase 3)**: Depends only on Setup. Fully self-contained; the build stays green with the automations module/types/store/service code still present but unreferenced.
- **User Story 2 (Phase 4)**: Depends on User Story 1 (T002-T005) having removed the app-layer imports of `features/automations/**` — T006 (module deletion) would otherwise break the still-importing pages. Internally, T006 → T007/T008 (dedicated tests) and T006 → T009 (store) → T010 (types) → T011/T012/T013 (service layer) → T014/T015/T016 (incidental test fixtures) form a strict dependency chain because each step removes something the next step's target file still references.
- **User Story 3 (Phase 5)**: Depends on User Story 2 being complete (nothing left to grep away or verify otherwise).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002, T003, T004, T005 (all of US1) touch different files with no cross-dependencies — run in parallel.
- Within US2: T007 and T008 can run together once T006 completes; T011, T012, T013 can run together once T010 completes; T014, T015, T016 can run together once T009/T010 complete.
- T017 (README) has no dependency on T018/T019 ordering beyond being included in the final grep sweep — can be done any time after T002-T016, in parallel with nothing else in Phase 5 since T018 depends on it.

---

## Parallel Example: User Story 1

```bash
# All four User Story 1 tasks touch different files — launch together:
Task: "Remove the Automations nav entry in frontend/src/shared/components/ResponsiveNav.tsx"
Task: "Delete frontend/src/app/automations/page.tsx and its now-empty directory"
Task: "Remove automation scheduling UI from frontend/src/app/targets/[targetId]/history/page.tsx"
Task: "Remove the automations hint sentence from frontend/src/app/projects/[projectId]/page.tsx"
```

## Parallel Example: User Story 2 (after T006, T009, T010 land)

```bash
# Dedicated tests, once the module they import is gone:
Task: "Delete frontend/tests/integration/schedule-automation.test.tsx"
Task: "Delete frontend/tests/unit/recurrence.test.ts"

# Service layer, once the types they import are gone:
Task: "Clean up frontend/src/shared/realtime/AnalysisService.ts"
Task: "Clean up frontend/src/shared/realtime/AnalysisApiService.ts"
Task: "Clean up frontend/src/shared/realtime/MockAnalysisService.ts"

# Incidental test fixtures, once store/types are clean:
Task: "Fix fixture in frontend/tests/integration/submit-analysis.test.tsx"
Task: "Fix fixtures in frontend/tests/integration/create-project-detect-shared-issue.test.tsx"
Task: "Fix fixture in frontend/tests/unit/sharedIssues.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1 (nav, route, embedded UI gone).
3. **STOP and VALIDATE**: run the quickstart §3 manual walkthrough — no automations entry point is reachable from the UI.
4. This alone satisfies the most visible part of the user's request even before the dead code underneath is removed.

### Incremental Delivery

1. Setup → User Story 1 → validate (MVP: no reachable automations UI).
2. Add User Story 2 → validate via build + test suite + regression walkthrough (dead code gone, core workflows intact).
3. Add User Story 3 → validate via repo-wide grep + docs review (fully clean).
4. Phase 6 Polish ties all four quickstart sections together as a final sign-off.

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability back to [spec.md](spec.md).
- Unlike an additive feature, this removal has real cross-file coupling (a type can't be deleted while a file still imports it) — the Dependencies section above documents exactly where that coupling forces sequencing within User Story 2, even though the phase as a whole is still independently testable once complete.
- Commit after each task or logical group.
- Historical documents under `specs/003-seo-analyzer-frontend/**` are intentionally left untouched (see spec.md Assumptions) — no task targets them.
