# Quickstart: Validate Project & Analysis UX Improvements

Prerequisites: feature implemented per [plan.md](plan.md); backend running with the new endpoint (no migration needed — no schema change); a project with at least one historical analysis that has an optimization, and one without.

## 1. Modal on the Run page (User Story 1)

1. From the home page, submit a URL and let it complete.
2. On the results page, click "Add analysis to a project." **Expected**: a modal opens over the page (not inline content), offering "create new" and "choose existing."
3. Choose an existing project and confirm. **Expected**: modal closes, the results page reflects the analysis is now attached (per specs/008 US3 behavior).
4. Repeat from a fresh analysis, but this time dismiss the modal (backdrop click or close button) without confirming. **Expected**: no project created, analysis remains unattached — confirm via [contracts/projects-api.md](../008-project-centric-analysis/contracts/projects-api.md)'s list endpoint showing no new attachment.

## 2. Create Project gated behind a button (User Story 4)

1. Visit `/projects`. **Expected**: no creation form visible, only a "Create Project" button (plus the existing project list).
2. Click it. **Expected**: the same creation form as before appears, with the same fields/validation/outcome.

## 3. Shared issues removed from the UI (User Story 5)

1. Open any project's page. **Expected**: no "Shared issues" heading or panel anywhere.
2. Confirm every other section (competitors, analyze-a-URL, history) still renders and works.
3. `curl http://localhost:8000/api/v1/projects/{id}/analyses` directly. **Expected**: unaffected — this feature never touches the backend response.

## 4. View and re-run history (User Story 2) + clickable project label (User Story 3)

1. Open a project with a historical analysis that has an optimization. Click its "View" action. **Expected**: the historical results view opens (per [contracts/single-analysis-endpoint.md](contracts/single-analysis-endpoint.md)), showing the before **and** after results exactly as originally produced — no new optimization is generated (confirm no new `POST /optimize` call fires; only the `GET /optimize/{id}` in the browser's network tab).
2. Open a historical analysis that has **no** optimization. **Expected**: before result only, no error, no auto-triggered optimization prompt behaving differently than before.
3. On the historical view, confirm the owning project's name is shown and clickable. Click it. **Expected**: navigates to that project's page.
4. From the historical view, submit a fresh analysis (pre-filled URL or otherwise). **Expected**: a new entry appears in the project's history; re-opening the original historical entry via "View" again shows it completely unchanged from step 1.

## 5. Regression check

```sh
cd backend && pytest -q
cd frontend && npm run build && npm run test -- --run
```

**Expected**: all previously-passing tests remain green — this feature must not regress the existing anonymous analysis flow, the live-run results page, or any of specs/008's project functionality.
