# Implementation Plan: SEO Analyzer Application

**Branch**: `003-seo-analyzer-frontend` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-seo-analyzer-frontend/spec.md`

## Summary

Replace the InCollect marketplace frontend with a new SEO Analyzer application: users submit a static-page URL, watch a live-updating analysis run, and get a 0–100 score with categorized, color-coded findings (meta tags, content, HTML structure, file size) and copy-paste code fixes. URLs can be grouped into Projects to surface issues shared across pages, every target keeps a historical timeline of runs, and Projects/URLs can carry recurring "automation" schedules. Since no real backend exists yet, this phase builds the full UI against a mocked, backend-agnostic service layer (TypeScript fixture data + a simulated real-time status channel) so a real backend can be swapped in later without UI changes. Built with a feature-based frontend architecture on the existing Next.js + TypeScript + Tailwind stack, adding daisyUI for the component layer.

## Technical Context

**Language/Version**: TypeScript (strict mode, already enabled), Next.js 15 (App Router), React 18

**Primary Dependencies**:
- Existing: Next.js, React, Tailwind CSS 3.3 (already configured in `frontend/`)
- New (current — see research.md §1): **shadcn/ui-pattern primitives**, hand-built in `shared/components/ui/` using `class-variance-authority`, `clsx` + `tailwind-merge` (`cn()`), `lucide-react` icons, and `@radix-ui/react-slot` for `Button`'s `asChild`. CSS-variable theme tokens drive both light/dark and an app-specific success/warning severity palette.
- Superseded: **daisyUI** was the original v4 Tailwind plugin choice for Phases 1–7; replaced mid-Phase 8 per explicit user request (see research.md §1 for the full migration rationale).
- New: **Zustand** (~1KB state library) for the shared, session-scoped application store — chosen over React Context because several screens subscribe to independently-updating, concurrently-running Analysis Runs (FR-003), and Zustand's selector-based subscriptions avoid whole-tree re-renders on every status tick; it also keeps cross-feature state access simple as more features are added, matching the "simple, easy to scale" requirement
- No charting library: FR-019 only requires a dated list of score data points (not a trend line/graph), satisfied by a hand-built bordered run list — avoids an unnecessary dependency
- No calendar/cron library: the "calendar-friendly" automation scheduler (FR-021) is a small internal recurrence model (frequency + time + weekday/day-of-month) rendered with native `<input type="time">` plus the shadcn-style `Select`/`Input` — sufficient for the mocked scope, avoids a heavy scheduling dependency
- No Radix Select: the app's two `<select>` usages (frequency, weekday) are short static option lists — a styled native `<select>` (see `shared/components/ui/select.tsx`) covers them without adding `@radix-ui/react-select`

**Storage**: None (browser or server). Per spec Clarifications, all application data (Projects, Analysis Targets, Runs, Findings, Automations) is **session-scoped, in-memory only** — held in the Zustand store for the lifetime of the page session and reset on full reload. No localStorage/IndexedDB/cookies and no real backend/database in this phase.

**Testing**: Vitest + React Testing Library (unit/integration, already configured), Playwright (e2e, already configured)

**Target Platform**: Web — responsive across desktop and mobile viewports (FR-026); no formal accessibility standard required this phase (baseline semantic HTML only, per Clarifications)

**Project Type**: Frontend-only web application. No backend work is in scope for this feature — the "backend" is entirely a mocked service layer inside the frontend codebase, designed behind an interface so a real backend (e.g., the one implied by `specs/002-url-ingestion/`) can implement the same contract later (FR-005).

**Performance Goals**: No hard backend-latency SLOs (there is no real backend). The UI must stay responsive with multiple concurrently-running simulated analyses in view at once (FR-003/FR-015) and must not block the main thread during simulated status ticks.

**Constraints**:
- All backend interaction is mocked via TypeScript fixture data and a simulated push-based status channel (Clarifications; user-specified "socket"-style updates, agnostic service layer)
- Data does not persist across a full page reload (session-scoped only)
- No authentication / multi-user separation (single implicit workspace)
- No formal accessibility (WCAG) gate in this phase

**Scale/Scope**: Single workspace; Projects may contain many URLs (edge case calls out 50+) and the shared-issue view must stay readable at that scale (see Edge Cases in spec.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` has not been ratified for this project — it still contains the unfilled template placeholders (no concrete principles, no version). There are therefore no binding constitutional gates to evaluate against for this feature.

