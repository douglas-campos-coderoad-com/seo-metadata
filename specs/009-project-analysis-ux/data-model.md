# Phase 1 Data Model: Project & Analysis UX Improvements

This feature introduces **no new persisted entities or schema changes** (FR-007 forbids it for shared issues, and the historical-view/modal work is purely a new way of reading and presenting data that specs/008 already persists). Documented here for traceability.

## Reused entities (unchanged)

- **Project**, **Competitor**, **UrlAnalysis** / **UrlOptimization** (specs/008): all read as-is. This feature adds one new *read path* (research.md §2), not a new table or column.

## New response shape: none

The new backend endpoint (`GET /projects/{project_id}/analyses/{analysis_id}`) returns the **same** `ProjectAnalysisResponse` schema the existing list endpoint already returns per item — no new Pydantic schema, no new frontend DTO/mapper. It reuses `_to_project_analysis_response` and `mapProjectAnalysis` verbatim.

## Frontend state additions (not persisted — component/hook state only)

### `BeforeAfterViewer` — new optional props

| Prop | Type | Behavior when present |
|---|---|---|
| `initialOptimization` | `OptimizationData \| null` | Component starts with `optimized = true` and renders this data immediately — no "click to optimize" prompt, no POST. |
| `initialGeoScore` | `GeoScoreData \| null` | Rendered alongside `initialOptimization`. |

When both are omitted (the existing live-run call site), behavior is byte-for-byte unchanged from today.

### `useOptimize` — new method

| Method | Behavior |
|---|---|
| `loadExisting(analysisId)` | `GET /optimize/{analysisId}` (not POST) — fetches the latest *already-stored* optimization for that analysis without generating a new one. Populates the same `optimization`/`geoScore` state the existing `run()` method populates, so both paths feed the same rendering code. |

### New route: `/runs/history/[projectId]/[analysisId]`

Not a data entity — a page that, on mount, calls `GET /projects/{projectId}/analyses/{analysisId}` (research.md §2) for the "before" side and `useOptimize().loadExisting(analysisId)` for the "after" side (when present), then renders through the same `ScoreSummary`/`FindingsList`/`BeforeAfterViewer` components the live run page uses.

### Generalized finding-mapping function

`buildFindings`-equivalent logic (specs/003-era, currently a private method on `AnalysisApiService`) is generalized to accept an arbitrary owner-id string instead of a client `runId`, so both the live pipeline and the new historical route can produce `Finding[]` from the same raw backend JSON shape without duplicating the parsing logic (research.md §4).

## State transitions

None — viewing a historical analysis is a pure read. The only state-changing action reachable from the historical view is "run a fresh analysis" (FR-011/FR-012), which goes through the **existing, unchanged** `startAnalysis` → `POST /ingest/url` → `POST /analyze/{id}` pipeline and the **existing, unchanged** attach-to-project flow — this feature does not modify that pipeline, it only adds a place from which it can be triggered with the URL pre-filled.
