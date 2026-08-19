# Feature Specification: Remove Automations Feature

**Feature Branch**: `006-remove-automations`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "the automations feature that is only present in the frontend project should be removed, so any reference to it is not needed anymore we drop that feature"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - No automations entry points remain in the app (Priority: P1)

As a user of the SEO analyzer, when I navigate the app I no longer see any "Automations" navigation link, page, or scheduling controls, because the feature has been fully withdrawn rather than left half-visible.

**Why this priority**: A dangling nav link or reachable page that leads nowhere (or to broken/removed functionality) is the most visible and confusing failure mode of an incomplete removal. This must be eliminated first.

**Independent Test**: Can be fully tested by loading the app, checking global navigation for an "Automations" entry, and attempting to visit the automations route directly — both should confirm the feature is gone.

**Acceptance Scenarios**:

1. **Given** the app is loaded, **When** a user views the main/responsive navigation, **Then** no "Automations" link is present.
2. **Given** a user navigates directly to the former automations URL, **When** the page loads, **Then** the app does not render an automations page (it resolves as a not-found route or redirects, consistent with how the app handles other removed/unknown routes).
3. **Given** a user is on a target's history page or a project's detail page, **When** the page renders, **Then** no automation scheduling, "next run", or "trigger now" UI is present.

---

### User Story 2 - Analysis and project workflows are unaffected (Priority: P2)

As a user running analyses and managing projects, I can continue to submit URLs for analysis, view history, and manage projects exactly as before, because removing automations does not touch any of that shared functionality or data.

**Why this priority**: The automations feature touches shared state (the app store) and shared screens (history, project detail). Removal must not regress the core analysis flow, which is the app's primary value.

**Independent Test**: Can be fully tested by running a full manual analysis (submit URL → view results) and by creating/viewing a project with targets, confirming both work identically to before the removal and show no automation-related errors or empty gaps in the UI.

**Acceptance Scenarios**:

1. **Given** a user submits a URL for manual analysis, **When** the analysis completes, **Then** results display normally with no reference to automations anywhere in the flow.
2. **Given** a project with one or more targets, **When** the user views the project detail page, **Then** the page renders correctly with the automation-related section removed and no layout gaps or broken references.
3. **Given** a target's history page, **When** the user views it, **Then** the run history displays correctly with any automation-specific labeling or controls removed.

---

### User Story 3 - Codebase has no leftover automation artifacts (Priority: P3)

As a developer working in this codebase after the removal, I don't encounter unused automation types, store fields, hooks, components, pages, or tests, because leftover dead code would confuse future work and fail quality checks.

**Why this priority**: Lower user-facing impact than P1/P2, but necessary for the removal to be considered complete and for the codebase to stay maintainable. This is the "no references remain" part of the request.

**Independent Test**: Can be fully tested by searching the frontend codebase for automation-related identifiers (types, store actions, routes, components, tests) and confirming none remain, then running the frontend's build/lint/test suite and confirming it passes.

**Acceptance Scenarios**:

1. **Given** the automations feature is removed, **When** the frontend project is built, **Then** the build succeeds with no references to removed automation types, hooks, or components.
2. **Given** the automations feature is removed, **When** the test suite runs, **Then** no tests reference automation scheduling or recurrence, and the suite passes.
3. **Given** the automations feature is removed, **When** documentation describing the app's features is reviewed, **Then** it no longer lists automations as a capability.

### Edge Cases

- What happens to a user who has an old bookmark or link pointing at the automations route? The app must handle it the same way it handles any other nonexistent route (its standard not-found behavior), not crash or show a blank/broken page.
- What happens to any in-memory automation data a user had created in their current session before the removal ships? Since automation data was never persisted (session-only, in-memory), there is no migration or data-loss concern — it simply ceases to exist along with the feature.
- Do any other features assume automations exist (e.g., a run's "triggered by automation" origin)? Any such labeling that has no remaining way to occur must be removed or simplified so it doesn't reference a nonexistent concept.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST NOT present any navigation entry point (menu link, button, or shortcut) leading to automations functionality.
- **FR-002**: The app MUST NOT expose a reachable automations page or view; visiting the former route MUST behave the same as visiting any other unknown route in the app.
- **FR-003**: The app MUST NOT display automation-related UI (scheduling controls, recurrence summaries, "next run" indicators, "trigger now" actions) on any screen, including target history and project detail views that previously embedded them.
- **FR-004**: The app's shared state MUST NOT define or expose automation entities, automation actions, or automation-related fields.
- **FR-005**: The app's data-fetching/service layer MUST NOT expose operations for creating, listing, activating/deactivating, deleting, or manually triggering automations.
- **FR-006**: Core analysis and project workflows (manual URL submission, run history, project/target management) MUST continue to function without any behavior change caused by the removal.
- **FR-007**: Any concept that only existed to support automations (e.g., distinguishing a run as "triggered by automation" versus manual) MUST be removed or collapsed, since automation-triggered runs can no longer occur.
- **FR-008**: The frontend's automated test suite MUST NOT contain tests exercising automation scheduling/creation/recurrence behavior.
- **FR-009**: User-facing and contributor-facing documentation describing app capabilities MUST NOT list or describe an automations feature.

### Key Entities

- **Automation** *(removed)*: Previously represented a recurring schedule tied to an analysis target (frequency, time, active flag, next run time, last run reference). This entity and all data derived from it is being fully retired — no replacement entity is introduced.
- **AnalysisRun** *(affected)*: Previously carried a "triggered by" origin distinguishing manual runs from automation-triggered runs. With automations removed, every run is manually triggered, so this distinction loses its reason to exist and should be reviewed for simplification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user browsing the app cannot find any automations entry point, page, or control in under normal exploration of the navigation and existing screens (0 discoverable automation surfaces).
- **SC-002**: 100% of previously-passing non-automation tests in the frontend suite continue to pass after the removal, with 0 remaining tests referencing automation scheduling/recurrence.
- **SC-003**: The full manual analysis workflow (submit → analyze → view results) and project management workflow complete successfully with no automation-related errors, 100% of the time, matching pre-removal behavior.
- **SC-004**: A repository-wide search for automation-feature terminology returns 0 results in frontend application source and user-facing docs (historical/spec documents describing prior decisions are exempt).

## Assumptions

- "Only present in the frontend project" is accurate: the backend has no automation scheduler, endpoints, or persisted automation data, so this removal is scoped entirely to the frontend application (routes, components, hooks, store, types, tests) and related documentation.
- Automation data was never persisted (confirmed session-only, in-memory), so no data migration, export, or backfill is required as part of this removal.
- Historical specification documents (e.g., prior feature specs that originally introduced automations) are a record of past decisions and are out of scope for editing; only currently-active app documentation (e.g., README feature lists) needs to drop references.
- Removing the "triggered by automation" distinction on analysis runs is acceptable since no code path can produce that value once automations are removed; this is a simplification, not a behavior change users would notice.
- No replacement or alternative scheduling feature is being requested — this is a straight removal, not a redesign.