**Gate Status**: N/A — no ratified constitution. Recommend running `/speckit-constitution` separately if the team wants enforceable project-wide principles (e.g., testing bar, accessibility policy) going forward; until then this plan proceeds using the reasonable defaults and constraints already resolved in `spec.md`'s Clarifications/Assumptions.

**Post-Phase-1 re-check**: No new dependencies or decisions introduced during Phase 1 design (data-model.md, contracts/, quickstart.md) change this — still N/A, no violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/003-seo-analyzer-frontend/
├── spec.md               # Feature specification (/speckit-specify + /speckit-clarify output)
├── plan.md                # This file (/speckit-plan output)
├── research.md            # Phase 0 output (generated below)
├── data-model.md          # Phase 1 output (generated below)
├── contracts/             # Phase 1 output (generated below)
│   ├── analysis-service.md    # Mocked/agnostic analysis service interface contract
│   └── realtime-events.md     # Live status event shape contract
├── quickstart.md          # Phase 1 output (generated below)
├── checklists/
│   └── requirements.md    # Quality checklist (from /speckit-specify, re-validated by /speckit-clarify)
└── tasks.md                # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root) — Frontend-only feature, existing monorepo

**Structure Decision**: This feature lives entirely under the existing `frontend/` Next.js app. It **replaces** the marketplace-oriented tree from `specs/001-catalog-discovery/` (`app/browse/*`, `components/BrowseGallery.tsx`, `ItemCard.tsx`, `ItemDetail.tsx`, `ItemFilters.tsx`, `lib/hooks/useItems.ts`/`useCategories.ts`/`usePeriods.ts`) — those files are removed/repurposed, not extended. The new code follows a **feature-based architecture**: `src/app/` stays a thin routing layer, each product capability owns its own vertical slice under `src/features/<name>/`, and only truly cross-cutting code lives in `src/shared/`.

```text
frontend/
├── src/
│   ├── app/                             # Next.js App Router — routing/composition only
│   │   ├── layout.tsx                   # Root layout (theme CSS variables via globals.css, nav shell)
│   │   ├── page.tsx                     # Landing page (P5) — renders features/landing
│   │   ├── analyze/
│   │   │   └── page.tsx                 # Standalone single-URL analysis (P1)
│   │   ├── runs/[runId]/
│   │   │   └── page.tsx                 # Results view for one Analysis Run
│   │   ├── projects/
│   │   │   ├── page.tsx                 # Projects list (P2)
│   │   │   └── [projectId]/
│   │   │       └── page.tsx             # Project detail: URLs, shared issues, automation
│   │   ├── targets/[targetId]/
│   │   │   └── history/page.tsx         # Per-URL historical timeline (P3)
│   │   └── automations/
│   │       └── page.tsx                 # Cross-project automations overview (P4)
│   │
│   ├── features/                        # One folder per user-facing capability
│   │   ├── analysis/                    # P1: submit URL, live status, results rendering
│   │   │   ├── components/              # UrlSubmitForm, LiveStatusTracker, ScoreSummary, FindingsList, CodeSnippetCard
│   │   │   ├── hooks/                   # useStartAnalysis, useRunStatus
│   │   │   ├── mocks/                   # TS fixture findings/scoring templates
│   │   │   └── types.ts
│   │   ├── projects/                    # P2: project CRUD, shared-issue detection
│   │   │   ├── components/              # ProjectForm, ProjectUrlList, SharedIssuesPanel
│   │   │   ├── hooks/
│   │   │   └── mocks/
│   │   ├── history/                     # P3: timeline views (target + project level)
│   │   │   ├── components/              # RunTimeline, RunSnapshotView
│   │   │   └── hooks/
│   │   ├── automations/                 # P4: scheduling UI + simulated triggers
│   │   │   ├── components/              # ScheduleForm, AutomationList, RecurrenceSummary
│   │   │   ├── hooks/
│   │   │   └── lib/                     # recurrence-rule helpers (human-readable formatting)
│   │   └── landing/                     # P5: marketing/entry content
│   │       └── components/
│   │
│   ├── shared/                          # Cross-feature primitives only
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn/ui-pattern primitives: Button, Badge, Card, Input, Label, Select, Alert
│   │   │   ├── AppShell, SeverityBadge, ScoreRadial, ResponsiveNav, Spinner
│   │   ├── realtime/                    # AnalysisService interface + MockAnalysisService (event-bus based)
│   │   ├── store/                       # Zustand store: targets, runs, projects, automations (session-scoped)
│   │   ├── lib/                         # url validation, severity/color-range mapping, cn() class merge, date formatting
│   │   └── types/                       # Cross-feature entity types (mirrors data-model.md)
│   │
│   └── styles/
│       └── globals.css                  # Tailwind base + CSS variable theme tokens (shadcn/ui convention)
│
├── tests/
│   ├── unit/                            # Vitest, mirrors src/features/*/(components|hooks|lib)
│   ├── integration/                     # RTL: submit-analysis, create-project-detect-shared-issue, schedule-automation
│   └── e2e/                             # Playwright: P1 golden path, P2 shared-issue flow, mobile-viewport smoke check
│
├── package.json                          # + daisyui, zustand
├── tailwind.config.js                    # + daisyui plugin, content globs extended to src/features/**
├── tsconfig.json                         # unchanged (strict mode, @/* path alias already present)
└── next.config.js                        # unchanged
```

