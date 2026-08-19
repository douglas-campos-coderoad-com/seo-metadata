# Implementation Plan: Project & Analysis UX Improvements

**Branch**: `009-project-analysis-ux` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-project-analysis-ux/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Five UX changes to the project/analysis flows built in specs/008: (1) the "add analysis to a project" action becomes a real modal instead of inline page content; (2) the Projects page gates its creation form behind a "Create Project" button; (3) the "shared issues" panel is removed from the project page only; (4) each project-history entry gets a "View" action that opens a fully-hydrated version of the results page for that specific historical analysis, re-using persisted before/after data rather than re-triggering optimization; (5) that historical view shows its owning project as a clickable label. The hardest piece is (4): the existing `/runs/[runId]` page and `BeforeAfterViewer` are built entirely around a client-session-only run record (`useAppStore`) and a "click to optimize" flow that always POSTs a *new* optimization — neither fits re-displaying an already-persisted historical result without triggering unwanted side effects. See research.md §1-§3 for how this is reconciled.

## Technical Context

**Language/Version**: TypeScript strict mode (frontend, Next.js App Router); Python 3.12+ (backend, FastAPI) — only where a new single-analysis-by-id read endpoint is needed

**Primary Dependencies**: No new dependencies. A lightweight custom `Modal` component is added to the existing UI kit (`frontend/src/shared/components/ui/`) rather than pulling in a dialog library — see research.md §4.

**Storage**: No schema change. FR-007 explicitly forbids touching the underlying data; the one new backend read endpoint (research.md §2) queries existing `specs/008` tables as-is.

**Testing**: Vitest + React Testing Library (frontend); pytest (backend, for the one new endpoint)

**Target Platform**: Web (browser), existing Next.js frontend + FastAPI backend

**Project Type**: Web application — this feature touches mostly `frontend/`, plus one small, additive backend endpoint

**Performance Goals**: N/A beyond existing expectations — viewing history must not feel slower than the app's other page loads

**Constraints**: Must not alter `useOptimize`'s existing "click to optimize" behavior for a live, just-completed run (only *add* a way to render already-persisted optimization data without POSTing a new one); FR-007 forbids any backend/data change tied to shared-issues removal; FR-012 requires the original historical entry to be provably unmodified by a re-run

**Scale/Scope**: One new backend endpoint, one new frontend route, one new shared `Modal` component, edits to ~6 existing components/pages, no new persisted entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no ratified project-specific principles). No project-specific gates apply. This feature is UX-focused and additive/subtractive at the presentation layer only (one new component, one new endpoint, no new persisted entities), so it trivially satisfies general simplicity practice. No violations to track in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/009-project-analysis-ux/
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
│   ├── api/projects.py                        # EDIT: add GET /projects/{id}/analyses/{analysis_id}
│   └── services/project_service.py             # EDIT: expose single-analysis-with-ownership-check read
│                                                #       (reuses the existing _get_analysis_with_relations
│                                                #       helper from specs/008, adds a project_id check)
└── tests/test_project_service.py                # EDIT: tests for the new single-analysis read

frontend/
├── src/
│   ├── shared/components/ui/modal.tsx           # NEW: lightweight overlay/backdrop/panel component
│   ├── shared/realtime/
│   │   ├── AnalysisApiService.ts                # EDIT: add getAnalysis(projectId, analysisId)
│   │   └── AnalysisService.ts                   # EDIT: interface signature for the above
│   ├── features/analysis/
│   │   ├── hooks/useOptimize.ts                 # EDIT: add a GET-only "load existing" path alongside
│   │   │                                        #       the existing POST-triggered "run" path
│   │   └── components/BeforeAfterViewer.tsx      # EDIT: accept optional pre-loaded before/after data,
│   │                                              #       skipping the "click to optimize" trigger when present
│   ├── features/projects/
│   │   ├── components/AddToProjectAction.tsx     # EDIT: render its existing content inside the new Modal
│   │   ├── components/ProjectAnalysisHistory.tsx # EDIT: add a "View" action per entry
│   │   └── components/ProjectLabelLink.tsx       # NEW: small clickable project-name component
│   └── app/
│       ├── projects/page.tsx                     # EDIT: gate the creation form behind a button
│       ├── projects/[projectId]/page.tsx          # EDIT: drop the SharedIssuesPanel section
│       └── runs/history/[projectId]/[analysisId]/page.tsx
│                                                  # NEW: the re-hydrated historical results view
└── tests/
    └── unit/                                       # EDIT/NEW: coverage for the new Modal, the history
                                                      #           view's data-loading, and re-run-preserves-history
```

**Structure Decision**: Web application; this feature is almost entirely `frontend/`, plus one small additive backend endpoint (no schema change). The historical view is a **new route** (`/runs/history/[projectId]/[analysisId]`) rather than overloading the existing `/runs/[runId]` route — see research.md §3 for why.

## Complexity Tracking

*No Constitution Check violations — table not applicable.*
