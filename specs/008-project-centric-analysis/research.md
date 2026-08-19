# Phase 0 Research: Project-Centric Analysis Management

No open `NEEDS CLARIFICATION` markers remain in the Technical Context — all four ambiguities were resolved via `/speckit-clarify` before this plan. This document instead resolves the technical *how* behind each clarified decision, and surfaces one important nuance discovered during research that refines (without reversing) FR-013.

## 1. Reconciling FR-013 with what the backend already does today — **read this first**

**Finding**: FR-013 says an analysis should stay ephemeral "unless and until the user explicitly adds it to a project." Investigating the actual backend pipeline (`backend/src/services/ingest_service.py`, `backend/src/api/analysis.py`) shows this is **already partially true and already partially false**, in a way that matters for implementation:

- `ingested_urls.url` is `unique` and upserted (`ingest_service.py:44-67`) — one row per URL, updated in place on re-ingest.
- `url_analyses` and `url_optimizations` rows, however, are **unconditionally written today for every single analysis run**, anonymous or not — this has nothing to do with projects; it's just how the existing pipeline has always worked. There is no code path today that skips persisting an analysis result.
- What's actually ephemeral today is the *frontend's* view of that data: `AnalysisRun`/`Finding` live only in the session-scoped Zustand store (`useAppStore.ts`), and there is no endpoint the frontend calls to list past analyses — so a completed analysis, once the tab closes, is unreachable by the user even though its row still exists in Postgres.

**Decision**: Keep the backend's existing unconditional persistence of `url_analyses`/`url_optimizations` exactly as-is — do **not** add conditional logic to suppress writing them for project-less runs. That would be a regression to stable, unrelated code for no benefit. Instead, implement FR-013's *user-facing* guarantee (an anonymous analysis is not durably reachable unless captured into a project) by:
- Never exposing a "list all past analyses" endpoint or UI — the only way to reach a project-less analysis is the "Add analysis to a project" action shown immediately after it completes (FR-002), which the frontend already has the means to invoke because it already holds `run.backendAnalysisId` in that same session.
- "Add analysis to a project" becomes a single `PATCH` that sets `project_id` on the *already-existing* `url_analyses` row — not a new "save this analysis" write path that duplicates data.

**Why this satisfies the clarified intent**: the user chose Option B specifically to avoid "anonymous, never-claimed analyses accumulat[ing] in the DB indefinitely" as a *product/discoverability* concern. Rows existing in Postgres that nobody can ever list, filter, or reach is functionally equivalent to them not existing from the user's and the UI's perspective — and it avoids reimplementing persistence logic that already works. This is flagged explicitly (not silently decided) because it's a refinement of how FR-013 is satisfied, not a reversal of the decision itself.

**Alternatives considered**: Add a `committed`/`draft` boolean flag and a cleanup job to hard-delete un-committed rows after some retention window — rejected as unrequested extra scope (a retention policy was never asked for) that duplicates behavior the unique-URL upsert and "no list endpoint" approach already achieves for free.

## 2. Backend model/schema/service/router conventions to follow

**Decision**: New `Project` and `Competitor` models follow the exact pattern `UrlAnalysis`/`UrlOptimization` already use: `class X(Base, TimestampMixin)`, `id = Column(Integer, primary_key=True, index=True)`, FKs as `Column(Integer, ForeignKey('table.id', ondelete='CASCADE'), nullable=..., index=True)`, one-directional `relationship('Other', backref='plural_name')`. New Pydantic schemas live in `backend/src/schemas/project.py` mirroring the model 1:1 (matching `AnalysisResponse`/`OptimizationResponse`'s style — no nested Create/Read/Update split beyond what's needed). New router `backend/src/api/projects.py` uses `APIRouter(prefix='/api/v1', tags=['projects'])`, delegates to a `ProjectService(session)`, raises `ValueError` in the service layer for not-found → caught and converted to `HTTPException(404)` in the router, exactly like `analysis.py`/`optimization.py`.

**Rationale**: Every other backend entity in this codebase follows this shape; deviating would be inconsistent for no benefit and would fail an eventual consistency-minded code review.

**Alternatives considered**: None — this is an established, unambiguous convention (see `backend/src/models/url_analysis.py`, `backend/src/api/analysis.py`).

## 3. Where `project_id` lives, and how a project's analysis history is queried

**Decision**: Add a single nullable `project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'), nullable=True, index=True)` directly to `url_analyses` (migration: `op.add_column`, matching the minimal style of migration 005). `url_optimizations` gets no new column — its project association is derived transitively via `url_optimizations.analysis_id → url_analyses.id → url_analyses.project_id`. A project's history query is `SELECT * FROM url_analyses LEFT JOIN url_optimizations ON ... WHERE url_analyses.project_id = :project_id ORDER BY url_analyses.created_at`.

**Rationale**: `url_analyses` already has no unique constraint on `ingested_url_id`, so multiple analyses of the same URL over time already accumulate as separate rows — this is precisely "history of analyses over time" (FR-008) with zero new modeling needed beyond the link column. Adding `project_id` to `url_optimizations` too would be redundant data that could drift out of sync with its parent analysis's project.

