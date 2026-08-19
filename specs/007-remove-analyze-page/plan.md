# Implementation Plan: Remove Analyze Page

**Branch**: `007-remove-analyze-page` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-remove-analyze-page/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Remove the standalone `/analyze` page and its "Analyze" navbar entry, since the home page (`/`) already contains the identical URL-submission flow (submit form → live status → results redirect). Update the two e2e tests that currently open `/analyze` directly to exercise the same journey via `/`, drop the one README line that lists the route, and confirm the backend's unrelated `/analyze/{id}` API endpoint is untouched. Per the resolved clarification, `RecentTargetsList` (the page's "recently analyzed" list) is preserved in the codebase but deliberately left unmounted — not deleted, not moved onto the home page.

## Technical Context

**Language/Version**: TypeScript (strict mode), Next.js App Router, React

**Primary Dependencies**: Next.js, Playwright (e2e tests being updated)

**Storage**: N/A — no data model involved; this only removes a page/nav entry

**Testing**: Playwright e2e (`tests/e2e/golden-path.spec.ts`) is the only test suite touching this page; Vitest unit/integration suite has no automations-style dedicated tests for `/analyze` to remove

**Target Platform**: Web (browser), Next.js frontend app

**Project Type**: Web application (frontend + backend repo layout) — frontend only; the backend's `/analyze/{id}` REST endpoint is a separate, unrelated concept and is explicitly out of scope (spec FR-006)

**Performance Goals**: N/A — no performance targets for a removal; the home page must keep behaving exactly as it does today

**Constraints**: No backend changes; `RecentTargetsList` must be preserved (not deleted) but must not be rendered anywhere as part of this change; e2e coverage of the submit-URL journey must not be lost, only re-pointed at `/`

**Scale/Scope**: One route directory deleted (`app/analyze/`), one nav entry removed, one e2e spec file updated (2 tests), one README line updated — the smallest of the three removals done in this repo so far

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no ratified project-specific principles). No project-specific gates apply. This change is a net simplification (deletes a duplicate page, adds no new code) and preserves an explicitly-requested component per the resolved clarification, so it trivially satisfies general simplicity/YAGNI practice. No violations to track in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-remove-analyze-page/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no interface contract change (unlike the automations removal, no service-layer method is added or removed — only a page, a nav entry, and test/doc references).

### Source Code (repository root)

```text
# Web application (frontend + backend). This feature touches frontend/ only —
# backend/ is not modified (its /analyze/{id} REST endpoint is unrelated).

frontend/
├── src/
│   ├── app/
│   │   └── analyze/page.tsx                     # DELETE (whole route)
│   └── shared/
│       └── components/ResponsiveNav.tsx          # EDIT: drop the Analyze nav entry
├── tests/
│   └── e2e/golden-path.spec.ts                    # EDIT: point both tests at '/' instead of '/analyze'
└── (unchanged) src/features/history/components/RecentTargetsList.tsx
                                                     # PRESERVED, left unmounted — no code change,
                                                     # its only import (from the deleted page) goes
                                                     # away automatically with the page deletion

README.md                                          # EDIT: drop `analyze` from the app-tree ASCII block
```

**Structure Decision**: Single-package removal scoped entirely to `frontend/`. No `backend/` changes. Existing web-app layout (`frontend/` + `backend/`) is unchanged; this feature only deletes one route file, edits two other files, and updates one doc line.

## Complexity Tracking

*No Constitution Check violations — table not applicable.*
