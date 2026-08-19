# Phase 0 Research: Project & Analysis UX Improvements

No `NEEDS CLARIFICATION` markers remain in the Technical Context. This document works through the real technical tension in the spec: User Story 2 asks for a "fully re-hydrated interactive Run page," but the existing Run page and its optimization flow were never built to display data that wasn't just produced by the current session.

## 1. Why the existing `/runs/[runId]` page can't just be reused as-is

**Finding**: `frontend/src/app/runs/[runId]/page.tsx` reads `useAppStore(state => state.runs[runId])` — a record that only exists in the client's session-scoped Zustand store, keyed by a `crypto.randomUUID()` generated when `startAnalysis` was called in *this* browser session. A historical analysis opened from a project's history has no such client-side record — it only has a backend-persisted integer `analysisId` (and the `ProjectAnalysis` shape from specs/008, not the client `AnalysisRun`/`Finding` shape).

**Decision**: Build a **separate route** for the historical view (`/runs/history/[projectId]/[analysisId]`) that fetches and renders directly from backend data, rather than trying to make `/runs/[runId]` handle two different identity spaces (client UUID vs. backend integer id) in one dynamic segment. The two pages share the same visual components (`ScoreSummary`, `FindingsList`, `BeforeAfterViewer`) but have different data-loading — the live page still reads from the store; the historical page fetches once on mount.

**Rationale**: Sniffing "is this param a UUID or an integer" inside one route is fragile and would leave a URL that's ambiguous about what it points to. A distinct route is unambiguous, bookmarkable, and matches how specs/008 already distinguishes "live client run" from "persisted project analysis" as two different concepts with two different id spaces.

**Alternatives considered**: Overload `/runs/[runId]` — rejected for the fragility above. Store the whole historical analysis payload in a client-side cache and reuse the exact same page/route via query params — rejected; it would require carrying a large JSON blob through navigation state or a client store write for something that's just as easy (and far more robust to a full reload / shared link) to fetch fresh from the backend by id.

## 2. Fetching a single historical analysis

**Finding**: specs/008 added `GET /projects/{project_id}/analyses` (a list) but no single-item read. `ProjectService._get_analysis_with_relations(analysis_id)` (specs/008) already does the eager-loaded fetch-by-id; it just doesn't check the analysis actually belongs to the given project.

**Decision**: Add `GET /api/v1/projects/{project_id}/analyses/{analysis_id}` — a natural, RESTful single-item sibling of the existing list endpoint. `ProjectService` gets a thin `get_analysis(project_id, analysis_id)` that calls the existing `_get_analysis_with_relations` and then raises `ValueError` if the result's `project_id` doesn't match, reusing the router's existing 404 pattern. Response shape is the same `ProjectAnalysisResponse` the list endpoint already returns per item — no new schema needed, just reusing `_to_project_analysis_response`.

**Rationale**: The history "View" action is always triggered from within a specific project's page, so the frontend already has both ids in scope — no need to search a list or thread extra state through navigation. This is the smallest possible backend change (one method, one route) and touches no data.

**Alternatives considered**: Re-fetch the whole `GET /projects/{project_id}/analyses` list on the historical page and find the matching entry client-side — rejected as wasteful (fetches every sibling analysis just to display one) and it was already sitting one query away from being a proper single-item endpoint.

## 3. Rendering before/after without re-triggering optimization

**Finding**: `BeforeAfterViewer` starts with `optimized = false` and only shows "after" data once the user clicks "Run GEO/AEO Optimizer," which calls `useOptimize().run(analysisId)` — a `POST /optimize/{id}` that generates a **new** optimization via LLM every time it's called (confirmed: this endpoint has no "return existing if present" short-circuit; `optimizer.py`'s `POST /optimize/{id}` always runs the optimizer). Naively reusing `BeforeAfterViewer` for a historical view would either always start on the "click to optimize" empty state (regenerating a new optimization needlessly, and worse, on the LATEST record rather than showing what happened historically), or require awkward auto-clicking.

Separately: `ProjectAnalysisOptimization` (specs/008, camelCase, from `GET /projects/{id}/analyses`) and `OptimizationData` (`useOptimize.ts`, snake_case, from `POST`/`GET /optimize/{id}`) are two different shapes for conceptually the same data — `AfterBlock`/`RoiProjectionPanel`/`CopyPasteReadyPanel` all expect the latter.

