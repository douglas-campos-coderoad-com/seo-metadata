---

description: "Task list for Remove Analyze Page"
---

# Tasks: Remove Analyze Page

**Input**: Design documents from `/specs/007-remove-analyze-page/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required for user stories), [research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)

**Tests**: `tests/e2e/golden-path.spec.ts` is edited (not deleted) — it exercises functionality that survives this removal (spec FR-004), just via a different route.

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

- [X] T001 Run `npm run build` and `npm run test` in `frontend/` and record the current pass/fail state as the baseline before making any changes — baseline: build succeeds (7 routes incl. `/analyze`), test suite green (8 files, 46 tests)

---

## Phase 2: Foundational

**None required.** This is a subtractive change with no shared prerequisite beyond the Setup baseline. Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - No dedicated Analyze entry point remains (Priority: P1) 🎯 MVP

**Goal**: Remove the "Analyze" nav link and the standalone `/analyze` route.

**Independent Test**: Load the app; confirm no "Analyze" nav link exists; visit the former `/analyze` URL directly and confirm it resolves the same way the app already handles other retired routes (e.g., `/automations`). (See [quickstart.md](quickstart.md) §3.)

### Implementation for User Story 1

- [X] T002 [P] [US1] Remove the `{ href: '/analyze', label: 'Analyze' }` entry from `NAV_LINKS` in `frontend/src/shared/components/ResponsiveNav.tsx`
- [X] T003 [P] [US1] Delete `frontend/src/app/analyze/page.tsx` and remove the resulting empty `frontend/src/app/analyze/` directory

**Checkpoint**: User Story 1 is fully functional and testable independently — run the manual walkthrough in [quickstart.md](quickstart.md) §3.

---

## Phase 4: User Story 2 - Submitting a URL still works exactly as before (Priority: P1)

**Goal**: Prove the core submit-a-URL journey is unaffected, by re-pointing its only route-specific test coverage at the surviving page.

**Independent Test**: From the home page, submit a URL and confirm live progress + results-page redirect; submit an invalid URL and confirm the inline error with no navigation. (See [quickstart.md](quickstart.md) §4.)

### Implementation for User Story 2

- [X] T004 [US2] In `frontend/tests/e2e/golden-path.spec.ts`, change both `page.goto('/analyze')` calls to `page.goto('/')`, and change the invalid-URL test's `expect(page).toHaveURL(/\/analyze$/)` assertion to expect staying on `/` instead (depends on T003 — the old route no longer exists to test against). Also fixed an unrelated pre-existing bug found while validating: the placeholder locator (`'https://example.com/page'`) didn't match `UrlSubmitForm`'s actual hardcoded placeholder text on either the old or new route — updated to match reality.
- [X] T005 [US2] Run `npm run test` and `npx playwright test tests/e2e/golden-path.spec.ts` in `frontend/`; confirm the Vitest suite is unaffected and both Playwright tests pass against `/` (depends on T004) — Vitest: 8 files/46 tests green, unaffected. Playwright: the invalid-URL test passes fully. The happy-path test reaches `/`, finds the form, and submits correctly (proving the route change works), but its live-progress/results assertions can't complete because they require a running FastAPI backend, which this sandbox doesn't have — a pre-existing environment dependency unrelated to this change (confirmed: "Failed to fetch" at the network layer, same as it would be on the old `/analyze` route).

**Checkpoint**: User Stories 1 AND 2 both work independently — the submit-URL journey is still fully covered end-to-end, just via `/`.

---

## Phase 5: User Story 3 - No leftover references to the removed page (Priority: P2)

**Goal**: Confirm nothing discoverable still points at the removed page, and update the one stale doc line.

**Independent Test**: Search the frontend codebase/docs for references to the removed page and confirm none remain (the backend's unrelated `/analyze/{id}` endpoint and the "Frontend concepts" capability bullet are expected, allowed hits — see [research.md](research.md) §1, §5); run the build and confirm it passes. (See [quickstart.md](quickstart.md) §1.)

### Implementation for User Story 3

- [X] T006 [P] [US3] In `README.md`, change the app-tree line `app/{analyze,projects,targets,runs}` to `app/{projects,targets,runs}`
- [X] T007 [US3] Run the search in [quickstart.md](quickstart.md) §1 across `frontend/src/shared/components`, `frontend/src/app`, and `README.md`; confirm only the expected, allowed hits remain (depends on T002, T003, T004, T006) — confirmed: 0 hits for the removed route; only the unrelated backend API/capability-description mentions remain
- [X] T008 [US3] Run `npm run build` in `frontend/`; confirm it succeeds and the route list no longer includes `/analyze` (depends on T007) — confirmed: build succeeds, 5 routes (down from 6), no `/analyze`

**Checkpoint**: All user stories are independently functional; zero unintended references to the removed page remain.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final end-to-end confirmation across all three stories together.

- [X] T009 Execute the full manual walkthrough in [quickstart.md](quickstart.md) (sections 1-4: build/grep check, automated tests, UI walkthrough, core-workflow regression) and confirm every expected result holds — confirmed live against the dev server: nav `<ul>` contains only the Projects link (no `href="/analyze"` anywhere), `/analyze` returns 404 identical to an arbitrary unknown route, home page's own "Analyze" submit button (unrelated to the nav) is unaffected. Section 4 (core workflow) covered by the passing Playwright invalid-URL test and manual form-fill verification in T005; full live-progress-to-results confirmation blocked by the same missing-backend environment limitation noted in T005.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Empty for this feature.
- **User Story 1 (Phase 3)**: Depends only on Setup.
- **User Story 2 (Phase 4)**: T004 depends on T003 (can't point a test at a route until you know the old one is gone and the new target is settled); T005 depends on T004.
- **User Story 3 (Phase 5)**: T007's grep sweep depends on every prior edit (T002, T003, T004, T006) being in place, so it reflects the final state; T008 depends on T007.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002 and T003 (all of US1) touch different files — run in parallel.
- T006 (README) has no dependency on T002-T005 and can be done any time before T007.

---

## Parallel Example: User Story 1

```bash
# Both User Story 1 tasks touch different files — launch together:
Task: "Remove the Analyze nav entry in frontend/src/shared/components/ResponsiveNav.tsx"
Task: "Delete frontend/src/app/analyze/page.tsx and its now-empty directory"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1 (nav + route gone).
3. **STOP and VALIDATE**: run the quickstart §3 manual walkthrough.
4. This alone satisfies the most visible part of the request.

### Incremental Delivery

1. Setup → User Story 1 → validate (MVP: no reachable Analyze page).
2. Add User Story 2 → validate via updated e2e run (submit-URL journey still fully covered).
3. Add User Story 3 → validate via grep audit + build + docs review.
4. Phase 6 Polish ties all four quickstart sections together as a final sign-off.

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability back to [spec.md](spec.md).
- `RecentTargetsList.tsx` is intentionally untouched (spec FR-007) — no task targets it; it becomes unused as a direct, intended side effect of T003.
- Commit after each task or logical group.
- Historical documents under `specs/003-seo-analyzer-frontend/**` are intentionally left untouched — no task targets them.
