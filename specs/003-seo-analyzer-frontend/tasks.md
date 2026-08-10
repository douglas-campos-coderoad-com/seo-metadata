# Tasks: SEO Analyzer Application

**Input**: Design documents from `specs/003-seo-analyzer-frontend/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not explicitly requested in the feature spec. Dedicated test-writing tasks are limited to the Polish phase (backing the checks already described in `quickstart.md`), not embedded per-story as TDD gates.

**Organization**: Tasks are grouped by user story (P1–P5 from spec.md) to enable independent implementation and testing of each story. All paths are relative to `frontend/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paths follow the feature-based structure defined in `plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new dependencies, remove the superseded marketplace code, scaffold the feature-based structure.

- [X] T001 Add `daisyui` and `zustand` to `frontend/package.json` and run `npm install` in `frontend/`
- [X] T002 [P] Configure daisyUI as a Tailwind plugin and extend content globs to include `src/features/**` in `frontend/tailwind.config.js` (depends on T001)
- [X] T003 [P] Remove the superseded marketplace frontend code per `plan.md`'s Structure Decision: `frontend/src/app/browse/`, `frontend/src/components/BrowseGallery.tsx`, `ItemCard.tsx`, `ItemDetail.tsx`, `ItemFilters.tsx`, `frontend/src/lib/hooks/useItems.ts`, `useCategories.ts`, `usePeriods.ts`
- [X] T004 [P] Create the feature-based directory skeleton: `frontend/src/features/{analysis,projects,history,automations,landing}/{components,hooks}` and `frontend/src/shared/{components,realtime,store,lib,types}` per `plan.md` Project Structure
- [X] T005 Update root layout in `frontend/src/app/layout.tsx`: replace InCollect marketplace metadata/title with the SEO Analyzer app shell, apply daisyUI theme root (depends on T002, T004)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, service interface, mock implementation, and store that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Define shared entity types (`AnalysisTarget`, `Project`, `AnalysisRun`, `Finding`, `SharedIssue`, `Automation`) in `frontend/src/shared/types/index.ts` per `data-model.md`
- [X] T007 [P] Implement severity/color-range mapping utility in `frontend/src/shared/lib/severity.ts` (FR-007)
- [X] T008 [P] Implement URL normalization/validation utility in `frontend/src/shared/lib/url.ts` (FR-002; normalization is the uniqueness key per `data-model.md` AnalysisTarget)
- [X] T009 [P] Define `RunStatusEvent` types in `frontend/src/shared/realtime/events.ts` per `contracts/realtime-events.md`
- [X] T010 [P] Define the `AnalysisService` interface in `frontend/src/shared/realtime/AnalysisService.ts` per `contracts/analysis-service.md` (depends on T006, T009)
- [X] T011 Create the session-scoped Zustand store (`targets`, `runs`, `projects`, `automations`) in `frontend/src/shared/store/useAppStore.ts` per `data-model.md`, enforcing the global-URL-identity upsert rule; no persistence middleware (in-memory only, per Clarifications) (depends on T006, T008)
- [X] T012 Implement `MockAnalysisService` (base: `startAnalysis`/`subscribeToRun`/`getRun`/`listRuns` only) using an `EventTarget`-based simulated channel with `setTimeout`-driven `queued→fetching→analyzing→complete|failed` transitions and a simulated connection-lost path, in `frontend/src/shared/realtime/MockAnalysisService.ts`, implementing `AnalysisService` and wired to `useAppStore` (depends on T010, T011)
- [X] T013 [P] Implement shared UI primitives — `ScoreRadial`, `SeverityBadge`, `ResponsiveNav`, `AppShell` (daisyUI-based) — in `frontend/src/shared/components/`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Analyze a Single URL (Priority: P1) 🎯 MVP

**Goal**: A user submits a URL, watches live analysis progress, and sees a full results view (score, categorized color-coded findings, copy-paste code snippets) without needing a project.

**Independent Test**: Submit one URL with no project selected; watch status update queued → running → complete; verify the results view renders a score, color-coded findings by category, and at least one copyable code suggestion.

### Implementation for User Story 1

- [X] T014 [P] [US1] Create mock finding fixture templates (meta-tags, content, html-structure, file-size categories; varied severities including missing-element cases) in `frontend/src/features/analysis/mocks/findings.ts` per `data-model.md` Finding
- [X] T015 [P] [US1] Create mock scoring/failure scenario logic (deterministic per submitted URL; invalid/unreachable/unsupported-content-type failure reasons) in `frontend/src/features/analysis/mocks/scenarios.ts` per `contracts/analysis-service.md` failure behavior
- [X] T016 [US1] Wire the findings/scoring fixtures into `startAnalysis`'s simulated run outcome in `frontend/src/shared/realtime/MockAnalysisService.ts` (depends on T012, T014, T015)
- [X] T017 [P] [US1] Implement `useStartAnalysis` hook in `frontend/src/features/analysis/hooks/useStartAnalysis.ts`
- [X] T018 [P] [US1] Implement `useRunStatus` hook (subscribes via `AnalysisService.subscribeToRun`) in `frontend/src/features/analysis/hooks/useRunStatus.ts`
- [X] T019 [P] [US1] Implement `UrlSubmitForm` component with client-side URL validation (FR-002) in `frontend/src/features/analysis/components/UrlSubmitForm.tsx`
- [X] T020 [P] [US1] Implement `LiveStatusTracker` component covering all statuses plus the connection-lost/recovery UI (FR-004) in `frontend/src/features/analysis/components/LiveStatusTracker.tsx`
- [X] T021 [P] [US1] Implement `ScoreSummary` component (daisyUI `radial-progress`, FR-006) in `frontend/src/features/analysis/components/ScoreSummary.tsx`
- [X] T022 [P] [US1] Implement `FindingsList`/`FindingCard` components (grouped by category, severity color via `shared/lib/severity.ts`, missing-element flagging) in `frontend/src/features/analysis/components/FindingsList.tsx` and `FindingCard.tsx`
- [X] T023 [P] [US1] Implement `CodeSnippetCard` component (daisyUI `mockup-code` + copy-to-clipboard control, FR-012) in `frontend/src/features/analysis/components/CodeSnippetCard.tsx`
- [X] T024 [US1] Implement the standalone analyze page composing `UrlSubmitForm` + `LiveStatusTracker` in `frontend/src/app/analyze/page.tsx` (depends on T017, T019, T020)
- [X] T025 [US1] Implement the results page composing `ScoreSummary` + `FindingsList` + `CodeSnippetCard` in `frontend/src/app/runs/[runId]/page.tsx` (depends on T018, T021, T022, T023)

**Checkpoint**: User Story 1 is fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Organize URLs into Projects and Spot Shared Issues (Priority: P2)

**Goal**: A user groups URLs into a project, runs analysis across them concurrently, and sees findings that recur across two or more URLs surfaced as shared/systemic issues.

**Independent Test**: Create a project, add 2+ URLs, run analysis on each, verify a cross-URL view highlights findings appearing on more than one URL — independent of history/automation features.

### Implementation for User Story 2

- [X] T026 [US2] Add `createProject`/`addTargetToProject`/`removeTargetFromProject` to `frontend/src/shared/realtime/MockAnalysisService.ts`, using the global-identity upsert rule from `useAppStore` (depends on T012, T011)
- [X] T027 [P] [US2] Implement shared-issue computation (group findings by category+title across a project's targets' latest completed runs, filter to count ≥ 2) in `frontend/src/shared/lib/sharedIssues.ts` per `data-model.md` SharedIssue
- [X] T028 [US2] Add `listSharedIssues` to `frontend/src/shared/realtime/MockAnalysisService.ts` using T027 (depends on T026, T027)
- [X] T029 [P] [US2] Implement `useProjects` hook (list/create) in `frontend/src/features/projects/hooks/useProjects.ts`
- [X] T030 [P] [US2] Implement `useProjectDetail` hook (target list, shared issues, trigger concurrent analyses across a project's URLs) in `frontend/src/features/projects/hooks/useProjectDetail.ts`
- [X] T031 [P] [US2] Implement `ProjectForm` component in `frontend/src/features/projects/components/ProjectForm.tsx`
- [X] T032 [P] [US2] Implement `ProjectUrlList` component (per-URL latest status, add/remove URL, empty-state guidance) in `frontend/src/features/projects/components/ProjectUrlList.tsx`
- [X] T033 [P] [US2] Implement `SharedIssuesPanel` component (visually distinct from single-page findings) in `frontend/src/features/projects/components/SharedIssuesPanel.tsx`
- [X] T034 [US2] Implement the projects list page in `frontend/src/app/projects/page.tsx` (depends on T029, T031)
- [X] T035 [US2] Implement the project detail page composing `ProjectUrlList` + `SharedIssuesPanel` + concurrent `LiveStatusTracker` instances per in-flight run in `frontend/src/app/projects/[projectId]/page.tsx` (depends on T030, T032, T033, T020)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Review Historical Trends Over Time (Priority: P3)

**Goal**: A user opens a previously analyzed URL (standalone or in a project) and sees a timeline of past runs, each viewable in full as it was captured.

**Independent Test**: Run analysis on the same URL twice; verify both runs appear as distinct timeline points, viewable independent of any scheduling feature.

### Implementation for User Story 3

- [X] T036 [P] [US3] Implement `useTargetHistory` hook (wraps `AnalysisService.listRuns`) in `frontend/src/features/history/hooks/useTargetHistory.ts`
- [X] T037 [P] [US3] Implement `RunTimeline` component (daisyUI `timeline`, dated points with score/status, single-point case handled per spec Acceptance Scenario 4) in `frontend/src/features/history/components/RunTimeline.tsx`
- [X] T038 [P] [US3] Implement `RunSnapshotView` component reusing `ScoreSummary`/`FindingsList` from US1 to render one past run's full results in `frontend/src/features/history/components/RunSnapshotView.tsx`
- [X] T039 [US3] Implement the per-target history page in `frontend/src/app/targets/[targetId]/history/page.tsx` (depends on T036, T037, T038)
- [X] T040 [US3] Implement `ProjectHistorySummary` component (how a project's shared issues have changed across runs over time) and link it from the project detail page in `frontend/src/features/history/components/ProjectHistorySummary.tsx` (depends on T027, T035)

**Checkpoint**: User Stories 1–3 all work independently.

---

## Phase 6: User Story 4 - Schedule Recurring Analyses (Automations) (Priority: P4)

**Goal**: A user sets up a recurring schedule on a project or URL; the schedule displays in plain language and feeds new runs into the same history timeline.

**Independent Test**: Configure a recurring schedule; verify it's saved, shown in human-readable form, and can be edited/canceled — independent of whether a real trigger engine exists.

### Implementation for User Story 4

- [X] T041 [P] [US4] Implement the internal recurrence rule model and human-readable formatter (e.g., "Every Monday at 9:00 AM") in `frontend/src/features/automations/lib/recurrence.ts` per `research.md` §5
- [X] T042 [US4] Add `createAutomation`/`setAutomationActive`/`deleteAutomation` plus simulated scheduled-trigger execution (creates an `AnalysisRun` with `triggeredBy: 'automation'`, appended to the same target history) to `frontend/src/shared/realtime/MockAnalysisService.ts` (depends on T026, T041)
- [X] T043 [P] [US4] Implement `useAutomations` hook in `frontend/src/features/automations/hooks/useAutomations.ts`
- [X] T044 [P] [US4] Implement `ScheduleForm` component (daisyUI `steps` + native date/time inputs) in `frontend/src/features/automations/components/ScheduleForm.tsx`
- [X] T045 [P] [US4] Implement `AutomationList` and `RecurrenceSummary` components (active/paused state, last-run/next-run times) in `frontend/src/features/automations/components/AutomationList.tsx` and `RecurrenceSummary.tsx`
- [X] T046 [US4] Implement the automations overview page in `frontend/src/app/automations/page.tsx` (depends on T043, T045)
- [X] T047 [US4] Add automation setup entry points to the project detail and target history pages (depends on T035, T039, T044)

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Land on an Introductory Page (Priority: P5)

**Goal**: A first-time visitor understands the product and has a clear path into the analyze flow; a returning user can reach existing projects/history from the same entry point.

**Independent Test**: Visit the application root as a new visitor; verify it explains the product and provides a clear call-to-action, independent of all other features being complete.

### Implementation for User Story 5

- [X] T048 [P] [US5] Implement `Hero` and `FeatureHighlights` landing components in `frontend/src/features/landing/components/Hero.tsx` and `FeatureHighlights.tsx`
- [X] T049 [US5] Implement the landing page composing `Hero` + CTA into `/analyze` + returning-user entry points into `/projects` in `frontend/src/app/page.tsx` (depends on T048)

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification and quality passes spanning all stories.

- [X] T050 [P] Add unit tests for `severity.ts`, `url.ts`, `sharedIssues.ts`, and `recurrence.ts` in `frontend/tests/unit/`
- [X] T051 [P] Add integration tests (React Testing Library) for the submit-analysis, create-project-detect-shared-issue, and schedule-automation flows in `frontend/tests/integration/`
- [ ] T052 [P] Add Playwright e2e tests: US1 golden path, US2 shared-issue flow, and a mobile-viewport smoke check (SC-006) in `frontend/tests/e2e/`
- [ ] T053 Manually run `quickstart.md` Scenarios 1–6 end-to-end and confirm expected outcomes
- [ ] T054 [P] Responsive/mobile polish pass across all screens (landing, analyze, results, projects, project detail, history, automations) per FR-026/SC-006
- [ ] T055 Update `CLAUDE.md`'s "Current Feature" pointer to `specs/003-seo-analyzer-frontend`

---

## Phase 8b: UI Library Migration (daisyUI → shadcn/ui)

**Purpose**: Mid-Phase-8, the user explicitly requested replacing daisyUI with shadcn/ui for the whole application's look and feel, and chose to do it immediately rather than after Phase 8 finished (see `research.md` §1 for full rationale). This phase's tasks were not in the original plan — they're appended here rather than rewritten into Phases 1–7's history, since those tasks accurately record what was built at the time.

- [X] T056 [P] Swap dependencies: remove `daisyui`; add `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot` in `frontend/package.json`
- [X] T057 [P] Replace daisyUI theme config with shadcn/ui CSS-variable tokens (`--background`, `--primary`, `--destructive`, plus app-specific `--success`/`--warning`) in `frontend/src/styles/globals.css`, and map them into Tailwind colors in `frontend/tailwind.config.js`
- [X] T058 Add the `cn()` class-merge utility in `frontend/src/shared/lib/cn.ts`
- [X] T059 [P] Build shadcn/ui-pattern primitives (`Button`, `Badge`, `Card`, `Input`, `Label`, `Select`, `Alert`) in `frontend/src/shared/components/ui/`
- [X] T060 [P] Build hand-written primitives with no shadcn/ui equivalent: `Spinner` in `frontend/src/shared/components/Spinner.tsx`; rewrite `ScoreRadial` as an SVG circle in `frontend/src/shared/components/ScoreRadial.tsx`
- [X] T061 Update `frontend/src/shared/lib/severity.ts`'s single-source-of-truth mapping (`SEVERITY_CLASSES`) to the new Badge variant names (`success`/`warning`/`destructive`) and stroke classes (depends on T059, T060)
- [X] T062 Migrate `SeverityBadge`, `ResponsiveNav` (rebuilt without a daisyUI dropdown — plain `useState`-driven mobile menu), `AppShell`, and `app/layout.tsx` (drop `data-theme`) (depends on T059–T061)
- [X] T063 [P] Migrate all `features/analysis/` components (`UrlSubmitForm`, `LiveStatusTracker` — step tracker rebuilt in plain Tailwind, `ScoreSummary`, `FindingCard`, `FindingsList`, `CodeSnippetCard`) (depends on T059–T061)
- [X] T064 [P] Migrate all `features/projects/` components (`ProjectForm`, `ProjectUrlList`, `SharedIssuesPanel`) (depends on T059–T061)
- [X] T065 [P] Migrate all `features/history/` components (`RunTimeline` — rebuilt as a bordered list, `RunSnapshotView`, `ProjectHistorySummary`) (depends on T059–T061)
- [X] T066 [P] Migrate all `features/automations/` components (`ScheduleForm`, `AutomationList`, `RecurrenceSummary`) (depends on T059–T061)
- [X] T067 [P] Migrate `features/landing/` components (`Hero`, `FeatureHighlights`) and every `app/*/page.tsx` route (depends on T059–T061)
- [X] T068 Update `tests/unit/severity.test.ts` for the new variant names and `tests/e2e/golden-path.spec.ts` for the new markup (no more `ul.steps`/`.radial-progress`); re-run the full unit + integration suite (34/34 passing) and `type-check` (depends on T062–T067)

**Checkpoint**: Every component built in Phases 1–7 renders with shadcn/ui-pattern primitives; zero daisyUI class references remain anywhere in `frontend/src` (verified by grep); all previously-passing tests still pass; dev-server smoke test across all routes shows no compile/runtime errors.

---

## Phase 8c: Automation Model Correction & Palette Revision

**Purpose**: A follow-up correction requested mid-Phase-8: automations were originally modeled at both the Project level (one) and the Analysis Target level (one) — the user corrected this to "automations belong to a URL, and a URL may have several." At the same time, the shadcn/ui migration's default zinc/black-and-white palette was replaced with a distinct indigo/violet brand color (severity green/amber/red unchanged). See `spec.md` Clarifications (second entry set) and `research.md`/`data-model.md` for the reasoning.

- [X] T069 Update `spec.md` (Clarifications, User Story 4, FR-021, Automation/Project Key Entities, SC-004), `data-model.md` (drop `Project.automationId`, `Automation.scopeType`; add `Automation.targetId`), and `contracts/analysis-service.md` (`createAutomation` signature)
- [X] T070 Update `shared/types/index.ts`: remove `AutomationScopeType` and `Project.automationId`; `Automation.scopeType`/`scopeId` → `Automation.targetId`
- [X] T071 Update `shared/store/useAppStore.ts`: remove `setProjectAutomation` and its call sites
- [X] T072 Update `shared/realtime/AnalysisService.ts` + `MockAnalysisService.ts`: `createAutomation`/`triggerAutomationNow` simplified to target-only (depends on T070, T071)
- [X] T073 Update `features/automations/hooks/useAutomations.ts` (scope param → optional `targetId`) and `AutomationList`/`RecurrenceSummary` (`getScopeLabel` → `getTargetLabel`) (depends on T072)
- [X] T074 Update `app/targets/[targetId]/history/page.tsx` to always show the existing automation list plus a toggleable "Add automation" form (supporting multiple); remove the Automation section entirely from `app/projects/[projectId]/page.tsx`, replaced with a pointer to manage automations per-URL (depends on T073)
- [X] T075 Update `tests/integration/schedule-automation.test.tsx` for the new API and add a multi-automation-per-URL test case (depends on T074)
- [X] T076 [P] Replace the zinc/black-and-white CSS-variable palette with an indigo/violet primary in `globals.css` (light + dark), keeping `--success`/`--warning`/`--destructive` unchanged; add a gradient hero treatment (`Hero.tsx`) and a gradient wordmark (`ResponsiveNav.tsx`) for a more distinctive look

**Checkpoint**: Automations are createable/manageable per-URL only, with no cap on count per URL; the project detail page no longer references automations directly; full test suite (35/35) and `type-check` pass; dev-server smoke test across all routes shows no compile/runtime errors; a repo-wide grep confirms no leftover references to the old project-scoped automation model.

---

## Phase 8d: "Dawn Patrol" Theme & Landing-Page Analyze Input

**Purpose**: A second design correction: the T076 indigo/violet gradient theme was reported as generic/common across other sites. The user supplied a complete replacement brand system ("Dawn Patrol" — see `research.md` §1b and `spec.md` Clarifications, 2026-08-10 session) plus a UX correction: the single-URL analyze input should be usable directly from the landing page, not just linked from it.

- [X] T077 [P] Wire up the type system in `app/layout.tsx` (`next/font/google` for Hanken Grotesk + Space Mono) and `tailwind.config.js` (`fontFamily.display/sans/mono`); load Clash Display from Fontshare via a `<link>` tag
- [X] T078 Replace all CSS variable values in `globals.css` with the Dawn Patrol palette computed from the brief's hex colors (single dark-first theme, no `.dark` pair); redefine `--success`/`--warning`/`--destructive` to calm, muted tones instead of traffic-light red/amber/green; add a `prefers-reduced-motion`-gated `swell` keyframe (depends on T077)
- [X] T079 [P] Remove the heavy `shadow` from the `Card` primitive (`shared/components/ui/card.tsx`) in favor of background-lift depth (depends on T078)
- [X] T080 [P] Remove gradients from `Hero.tsx` (replace with an Ocean panel + one restrained ambient-motion element) and `ResponsiveNav.tsx` (plain themed wordmark) (depends on T078)
- [X] T081 Embed `UrlSubmitForm` + `LiveStatusTracker` directly in `app/page.tsx`'s `Hero`, so the landing page offers the full submit → live-progress → results flow at first glance; `/analyze` remains available as its own route (depends on T080)
- [X] T082 [P] Convert `FeatureHighlights.tsx` from a 3-card grid to a horizontal banded row (depends on T078)
- [X] T083 [P] Apply `font-mono tabular-nums` to numeric/data displays: `ScoreRadial` score, `RunTimeline` score/timestamp, `RecurrenceSummary` next-run time, `FindingCard` metric values, `ProjectHistorySummary` score trend, `CodeSnippetCard` snippet text (depends on T078)
- [X] T084 Update `spec.md` (Clarifications 2026-08-10 session, User Story 5, FR-025) and `research.md` §1b for the theme and landing-page-input decisions (depends on T077–T083)

**Checkpoint**: No gradient or indigo/violet references remain anywhere in `frontend/src` (verified by grep); full test suite (35/35) and `type-check` pass; dev-server smoke test across all routes shows no compile/runtime errors; the landing page (`/`) renders a working URL-submission input directly, confirmed via curl.

---

## Phase 8e: Dark → Light Theme Conversion

**Purpose**: A third design correction: the user asked whether the theme could switch from dark to light, then — after being told there's no toggle and it would mean converting the single theme rather than adding one — asked to convert it outright, "as is better for users." Same Dawn Patrol brand hues, restructured for a light background rather than a naive color inversion.

- [X] T085 Replace all `:root` CSS variable values in `globals.css` with light-mode equivalents: Foam's hue becomes the pale page background (not foreground text); Ocean/Glass deepened in lightness for legible text/link/focus contrast; `success`/`warning`/`destructive` left unchanged (self-contained chip contrast, independent of page background)
- [X] T086 [P] Fix the `--accent` dual-use conflict surfaced by the conversion: `Button`'s `ghost`/`outline` hover state needs a pale `--accent`, but `ResponsiveNav`'s brand icon and the `Hero` swell decoration need the vivid "Glass" tone to stay visible on a light background — repointed both to `text-ring`/`bg-ring` (the token already carrying the deepened Glass color) instead of `--accent` (depends on T085)
- [X] T087 Update `spec.md` (Clarifications, second 2026-08-10 entry) and `research.md` §1b for the conversion and its rationale (depends on T085, T086)

**Checkpoint**: Full test suite (35/35) and `type-check` pass; dev-server smoke test across all routes shows no compile/runtime errors; no leftover dark-only assumptions (e.g., light-on-dark text colors) remain in the primitives touched.

---

## Phase 8f: Previously-Analyzed URLs on the Analyze Screen

**Purpose**: New requirement (FR-013a, User Story 1 acceptance scenario 6): the standalone `/analyze` screen should show a list of URLs analyzed earlier in the session, not just a blank submission form each time. Explicitly scoped to reuse the existing per-target status badge logic (already built for `ProjectUrlList`) rather than duplicating it.

- [X] T088 [P] Extract the inline `TargetStatus` component out of `features/projects/components/ProjectUrlList.tsx` into a shared `shared/components/TargetStatusBadge.tsx`; update `ProjectUrlList` to import and use it, with no behavior change
- [X] T089 [P] Implement `useRecentTargets(limit?)` in `features/history/hooks/useRecentTargets.ts` — all known `AnalysisTarget`s from the store, sorted by most recent activity (latest run's `startedAt`, falling back to `createdAt`) (depends on T088 only insofar as it reads the same store shape; no direct code dependency)
- [X] T090 Implement `RecentTargetsList` in `features/history/components/RecentTargetsList.tsx`, reusing `TargetStatusBadge`; each entry links to that target's `/targets/[targetId]/history` page; renders nothing when the list is empty (depends on T088, T089)
- [X] T091 Wire `RecentTargetsList` into `app/analyze/page.tsx`, below the submit form/live tracker (depends on T090)
- [X] T092 [P] Add an integration test in `tests/integration/submit-analysis.test.tsx` covering a submitted URL appearing under "Previously analyzed" (depends on T091)

**Checkpoint**: Full test suite (36/36) and `type-check` pass; dev-server smoke test shows no compile/runtime errors; `ProjectUrlList` and the new `RecentTargetsList` share one status-badge implementation rather than two.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational completion
  - US1 has no dependency on other stories
  - US2 depends on US1's `LiveStatusTracker` (T020) for concurrent progress display, otherwise independent
  - US3 depends on US2's project detail page (T035) only for the project-level aggregate view (T040); the per-target timeline (T036–T039) depends only on Foundational + US1's target/run concepts
  - US4 depends on US2's `createProject`/target wiring (T026) and US3's history page (T039) for entry points, otherwise independently testable via its own pages
  - US5 has no dependency on other stories beyond Foundational
- **Polish (Phase 8)**: Depends on whichever stories are in scope for the current increment

### Parallel Opportunities

- Setup: T002, T003, T004 in parallel after T001
- Foundational: T006–T010 in parallel; T013 in parallel with T011/T012 once T006 lands
- Within each user story, hooks/components marked [P] can be built in parallel; page-composition tasks are sequential integration points
- Different user stories can be staffed in parallel once Foundational is complete, respecting the light cross-story dependencies noted above

---

## Parallel Example: User Story 1

```bash
# After Foundational is complete, launch these together:
Task: "Create mock finding fixture templates in frontend/src/features/analysis/mocks/findings.ts"
Task: "Create mock scoring/failure scenario logic in frontend/src/features/analysis/mocks/scenarios.ts"

