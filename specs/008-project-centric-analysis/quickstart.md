# Quickstart: Validate Project-Centric Analysis Management

Prerequisites: feature implemented per [plan.md](plan.md); migration `006_projects_competitors` applied; backend running (`uvicorn` per existing backend README instructions) with a real or configured LLM provider for Smart Search; frontend dependencies installed.

## 1. Backend: migration and unit tests

```sh
cd backend
alembic upgrade head
pytest tests/unit/test_project_service.py tests/unit/test_competitor_agent.py -v
```
**Expected**: migration applies cleanly; both new unit test files pass. See [contracts/projects-api.md](contracts/projects-api.md) for the endpoint shapes these tests exercise.

## 2. Backend: manual API walkthrough (proves the data model end-to-end)

```sh
# Create a project
curl -X POST http://localhost:8000/api/v1/projects -H "Content-Type: application/json" -d '{
  "title": "Demo Shop", "description": "A small e-commerce site selling home goods",
  "category": "e-commerce", "country": "United States", "region": "California",
  "competitors": [{"url": "https://example-competitor.com", "description": "Similar home goods store"}]
}'
# → 201, note the returned "id" as $PROJECT_ID

# Run an anonymous analysis exactly as today (see quickstart step 3 for the UI path,
# or directly via the existing pipeline):
curl -X POST http://localhost:8000/api/v1/ingest/url -H "Content-Type: application/json" -d '{"url": "https://example.com/product"}'
# → note "id" as $INGESTED_ID
curl -X POST http://localhost:8000/api/v1/analyze/$INGESTED_ID
# → note "id" as $ANALYSIS_ID

# Attach it to the project
curl -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/analyses -H "Content-Type: application/json" -d "{\"analysis_id\": $ANALYSIS_ID}"
# → 200, project_id now set

# List the project's history
curl http://localhost:8000/api/v1/projects/$PROJECT_ID/analyses
# → 200, one item, "optimization": null (no optimize call was made)

# Smart Search
curl -X POST http://localhost:8000/api/v1/projects/competitors/smart-search -H "Content-Type: application/json" -d '{
  "description": "A small e-commerce site selling home goods", "category": "e-commerce",
  "country": "United States", "region": "California"
}'
# → 200, { "suggestions": [...] } — never writes to the DB
```
**Expected**: every step matches the response shapes in [contracts/projects-api.md](contracts/projects-api.md); the analysis appears in the project's history with persisted before-only data.

## 3. Frontend: manual UI walkthrough

1. `npm run dev` in `frontend/`.
2. From the home page (`/`), submit a URL and let the analysis complete. **Expected** (User Story 1): identical to today's behavior, no project UI involved yet.
3. On the results page, confirm an "Add analysis to a project" action is visible (User Story 3, Scenario 1).
4. Click it, choose "create new project," fill in title/description/category/geography, add a competitor manually. **Expected**: project is created and the analysis is immediately attached (User Story 3, Scenario 3).
5. Navigate to `/projects/{id}`. **Expected** (User Story 4): the analysis appears in history, rendering its persisted "before" result (no "after," since optimization was never run for it).
6. Reload the browser fully. **Expected**: the project and its history still display, proving the data came from the backend, not session state (User Story 4, Scenario 4).
7. Edit the project's title and category; save. **Expected** (User Story 6): changes persist across a reload.
8. On the project's competitor editor, click Smart Search with description/category/geography filled in. **Expected** (User Story 5): suggested entries appear in the editable list; edit or remove one, save, and confirm only the final list persists.
9. Delete the project. **Expected**: a confirmation prompt appears first (User Story 6, Scenario 2); after confirming, the project and its analysis history are gone.

## 4. Regression check: anonymous flow and existing pipeline unaffected

1. Repeat step 2 above without ever clicking "Add analysis to a project." **Expected**: the analysis behaves exactly as it does today from the user's perspective — reload the page and it's gone from view, with no "past analyses" list anywhere to find it (FR-013; see [research.md](research.md) §1 for why the row may still exist in the database while being unreachable through the UI — this is expected, not a bug).
2. Run the existing frontend test suite (`npm run test` in `frontend/`) and backend suite (`pytest` in `backend/`). **Expected**: all previously-passing tests still pass — this feature must not regress the existing analysis/optimization pipeline (spec Assumptions).
