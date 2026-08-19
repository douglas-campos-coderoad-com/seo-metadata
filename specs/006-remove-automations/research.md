# Phase 0 Research: Remove Automations Feature

No open `NEEDS CLARIFICATION` markers exist in the Technical Context — this is a well-bounded deletion of an already-built, self-contained feature, not new technology adoption. Research here is an audit (confirming the true blast radius) and a small set of removal-approach decisions.

## 1. Scope confirmation: frontend-only, no backend touch

**Decision**: Treat this as a frontend-only removal; make zero changes under `backend/`.

**Rationale**: A repository-wide case-insensitive search for "automation" found matches only in `frontend/**`, `README.md`, and historical `specs/003-seo-analyzer-frontend/**` documents. The backend has no automation model, endpoint, migration, or scheduler. Automations were entirely simulated/managed client-side (`AnalysisApiService`/`MockAnalysisService` computed `nextRunAt` and stored it in the in-memory Zustand store; nothing was ever sent to the backend).

**Alternatives considered**: None — there was nothing on the backend side to evaluate.

## 2. Route removal approach

**Decision**: Delete `frontend/src/app/automations/page.tsx` (and the now-empty `app/automations/` directory) outright. Rely on Next.js App Router's default not-found handling for any old link/bookmark to `/automations` — no explicit redirect.

**Rationale**: Spec edge case explicitly says the old route should behave "the same as visiting any other unknown route" — the app's standard 404 already satisfies this with zero added code. A redirect would be unrequested extra behavior for a route that's being retired, not relocated.

**Alternatives considered**: Add a redirect from `/automations` to `/` — rejected as unnecessary complexity/scope creep; nothing in the spec calls for preserving a path to equivalent functionality (there is none).

## 3. `AnalysisRun.triggeredBy` / `RunTrigger` handling

**Decision**: Remove the `triggeredBy: RunTrigger` field from `AnalysisRun` and delete the `RunTrigger` type entirely, rather than keeping the field pinned to a constant `'manual'`.

**Rationale**: Confirmed via search that `triggeredBy` is never read for display anywhere in the UI — its only producers are `AnalysisApiService`/`MockAnalysisService` (setting `'manual'` or `'automation'`) and its only consumers are test fixtures/assertions. Once automation-triggered runs can't occur, a field that only ever holds one constant value carries no information and is dead weight (FR-007 calls for removing or collapsing this concept). Full removal is more honest than a permanently-constant field that invites "what could this be for" questions later.

**Alternatives considered**: Keep `triggeredBy: 'manual'` as a vestigial constant field — rejected; it would still need every call site and fixture updated (same cost as removing it) while leaving a pointless field behind, which fails the "no leftover automation artifacts" success criterion in spirit even if the literal string "automation" no longer appears in it.

## 4. Test removal vs. edit

**Decision**: Delete `frontend/tests/integration/schedule-automation.test.tsx` and `frontend/tests/unit/recurrence.test.ts` entirely (they exist solely to exercise automation/recurrence behavior being removed). Edit (not delete) `submit-analysis.test.tsx`, `create-project-detect-shared-issue.test.tsx`, and `sharedIssues.test.ts` — each has only an incidental automation-shaped fixture line (`automations: {}` in a store-reset call, or `triggeredBy: 'manual'` in an `AnalysisRun` fixture) unrelated to what the test actually verifies.

**Rationale**: Matches FR-008 (no automation-scheduling tests remain) while preserving unrelated test coverage (FR-006/SC-002/SC-003 require the rest of the suite to keep passing unchanged).

**Alternatives considered**: None — the two categories (dedicated-test-for-removed-feature vs. incidental-fixture-field) are unambiguous from the audit.

## 5. Documentation scope

**Decision**: Edit `README.md` (drop the Automations bullet, the two ASCII directory-tree lines listing `automations`, and the `schedule-automation` flow mention). Leave `specs/003-seo-analyzer-frontend/**` untouched.

**Rationale**: Matches the spec's Assumptions — historical spec documents are a record of the decision that *originally introduced* automations and are out of scope; only currently-active, user/contributor-facing docs need to stop describing automations as a present-tense capability.

**Alternatives considered**: Retroactively editing `specs/003-seo-analyzer-frontend/**` — rejected per spec Assumptions (explicitly out of scope, would rewrite history).