# Then, once T016 wires fixtures into MockAnalysisService, launch these together:
Task: "Implement useStartAnalysis hook in frontend/src/features/analysis/hooks/useStartAnalysis.ts"
Task: "Implement useRunStatus hook in frontend/src/features/analysis/hooks/useRunStatus.ts"
Task: "Implement UrlSubmitForm component in frontend/src/features/analysis/components/UrlSubmitForm.tsx"
Task: "Implement LiveStatusTracker component in frontend/src/features/analysis/components/LiveStatusTracker.tsx"
Task: "Implement ScoreSummary component in frontend/src/features/analysis/components/ScoreSummary.tsx"
Task: "Implement FindingsList/FindingCard components in frontend/src/features/analysis/components/"
Task: "Implement CodeSnippetCard component in frontend/src/features/analysis/components/CodeSnippetCard.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `quickstart.md` Scenario 1 and Scenario 6 (reload resets state)
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate via Scenario 1 → demo (MVP!)
3. Add US2 → validate via Scenario 2 → demo
4. Add US3 → validate via Scenario 3 → demo
5. Add US4 → validate via Scenario 4 → demo
6. Add US5 → validate landing CTA → demo
7. Polish phase → run Scenario 5 (responsive) and full automated checks

---

## Notes

- [P] tasks touch different files with no unmet dependencies
- [Story] labels map every story-phase task to US1–US5 for traceability
- All "backend" behavior in every story is mocked per `research.md`/`contracts/`; no backend implementation tasks exist in this feature
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before moving to the next
