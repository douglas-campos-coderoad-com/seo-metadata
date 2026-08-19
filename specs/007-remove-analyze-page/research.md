# Phase 0 Research: Remove Analyze Page

No open `NEEDS CLARIFICATION` markers remain in the Technical Context or spec — the one ambiguity in the spec (disposition of `RecentTargetsList`) was resolved directly by the user during `/speckit-specify`. Research here is a short audit confirming the blast radius, plus the two removal-approach decisions this feature needs.

## 1. Scope confirmation: `/analyze` page vs. backend `/analyze/{id}` endpoint

**Decision**: Touch only the frontend page route and its references. Make zero changes to `backend/` or to any frontend code that calls the backend's `/analyze/{id}` REST endpoint (`AnalysisApiService.runPipeline`, `mockAnalysisApi.ts`, the `backendAnalysisId` doc-comment in `shared/types/index.ts`).

**Rationale**: A repository-wide search for `/analyze` turned up two unrelated things sharing the same word: (a) the frontend page at `app/analyze/page.tsx`, reachable via the nav and tested by `tests/e2e/golden-path.spec.ts`; and (b) the backend's `POST /api/v1/analyze/{ingested_url_id}` endpoint, called internally by `AnalysisApiService` regardless of which frontend page triggered the flow. These are unrelated by design (spec FR-006) — removing the page changes nothing about how the app talks to that endpoint, since the home page already drives the exact same `AnalysisApiService.startAnalysis` call the Analyze page did.

**Alternatives considered**: None — the two concepts are unambiguous once distinguished; no design choice to make here.

## 2. Route removal approach

**Decision**: Delete `frontend/src/app/analyze/page.tsx` (and the emptied `app/analyze/` directory) outright. Rely on Next.js App Router's default not-found handling for the old route — no redirect to `/`.

**Rationale**: Spec Assumptions explicitly set this as the default, consistent with the precedent already established when `/automations` was removed in this same codebase (see `specs/006-remove-automations/research.md` §2). Consistency across the two removals means a user hitting either retired route gets the same, already-understood behavior.

**Alternatives considered**: Redirect `/analyze` → `/` — rejected. It would be a *more* helpful behavior than what `/automations` got (since `/` truly is the functional replacement here), but the user's request was "remove," not "redirect," and introducing an inconsistency between the two most recent removals isn't worth it without being asked for it.

## 3. `RecentTargetsList` handling

**Decision**: Leave `frontend/src/features/history/components/RecentTargetsList.tsx` exactly as it is. Its only current importer (`app/analyze/page.tsx`) disappears when that file is deleted; no other file imports it today, so after this change it becomes legitimately unused — and that's the intended outcome (spec FR-007), not a bug to fix.

**Rationale**: The user was asked to choose between moving it onto the home page now, deleting it, or something else, and explicitly chose "preserve, don't link yet." Nothing further needs to happen to this file.

**Alternatives considered**: N/A — this was a direct user decision, not a technical tradeoff.

## 4. Test update approach

**Decision**: Edit `frontend/tests/e2e/golden-path.spec.ts` in place — change both `page.goto('/analyze')` calls to `page.goto('/')`, and change the invalid-URL test's `expect(page).toHaveURL(/\/analyze$/)` assertion to expect staying on `/` instead. No test is deleted; both keep asserting the same user-visible behavior (submit → live progress → results; invalid URL → inline error, no navigation), just through the surviving page.

**Rationale**: Unlike the automations removal (where the dedicated tests exercised functionality being deleted entirely), the Analyze page's tests exercise functionality that **remains** — it just remains on a different route. Deleting these tests would be a real coverage loss (spec FR-004); editing them in place preserves it.

**Alternatives considered**: Delete and rewrite as new tests under a different file name — rejected as unnecessary churn; an in-place edit is smaller and preserves git history/blame for this test file.

## 5. Documentation scope

**Decision**: Edit the one README line that lists `analyze` in the frontend app-tree ASCII block (`app/{analyze,projects,targets,runs}` → `app/{projects,targets,runs}`). Leave the "**Analyze** — submit a URL..." bullet under "Frontend concepts" as-is, since it describes the *capability* (still true — you can still do this from `/`), not the removed page.

**Rationale**: Matches spec FR-005 (docs must not list a separate Analyze *page*) without over-editing prose that remains accurate. The backend API route table (`POST /api/v1/analyze/{ingested_url_id}`) is unrelated (see §1) and untouched.

**Alternatives considered**: Rewording the "Frontend concepts" bullet — rejected; it already describes the flow accurately regardless of which route hosts it, so no change is needed there.
