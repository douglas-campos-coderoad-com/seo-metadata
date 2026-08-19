# Contract: `/api/v1/projects` REST API

New router, `backend/src/api/projects.py`, registered in `main.py` alongside the existing routers (research.md §2). All endpoints are unauthenticated (FR-012). Error shape matches existing convention: `404` with `{"detail": "<message>"}` for not-found, `422` for validation failures (FastAPI default from Pydantic).

## Project CRUD

### `POST /api/v1/projects`

Create a project, optionally with an initial competitor list (US2).

Request:
```json
{
  "title": "string, required",
  "description": "string, required",
  "category": "string, required — one of the 22 FR-011 values",
  "country": "string, required",
  "region": "string, optional",
  "competitors": [
    { "url": "string, required", "description": "string, required" }
  ]
}
```
`competitors` defaults to `[]` if omitted (US2 Scenario 5).

Response `201`: `ProjectResponse` — all fields above plus `id`, `created_at`, `updated_at`, and the saved `competitors` (each with their own `id`).

### `GET /api/v1/projects`

List all projects (US2 independent test — "revisit an empty project"; feeds the frontend's project picker in US3).

Response `200`: `{"items": [ProjectResponse, ...], "total": <int>}` — matches the existing `*ListResponse` convention.

### `GET /api/v1/projects/{project_id}`

Response `200`: `ProjectResponse`. `404` if not found.

### `PATCH /api/v1/projects/{project_id}`

Edit a project's metadata and/or replace its competitor list (US6/FR-014).

Request: same shape as `POST`, all fields optional except that if `competitors` is present it **replaces the entire list** (research.md §4 — not a merge/patch of individual entries).

Response `200`: updated `ProjectResponse`. `404` if not found.

### `DELETE /api/v1/projects/{project_id}`

Delete a project. Cascades to its `competitors` and to any `UrlAnalysis` rows with this `project_id` (FR-015; DB-level `ondelete='CASCADE'` on both FKs — the API itself performs no manual cleanup queries).

Response `204`. `404` if not found. The frontend is responsible for the "are you sure?" confirmation (US6 Scenario 2) before calling this — the API performs no confirmation step itself.

## Project analysis history

### `GET /api/v1/projects/{project_id}/analyses`

List a project's analysis history, chronological, each with its before/after results (US4, FR-004, FR-008).

Response `200`:
```json
{
  "items": [
    {
      "id": 123,
      "ingested_url_id": 45,
      "url": "https://example.com/product",
      "seo_score": 72, "geo_score": 65, "overall_score": 68,
      "analysis": { "...": "existing analysis JSON, unchanged shape" },
      "json_ld": { "...": "unchanged shape" },
      "created_at": "2026-08-19T12:00:00Z",
      "optimization": {
        "optimized_html": "...", "optimized_content": {"...": "..."},
        "score_before": {"...": "..."}, "score_after_estimated": {"...": "..."},
        "copy_paste_ready": {"...": "..."}
      }
    }
  ],
  "total": 1
}
```
`optimization` is `null` when no `UrlOptimization` row exists for that analysis (Edge Cases — "before" only, no error). `url` is joined in from the analysis's `IngestedUrl` for display convenience (avoids a second round-trip from the frontend). `404` if the project doesn't exist.

### `POST /api/v1/projects/{project_id}/analyses`

Attach an existing analysis to this project, or reassign it here from another project (US3 Scenario 2, US6 Scenario 4).

Request: `{ "analysis_id": 123 }`

Response `200`: the analysis record (same shape as one item from the list endpoint above), now carrying this `project_id`. `404` if either the project or the analysis id doesn't exist.

**Note**: this single endpoint covers both "add" (analysis currently has `project_id = NULL`) and "reassign" (analysis currently belongs to a different project) — from the API's perspective it's the same operation (set `project_id`), so there is no separate "reassign" endpoint.

### `DELETE /api/v1/projects/{project_id}/analyses/{analysis_id}`

Remove an analysis from a project — **permanently deletes** the `UrlAnalysis` row (and its `UrlOptimization` child, via existing cascade) rather than nulling `project_id` back out (research.md §1, FR-016).

Response `204`. `404` if the analysis doesn't exist or doesn't belong to this project.

## Smart Search

### `POST /api/v1/projects/competitors/smart-search`

Propose competitor entries from project context (US5, FR-007). **Not** nested under an existing `{project_id}` — this must work while a project is still being created (US5's own scenario says "creating **or** editing"), before an id exists.

Request:
```json
{
  "description": "string, required",
  "category": "string, required",
  "country": "string, required",
  "region": "string, optional"
}
```
`422` if `description`, `category`, or `country` are missing/blank — this is how the frontend's "fill required fields first" prompt (US5 Scenario 4) is enforced server-side, not just client-side.

Response `200`:
```json
{ "suggestions": [ { "url": "string", "description": "string" } ] }
```
`suggestions` MAY be `[]` — the frontend shows the "no confident suggestions" message (US5 Scenario 3) when the array is empty, not on an error response. Nothing is persisted by this call (FR-007 — proposals are never auto-saved); the frontend inserts the returned entries into its local, editable competitor list, same as a manually-added entry.
