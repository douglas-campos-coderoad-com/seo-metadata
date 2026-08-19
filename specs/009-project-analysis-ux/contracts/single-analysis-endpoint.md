# Contract: `GET /api/v1/projects/{project_id}/analyses/{analysis_id}`

New endpoint, added to the existing `backend/src/api/projects.py` router. The only backend change this feature makes.

## Request

`GET /api/v1/projects/{project_id}/analyses/{analysis_id}`

Path parameters: `project_id: int`, `analysis_id: int`.

## Response

`200 OK` — identical shape to a single item from `GET /projects/{project_id}/analyses`'s `items` array (same `ProjectAnalysisResponse` schema from specs/008, reusing `_to_project_analysis_response`):

```json
{
  "id": 78,
  "ingested_url_id": 8,
  "url": "https://example.com/attach-test-product",
  "seo_score": 30, "geo_score": 15, "overall_score": 22,
  "analysis": { "...": "raw backend analysis JSON, unchanged shape" },
  "json_ld": { "...": "unchanged shape" },
  "status": "completed",
  "created_at": "...", "updated_at": "...",
  "optimization": null
}
```

`optimization` is `null` when no `UrlOptimization` row exists for this analysis (same as the list endpoint).

## Errors

- `404` with `{"detail": "Project with id {project_id} not found"}` if the project doesn't exist.
- `404` with `{"detail": "Analysis with id {analysis_id} not found in project {project_id}"}` if the analysis doesn't exist **or exists but belongs to a different project** — deliberately the same message/status for both cases, so this endpoint can't be used to probe whether an analysis id exists under a project the caller doesn't otherwise know about.

## Service layer

`ProjectService.get_analysis(project_id, analysis_id)`:
1. Calls the existing `_get_analysis_with_relations(analysis_id)` (specs/008 — eager-loads `ingested_url` and `optimizations`).
2. Raises `ValueError` (→ router 404) if the result's `project_id` doesn't equal the given `project_id`.

No new database query shape — this reuses specs/008's existing eager-loaded fetch, adding only an ownership check.

## Frontend consumer

`AnalysisApiService.getAnalysis(projectId, analysisId): Promise<ProjectAnalysis>` — `GET /projects/{projectId}/analyses/{analysisId}`, mapped through the existing `mapProjectAnalysis` (specs/008), returning the same `ProjectAnalysis` type the list endpoint's items already produce. Added to the `AnalysisService` interface alongside `listProjectAnalyses`.