**Decision**:
- `BeforeAfterViewer` gains two new optional props, `initialOptimization`/`initialGeoScore`. When provided, the component starts with `optimized = true` and renders them immediately — no button, no POST. The existing live-run path (no props provided) is completely unchanged.
- The historical page loads "after" data via a **new GET-only path** on `useOptimize` (e.g., `loadExisting(analysisId)`, calling `apiClient.get<OptimizationData>('/optimize/{id}')` — the backend's existing `GET /optimize/{analysis_id}` endpoint, which already returns the *latest stored* optimization without generating a new one) rather than reshaping the specs/008 `ProjectAnalysisOptimization` camelCase data. This means the historical view always reflects the true latest-optimization-for-that-analysis from the source of truth, in the exact shape the display components already expect — zero shape-conversion code, zero drift risk between two parallel type shapes.
- The historical view's "Re-run Optimizer" affordance (already built into `BeforeAfterViewer`) is left exactly as-is — clicking it still POSTs a new optimization for that same `analysisId`. Spec FR-012 is about *analysis* re-runs creating a new history entry, not optimization re-runs on an existing one; re-optimizing the same historical analysis in place is existing, unchanged behavior, not something this feature redefines.

**Rationale**: Reusing the existing GET-by-id optimization endpoint sidesteps building and maintaining a second data-mapping path; it also means "before" (raw analysis JSON → `Finding[]`) is the only shape-conversion work actually needed (see §... — findings mapping already has a reusable extraction point from specs/008's `findingMappers.ts`).

**Alternatives considered**: Convert `ProjectAnalysisOptimization` → `OptimizationData` with a mapping function — rejected; doable, but it's pure incidental complexity when the correctly-shaped data is one existing GET call away.

## 4. Findings ("before") for a historical view

**Finding**: `AnalysisApiService.buildFindings(runId, analysis)` (private method) is what turns a raw backend `analysis.analysis` JSON payload into the client `Finding[]` shape `FindingsList`/`BeforeAfterViewer` expect — but it's coupled to a client `runId: string` (stamped onto each generated `Finding.runId`) and isn't exported.

**Decision**: Generalize `buildFindings` into a standalone, exported function (e.g. in a shared module, alongside the `findingMappers.ts` category/severity helpers already extracted in specs/008) that takes an arbitrary "owner id" string instead of assuming a client run — the live pipeline passes its `runId`, the historical view passes something derived from the analysis id (e.g. `String(analysisId)`). `Finding.runId` was always just a grouping/lookup key, never validated against `useAppStore`, so this is a safe, non-behavior-changing generalization for the live path.

**Rationale**: This is the same "extract shared mapping logic instead of duplicating it" move already established in specs/008 §6 (research.md) for category/severity — consistent precedent, avoids a second finding-parsing implementation that could drift from the first.

**Alternatives considered**: Duplicate a slimmed-down finding parser just for the historical view — rejected for the drift risk; the two code paths parse the exact same backend JSON shape.

## 5. The modal itself

**Finding**: No dialog/modal primitive exists in `frontend/src/shared/components/ui/` (confirmed in specs/008 — delete-confirmation there used a native `window.confirm()` as a deliberate, disclosed simplification). `window.confirm()` cannot host arbitrary form content, so it isn't an option for FR-001/FR-002, which need the full create-or-choose-a-project form inside the modal.

**Decision**: Add one small, dependency-free `Modal` component to the shared UI kit: a fixed-position backdrop, a centered panel, closes on backdrop click and on Escape, calls an `onClose` prop either way. `AddToProjectAction`'s existing internal content (the create/choose-existing logic already built in specs/008 US3) moves inside it unchanged — this is a wrapper change, not a rewrite of that logic.

**Rationale**: The app has no dialog library dependency today and the actual requirement is a simple overlay, not a complex accessible dialog system — adding a new npm dependency for that would be disproportionate. This mirrors the existing project convention of small, hand-rolled primitives (`Button`, `Alert`, `Badge` are all local, not from a component library beyond Radix's `Slot`).

**Alternatives considered**: `@radix-ui/react-dialog` — rejected as an avoidable new dependency for a requirement this small; nothing else in the app pulls in Radix beyond the `Slot` primitive `Button` already uses.

**Disclosed limitation**: the hand-rolled modal will not implement a full focus trap (tab key can escape to the underlying page). This is a deliberate, disclosed simplification consistent with this app's existing accessibility posture (no other interactive surface in the app implements one either), not an oversight — flagged here rather than silently cut.

## 6. Shared issues removal — confirming the "UI only" boundary

**Finding**: `computeProjectSharedIssues` (specs/008, `shared/lib/sharedIssues.ts`) and its wiring in `useProjectDetail.ts` are pure client-side computation over already-fetched data — nothing about shared issues is persisted server-side today (confirmed: it was explicitly "computed on read, never persisted" as far back as specs/003).

**Decision**: Remove `<SharedIssuesPanel>` from `app/projects/[projectId]/page.tsx` and drop the now-unused `sharedIssues` computation from `useProjectDetail.ts`'s return value (and its `useMemo` call). Leave `computeProjectSharedIssues`, `sharedIssues.ts`, `SharedIssuesPanel.tsx` and `findingMappers.ts` (which it depends on) in place, untouched — they satisfy FR-007 by construction (nothing about them is a "backend/data" concern to begin with), and per this repo's established precedent (specs/006 §6, specs/007), removing the display call site while leaving the still-correct, independently-testable computation function in place for potential future reuse is a reasonable, disclosed choice — not a contradiction of the "no dead code" precedent, since the function isn't broken or superseded, just currently unused.

**Rationale**: Matches the explicit instruction "backend/data must be left untouched... this is not a schema or data migration" as literally as possible — nothing under `backend/` or any persisted table is touched by this decision.

**Alternatives considered**: Also delete `computeProjectSharedIssues`/`SharedIssuesPanel.tsx` entirely — rejected; the spec explicitly frames this as a UI-only change and doesn't ask for the underlying capability to be destroyed, only hidden. Removing it outright would foreclose reintroducing it later for zero benefit today.
