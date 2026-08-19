# Implementation Plan: Remove Automations Feature

**Branch**: `006-remove-automations` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-remove-automations/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Fully withdraw the automations feature (recurring re-check scheduling) from the frontend: remove its route, nav entry, feature module (components/hooks/lib), the `Automation`/`Recurrence` types and store slice, the `createAutomation`/`setAutomationActive`/`deleteAutomation`/`triggerAutomationNow` service methods on both `AnalysisApiService` and `MockAnalysisService`, the now-pointless `RunTrigger`/`triggeredBy` distinction on `AnalysisRun`, its embedded UI in the target-history and project-detail pages, its dedicated tests, and its mentions in active docs (README). No backend or persistence-layer work is involved — automations never had a backend endpoint or a scheduler, and its data was session-only in-memory state, so this is a pure code-deletion change with no data migration.

## Technical Context

**Language/Version**: TypeScript (strict mode), Next.js App Router, React

**Primary Dependencies**: Next.js, Zustand (client store), Vitest + React Testing Library (unit/integration tests), Playwright (e2e, if exercised for nav)

**Storage**: N/A — automations state was in-memory only (`useAppStore`, no `persist` middleware); nothing durable to migrate or clean up

**Testing**: Vitest + React Testing Library for the removed unit/integration tests; frontend build (`tsc`/`next build`) as the primary "no dangling references" check

**Target Platform**: Web (browser), Next.js frontend app

**Project Type**: Web application (frontend + backend repo layout) — this feature touches **frontend only**; backend is unaffected (confirmed via repo-wide search: no backend endpoint, model, or scheduler references automations)

**Performance Goals**: N/A — no performance targets for a removal; must not regress existing page load/interaction behavior on the touched screens (history, project detail, nav)

**Constraints**: No backend changes; no data migration; must not alter unrelated behavior on shared screens (target history, project detail, global nav) beyond removing the automation-specific UI; existing non-automation tests must keep passing

**Scale/Scope**: One self-contained feature module (`frontend/src/features/automations/**`, 5 files) plus ~10 touch points across app routes, shared store, shared types, shared realtime services, global nav, and 4 test files (2 deleted outright, 2 with an incidental fixture line each)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no ratified project-specific principles). No project-specific gates apply. General simplicity/YAGNI practice applies by default: this change is a net simplification (deletes code, adds none), so it trivially satisfies it. No violations to track in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-remove-automations/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Web application (frontend + backend). This feature touches frontend/ only —
# backend/ has no automation references and is not modified.

frontend/
├── src/
│   ├── app/
│   │   ├── automations/page.tsx                       # DELETE (whole route)
│   │   ├── targets/[targetId]/history/page.tsx         # EDIT: drop schedule/list UI + imports
│   │   └── projects/[projectId]/page.tsx                # EDIT: drop the automations hint line
│   ├── features/
│   │   └── automations/                                 # DELETE (whole module)
│   │       ├── components/AutomationList.tsx
│   │       ├── components/RecurrenceSummary.tsx
│   │       ├── components/ScheduleForm.tsx
│   │       ├── hooks/useAutomations.ts
│   │       └── lib/recurrence.ts
│   └── shared/
│       ├── components/ResponsiveNav.tsx                 # EDIT: drop nav entry
│       ├── store/useAppStore.ts                          # EDIT: drop automations slice/actions
│       ├── types/index.ts                                # EDIT: drop Automation/Recurrence/
│       │                                                  #        RecurrenceFrequency/RunTrigger types,
│       │                                                  #        AnalysisRun.triggeredBy field
│       └── realtime/
│           ├── AnalysisService.ts                        # EDIT: drop automation methods from interface
│           ├── AnalysisApiService.ts                      # EDIT: drop automation methods + import
│           └── MockAnalysisService.ts                     # EDIT: drop automation methods + import
└── tests/
    ├── integration/schedule-automation.test.tsx          # DELETE
    ├── unit/recurrence.test.ts                             # DELETE
    ├── integration/submit-analysis.test.tsx                # EDIT: drop `automations: {}` from fixture
    ├── integration/create-project-detect-shared-issue.test.tsx  # EDIT: drop `automations: {}` +
    │                                                          #        `triggeredBy` from fixtures
    └── unit/sharedIssues.test.ts                            # EDIT: drop `triggeredBy` from fixture

README.md                                                  # EDIT: drop Automations bullet, nav-tree
                                                             #       entries, and doc-flow mention
```

**Structure Decision**: Single-package removal scoped entirely to `frontend/`. No `backend/` changes (verified: zero automation references in `backend/`). Existing web-app layout (`frontend/` + `backend/`) is unchanged; this feature only deletes files/lines within it.

## Complexity Tracking

*No Constitution Check violations — table not applicable.*
