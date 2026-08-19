# Implementation Plan: Project-Centric Analysis Management

**Branch**: `008-project-centric-analysis` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-project-centric-analysis/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Introduce `Project` and `Competitor` as real, database-backed entities (they exist only client-side today) and link the existing, already-persisted analysis pipeline to them via a new nullable `project_id` on `url_analyses`. A key research finding (see research.md §1) simplifies this considerably: the backend already unconditionally persists every analysis (`url_analyses`) and optimization (`url_optimizations`) row today, regardless of project — so FR-004's "before/after results persisted, UI renders from storage" is *already* true at the data layer. What's actually missing is (a) the `Project`/`Competitor` tables themselves, (b) the `project_id` link, (c) a new backend read path to list a project's analysis history with joined before/after data, and (d) reconciling the frontend's currently 100%-client-side `Project` concept (Zustand-only, never sent to the backend) to instead read/write through this new API. The anonymous first-glance flow and the existing analysis/optimization pipeline logic are otherwise untouched. Smart Search reuses the existing single-shot LLM-agent pattern (`_call_llm` + prompt template), not a new integration.

## Technical Context

**Language/Version**: TypeScript strict mode (frontend, Next.js App Router); Python 3.12+ (backend, FastAPI)

**Primary Dependencies**: Frontend — Next.js, Zustand, existing `apiClient`. Backend — FastAPI, SQLAlchemy 2.x (async), Alembic, Pydantic v2, the existing provider-agnostic `LLMRepository` (Gemini/Anthropic) for Smart Search — no new external dependency.

**Storage**: PostgreSQL. Two new tables (`projects`, `competitors`) plus one new nullable FK column (`url_analyses.project_id`). No changes to `ingested_urls` or `url_optimizations` schemas.

**Testing**: pytest + httpx (backend — the feature spec explicitly asks for "unit tests covering the most critical parts"), Vitest + React Testing Library (frontend)

**Target Platform**: Web (browser) + existing Linux server backend

**Project Type**: Web application — **both** `backend/` and `frontend/` are touched, unlike the two prior (frontend-only) removals in this repo

**Performance Goals**: SC-004 (Smart Search returns a usable suggestion within 15s for well-formed input), SC-005 (a project with 10+ analyses loads its history without perceptible delay — a single indexed query with joins, no N+1 risk at this scale)

**Constraints**: No authentication/user-scoping (FR-012 — confirmed PoC scope); must not alter the existing analysis/optimization pipeline's own logic (Assumptions) or the anonymous first-glance flow (FR-001); Smart Search proposals are never auto-saved (FR-007); removing an analysis from a project deletes its record, reassigning preserves it (FR-016)

**Scale/Scope**: 2 new backend tables, 1 new FK column, ~7 new REST endpoints, 1 new LLM agent module (competitor suggestion), a full rewrite of the frontend's project hooks/pages from Zustand-backed to API-backed, plus removal of the now-superseded client-only project code from `useAppStore`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no ratified project-specific principles). No project-specific gates apply. This feature does add real complexity (new tables, new endpoints, a frontend data-source migration) — but it is complexity the spec directly asks for, not incidental complexity being introduced gratuitously, so it does not trigger a Complexity Tracking entry.

## Project Structure

### Documentation (this feature)

```text
specs/008-project-centric-analysis/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   ├── project.py                    # NEW: Project model
│   │   ├── competitor.py                 # NEW: Competitor model
│   │   └── url_analysis.py               # EDIT: add nullable project_id FK
│   ├── schemas/
│   │   └── project.py                     # NEW: ProjectCreate/Update/Response,
│   │                                       #      CompetitorCreate/Response, project-analysis list schema
│   ├── services/
│   │   └── project_service.py             # NEW: CRUD + attach/reassign/remove-analysis + Smart Search orchestration
│   ├── agents/
│   │   └── competitor_agent.py            # NEW: single-shot LLM agent (matches entity_agent.py's shape)
│   └── api/
│       └── projects.py                    # NEW: /api/v1/projects router
├── migrations/versions/
│   └── 006_projects_competitors.py        # NEW: create projects, competitors; add url_analyses.project_id
└── tests/
    └── unit/
        ├── test_project_service.py         # NEW
        └── test_competitor_agent.py        # NEW

frontend/
├── src/
│   ├── shared/
│   │   ├── types/index.ts                  # EDIT: Project/Competitor types now mirror backend shape;
│   │   │                                     #      drop client-only Project fields no longer meaningful
│   │   └── store/useAppStore.ts             # EDIT: remove projects/createProject/addTargetToProject/
│   │                                         #      removeTargetFromProject (superseded by API-backed hooks)
│   ├── shared/realtime/
│   │   ├── AnalysisService.ts               # EDIT: replace client-store project methods with API-backed ones
│   │   ├── AnalysisApiService.ts            # EDIT: same
│   │   └── MockAnalysisService.ts           # EDIT: same (mock returns fixture data instead of hitting apiClient)
│   ├── features/projects/
│   │   ├── hooks/useProjects.ts             # EDIT: fetch from GET /projects instead of the store
│   │   ├── hooks/useProjectDetail.ts        # EDIT: fetch from GET /projects/{id} + GET /projects/{id}/analyses
│   │   ├── components/ProjectForm.tsx        # EDIT: add category/geography/competitor-list fields
│   │   ├── components/CompetitorListEditor.tsx  # NEW: repeatable {url, description} list + Smart Search button
│   │   └── components/ProjectAnalysisHistory.tsx # NEW: renders persisted before/after per analysis
│   └── app/
│       ├── projects/[projectId]/page.tsx     # EDIT: render history from the new persisted-data hook
│       └── runs/[runId]/page.tsx             # EDIT: surface "Add analysis to a project" once complete
└── tests/
    └── unit/
        └── projectForm.test.tsx              # NEW (or extend an existing project test file)
```

**Structure Decision**: Web application, both `backend/` and `frontend/` touched. Backend follows the existing model → schema → service → router layering exactly as `url_analysis`/`url_optimization` already do (see research.md §2). Frontend replaces the client-only `Project` slice of `useAppStore` with API-backed hooks, following the existing `apiClient.get/post/patch/delete` convention already used for `/ingest`, `/analyze`, `/optimize` (see research.md §5).

## Complexity Tracking

*No Constitution Check violations — table not applicable.*