### Key Design Decisions

1. **Feature-based architecture**: each capability (`analysis`, `projects`, `history`, `automations`, `landing`) is a self-contained vertical slice (components + hooks + mocks/lib). `src/app/` route files are thin and only compose feature components — adding a new capability later means adding a new `features/<name>/` folder without touching existing ones.
2. **Backend-agnostic service interface (FR-005)**: `shared/realtime/AnalysisService` defines the contract (`startAnalysis(url, projectId?)`, `subscribeToRun(runId, onEvent)`, `listRuns(targetId)`, …). `MockAnalysisService` is the only implementation in this phase, backed by `features/*/mocks` fixture data and an in-memory event bus that emits the same event shape a real push channel would (see `contracts/realtime-events.md`). A future `RealAnalysisService` (WebSocket/SSE-backed, talking to the real backend) can implement the identical interface with no UI changes.
3. **Simulated real-time channel**: implemented with the native `EventTarget`/event-emitter pattern (no external socket library needed) — `MockAnalysisService.startAnalysis()` schedules status transitions (`queued → fetching → analyzing → complete|failed`) via `setTimeout`, emitting events subscribers consume exactly like a real push channel.
4. **Session-scoped state via Zustand**: one store holds Analysis Targets, Runs, Findings, Projects, and Automations, keyed by id; nothing is written to any persistent browser storage, matching the Clarifications decision that a full reload resets everything.
5. **Global URL identity**: the store's target-creation logic normalizes and upserts by URL string, so adding an already-known URL (standalone or in a second project) always resolves to the same `AnalysisTarget` and its one shared run history (per Clarifications) — never a duplicate.
6. **Centralized severity/color mapping**: one utility (`shared/lib/severity.ts`) maps a score or finding severity to a color-range consistently everywhere (FR-007), instead of ad hoc classes per component.
7. **Concurrency-first run tracking**: each Analysis Run is tracked independently in the store by run id; the analyze/project UI can render N live status trackers simultaneously (FR-003, FR-015) since Zustand selectors let each tracker component subscribe only to its own run.
8. **shadcn/ui-pattern component mapping**: hand-built `ScoreRadial` (SVG circle) → overall score (FR-006); `Badge`/`Alert` variants (success/warning/destructive) → severity color ranges (FR-007); hand-built bordered run list in `RunTimeline` → history views (FR-019) and automation schedule display; styled `<pre>` + `Button` copy control → code snippets (FR-012); a plain numbered-circle row in `LiveStatusTracker` → live-status progress.
9. **Testing strategy**: Vitest+RTL cover feature-level logic (mock service transitions, severity mapping, shared-issue detection, recurrence formatting) and component rendering; Playwright covers the P1 golden path (submit → live status → results), a P2 project/shared-issue scenario, and a mobile-viewport smoke pass (SC-006).

## Complexity Tracking

*No constitution gates apply (see Constitution Check) and no complexity deviations are being introduced beyond what's justified above (Zustand, plus the small shadcn/ui-supporting dependency set: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`; daisyUI was removed during the mid-Phase-8 migration). Nothing to track here.*
