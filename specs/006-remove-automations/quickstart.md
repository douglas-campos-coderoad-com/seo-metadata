# Quickstart: Validate Automations Removal

Prerequisites: removal implemented per [plan.md](plan.md) Project Structure (files deleted/edited as listed), dependencies installed (`frontend/` → `npm install` or the project's usual package manager).

## 1. Build and type-check (User Story 3 / FR-004, FR-005, SC-004)

```sh
cd frontend
npm run build
```

**Expected**: Build succeeds with no TypeScript errors about missing `Automation`, `Recurrence`, `RecurrenceFrequency`, `RunTrigger` types, or removed `AnalysisService` methods.

```sh
# Repo-wide check that no active source/doc still mentions the feature
# (historical specs/003-seo-analyzer-frontend/** are expected/allowed hits)
grep -ril "automation" --include="*.ts" --include="*.tsx" frontend/src frontend/tests README.md
```

**Expected**: No output (or only expected non-matches if the tool has no case-insensitive recursive grep available on the platform — use the IDE's project-wide search as a fallback).

## 2. Automated tests (User Story 3 / FR-008, SC-002)

```sh
cd frontend
npm run test
```

**Expected**: All tests pass. `tests/integration/schedule-automation.test.tsx` and `tests/unit/recurrence.test.ts` no longer exist. `submit-analysis.test.tsx`, `create-project-detect-shared-issue.test.tsx`, and `unit/sharedIssues.test.ts` pass with their automation-shaped fixture lines removed.

## 3. Manual UI walkthrough (User Story 1)

1. Run the dev server: `npm run dev`.
2. Load the app's home page. **Expected**: global navigation has no "Automations" link.
3. Navigate directly to the former `/automations` URL. **Expected**: renders the app's standard not-found page — same as any other invalid route (e.g., `/does-not-exist`).
4. Open a target's history page (`/targets/[targetId]/history`). **Expected**: no "Schedule" form, automation list, or recurrence summary anywhere on the page.
5. Open a project's detail page (`/projects/[projectId]`). **Expected**: no sentence referencing automations or where to "schedule one".

## 4. Core workflow regression check (User Story 2 / FR-006, SC-003)

1. From the home page, submit a URL for manual analysis. **Expected**: run progresses through its normal states and completes with results, identical to pre-removal behavior.
2. Create a project, add the analyzed target to it. **Expected**: project detail page renders normally (minus the automations hint line).
3. Revisit the target's history page. **Expected**: the run appears in history with correct status/scores; no errors in the browser console related to `triggeredBy`, `Automation`, or `Recurrence`.