**Alternatives considered**: A separate `project_analyses` join table (many-to-many) — rejected; FR-003 explicitly states one-to-many (an analysis belongs to at most one project), so a direct FK is simpler and sufficient. A brand-new `analyses` table that duplicates `url_analyses`/`url_optimizations` — rejected; it would fork the existing, working pipeline's output into a second representation that needs to be kept in sync, exactly the kind of "reconciliation debt" the spec is trying to eliminate.

## 4. Competitor storage and editing model

**Decision**: `Competitor` is its own table (`id, project_id FK CASCADE, url, description` + timestamps), not a JSON blob column on `Project`. The competitor list is managed as a whole via the project `PATCH` endpoint — the request body carries the full desired `competitors: [{url, description}]` array, and the service diffs/replaces rows accordingly (delete-then-recreate, or diff-by-URL; an implementation-time choice, not a modeling one).

**Rationale**: A real table (not JSON) allows normal FK cascade-on-delete (FR-015: deleting a project deletes its competitors) and keeps the schema queryable/consistent with every other entity in this codebase (all of which use real columns/tables, never a catch-all JSON blob for structured, repeating data — JSON columns here are reserved for genuinely unstructured LLM output like `url_analyses.analysis`). Whole-list-replace-on-save matches the UX described (an editable list you add to/remove from, then save) rather than requiring granular per-competitor endpoints the UI never calls independently.

**Alternatives considered**: Per-competitor CRUD endpoints (`POST/DELETE /competitors/{id}`) — rejected as unnecessary API surface; nothing in the spec calls for adding/removing a single competitor outside the context of editing the project as a whole.

## 5. Smart Search mechanism

**Decision**: New `backend/src/agents/competitor_agent.py` follows the exact shape of `entity_agent.py`/`geo_content_agent.py`: a `SYSTEM_PROMPT` constant, a `_call_llm(prompt)` helper calling `get_llm_repository().complete_json(prompt, system_prompt=SYSTEM_PROMPT)`, a prompt template built from the project's description/category/geography ending in "Return EXACTLY this JSON," and a `generate(...)` method wrapping failures into a dict with an `error` key. Invoked from `ProjectService`/a small `CompetitorService`, exposed as `POST /api/v1/projects/{id}/competitors/smart-search`, returning suggestions the frontend inserts into the editable list — nothing is written to the database by this endpoint.

**Rationale**: This is a single-shot "generate structured JSON from a prompt" task, exactly what the existing agent pattern is for — no LangGraph orchestration needed (LangGraph is used one layer up for multi-step pipelines like the full analysis run, not for a single suggestion call). Reusing `get_llm_repository()` means Smart Search automatically gets the same provider (Gemini/Anthropic) fallback behavior as the rest of the app, with no new external dependency or API key to provision.

**Alternatives considered**: A real web-search API integration (e.g., a search engine API) for "true" competitor discovery — rejected for this feature; the spec describes inference "from the project's own description, category, and geography," which is an LLM-knowledge task, not a live web search, and introducing a new external API dependency is unrequested scope. This can be revisited later without changing the endpoint contract (FR-007's behavior is unaffected by how suggestions are produced internally).

## 6. Frontend reconciliation: replacing the client-only Project slice

**Decision**: `useProjects`/`useProjectDetail` are rewritten to call the new `/projects` endpoints via the existing `apiClient` (same `get/post/patch/delete<T>` convention already used for `/ingest`, `/analyze`, `/optimize`). `useAppStore`'s `projects` field and its `createProject`/`addTargetToProject`/`removeTargetFromProject` actions are removed, not left dead — this repo has an established, explicit precedent (specs 006 and 007) of not leaving superseded client-side code behind. `computeSharedIssues` (`shared/lib/sharedIssues.ts`) keeps its existing pure-function shape (grouping findings by category+title across targets) but is now fed from the freshly-fetched project-analyses list instead of the Zustand store — its logic is reused, not rewritten, satisfying the spec's Assumption that existing analysis/optimization logic is unchanged.

**Rationale**: Directly matches spec FR-004's stated need ("the existing analysis logic must be reconciled with the current UI, which the stored model doesn't yet reflect") and the established no-dead-code precedent from the two prior removal features in this repo.

**Alternatives considered**: Keep the old client-side project store as a fallback/cache layer in front of the API — rejected; this app has no offline requirement, and a cache layer here would just be a second source of truth to keep in sync, reintroducing the exact staleness problem this feature exists to fix.

## 7. Category storage

**Decision**: `Project.category` is `Column(String(50), nullable=False)` — no native Postgres `ENUM` type. Validity of the 22-value list (from Clarifications) is enforced at the Pydantic schema layer (a `Literal[...]` or Python `Enum`), not a DB-level `CHECK` constraint.

**Rationale**: Matches the existing convention exactly — `status` fields throughout this codebase (`ingested_urls.status`, `url_analyses.status`, `url_optimizations.status`) are all `String(50)` validated at the application layer, never native DB enums or CHECK constraints. A native Postgres enum would also make extending the category list later (likely, given "to be finalized" was the original framing) require an `ALTER TYPE` migration instead of a one-line Pydantic change.

**Alternatives considered**: Native Postgres `ENUM` type — rejected as inconsistent with every other status/category-like field in this codebase, and less flexible for a list already flagged as likely to grow.
