# Feature Specification: Project & Analysis UX Improvements

**Feature Branch**: `009-project-analysis-ux`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Improve the interaction flows around creating projects, attaching analyses to them, and reviewing analysis history — replacing several rough, inline UI patterns with clearer, more deliberate ones. Create-project as a modal on the Run page. Gate project creation behind a button on the Projects page. Remove 'shared issues' from projects. View and re-run past analyses from project history. Clickable project label from a historical analysis."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Attach an analysis to a project via a modal (Priority: P1)

As a user who just ran an analysis, I want the "attach to a project" action to open as a clear, properly-sized modal — where I can either create a new project or pick an existing one — instead of a cramped form squeezed into the page, so the decision feels deliberate and the form is actually usable.

**Why this priority**: This is the single most common project-related interaction (it happens after every analysis a user chooses to keep) and today it's the flow most visibly broken by poor layout.

**Independent Test**: From the results page of a just-completed analysis, trigger the "add to project" action; confirm it opens as a modal (not inline page content) offering both "create new" and "choose existing"; confirm dismissing the modal leaves the analysis unattached.

**Acceptance Scenarios**:

1. **Given** a user is viewing a just-completed analysis, **When** they trigger "add to a project," **Then** a modal opens over the page, offering to create a new project or choose an existing one.
2. **Given** the modal is open on "choose existing," **When** the user selects a project and confirms, **Then** the analysis is attached to that project and the modal closes.
3. **Given** the modal is open on "create new," **When** the user fills in the required fields and confirms, **Then** a new project is created, the analysis is attached to it, and the modal closes.
4. **Given** the modal is open, **When** the user dismisses it without confirming (e.g., closes it or cancels), **Then** no project is created and the analysis is not attached to anything.

---

### User Story 2 - View and re-run a past analysis from project history (Priority: P1)

As a user browsing a project's analysis history, I want to open any past analysis and see its full results exactly as they appeared when it ran — and optionally run a fresh analysis of that same URL from there — so history is something I can actually use, not just a list of dates.

**Why this priority**: Today history is a dead end — entries are listed but cannot be opened. This is the core payoff of having persisted history at all, and without it the history feature delivers no real value.

**Independent Test**: Open a project with at least one historical analysis that has both a before result and an after (optimized) result; click its view action; confirm the full interactive results view opens showing both; confirm running a new analysis from that view adds a new, separate history entry without altering the one just viewed.

**Acceptance Scenarios**:

1. **Given** a project's history list, **When** the user triggers the view action on an entry, **Then** the full interactive results view opens, showing that analysis's results exactly as they were when it originally ran.
2. **Given** the viewed historical analysis had an optimization (after) result, **When** the view opens, **Then** the after result is shown alongside the before result, the same as it would have been the day it ran.
3. **Given** the viewed historical analysis had no optimization run, **When** the view opens, **Then** only the before result is shown, with no error.
4. **Given** a user is viewing a historical analysis, **When** they trigger a fresh analysis from that view, **Then** a new analysis is created and added to the project's history, and the original historical entry remains exactly as it was — never overwritten or modified.

---

### User Story 3 - Jump back to the owning project from a historical analysis (Priority: P2)

As a user viewing a historical analysis (opened via User Story 2), I want to see and click the name of the project it belongs to, so I can get back to the project without using the browser's back button.

**Why this priority**: A small but meaningful navigation convenience once historical analyses can be opened at all — depends entirely on User Story 2 existing first.

**Independent Test**: Open a historical analysis from a project; confirm the owning project's name is visible and, when clicked, navigates to that project's page.

**Acceptance Scenarios**:

1. **Given** a user is viewing a historical analysis that belongs to a project, **When** the view renders, **Then** the project's name is shown as a clickable label.
2. **Given** that label is visible, **When** the user clicks it, **Then** they are taken to that project's page.

---

### User Story 4 - Create a project deliberately from the Projects page (Priority: P2)

As a user visiting the Projects page, I want project creation to start from a clear "Create Project" action rather than an always-open form, so the page reads as a list first and creation feels like a deliberate step.

**Why this priority**: A straightforward UX cleanup, independent of the other stories, but lower-impact than fixing the two broken/missing interactions above.

**Independent Test**: Visit the Projects page with no action taken; confirm no creation form is visible by default, only a "Create Project" button; click it and confirm the form appears.

**Acceptance Scenarios**:

1. **Given** a user opens the Projects page, **When** the page loads, **Then** no project-creation form is visible — only a "Create Project" button (alongside any existing project list).
2. **Given** the user clicks "Create Project," **When** the form appears, **Then** it behaves exactly as project creation does today (same fields, same validation, same outcome on submit).

---

### User Story 5 - Simplified project view without shared issues (Priority: P3)

As a user viewing a project, I no longer see a "shared issues" section, since it added clutter without enough value to justify keeping in the interface — the underlying data and computation are not being removed, only the display.

**Why this priority**: A pure simplification with no functional upside beyond decluttering the page; lowest risk and lowest priority of the five.

**Independent Test**: Open any project's page; confirm no "shared issues" section, heading, or panel appears anywhere in the UI, while every other part of the project view continues to work exactly as before.

**Acceptance Scenarios**:

1. **Given** a user opens a project's page, **When** the page renders, **Then** there is no "shared issues" section, heading, or content visible anywhere on it.
2. **Given** shared issues are no longer shown, **When** the rest of the project page is used (history, competitors, metadata, analyze-a-URL), **Then** everything else behaves exactly as it did before this change.

### Edge Cases

- What happens if the user opens the "attach to a project" modal, starts filling in a new-project form, and dismisses without confirming? Per User Story 1 Scenario 4, nothing is created or attached — any in-progress form input is simply discarded.
- What happens when a project has zero existing projects at all and the user opens the Run-page modal? The modal must still function, defaulting naturally to (or clearly guiding the user toward) the "create new project" path, since there is nothing to choose from.
- What happens if a user views a historical analysis, then navigates away without running anything new? Nothing changes — viewing alone never creates or modifies any record.
- What happens if two different historical analyses in the same project are viewed one after another? Each view must independently and correctly reflect that specific analysis's own results, never a previous one left over from a prior view.
- What happens to the "re-run" capability if the historical analysis's original URL is no longer reachable? The fresh analysis attempt should fail the same way any normal analysis attempt fails on an unreachable URL today — this feature does not change that behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present the "attach analysis to a project" action (available after an analysis completes) as a modal overlay, not as content embedded inline in the page.
- **FR-002**: The modal in FR-001 MUST support both creating a new project and choosing an existing one, within the same modal.
- **FR-003**: Dismissing the modal in FR-001 without confirming an action MUST NOT create a project or attach the analysis to anything.
- **FR-004**: The Projects page MUST NOT display the project-creation form by default; it MUST instead display a "Create Project" action that reveals the form when triggered.
- **FR-005**: The project-creation form's fields, validation, and outcome MUST remain unchanged by this feature — only when it is shown changes (FR-004) or where it is presented (FR-001/FR-002 for the Run-page modal).
- **FR-006**: The "shared issues" section MUST be removed from the project page's user interface.
- **FR-007**: Removing "shared issues" from the UI (FR-006) MUST NOT alter, migrate, or remove any underlying stored data — this is a display-only change.
- **FR-008**: Each entry in a project's analysis history MUST offer a view action.
- **FR-009**: Triggering the view action on a history entry MUST open the full interactive results view for that specific analysis, reflecting the same before (and, when present, after/optimization) results the user saw when that analysis originally completed.
- **FR-010**: When the viewed historical analysis has no optimization (after) result, the view MUST show the before result only, without error (consistent with existing behavior for analyses without an optimization).
- **FR-011**: The view opened via FR-009 MUST remain interactive: the user MUST be able to trigger a fresh analysis from it.
- **FR-012**: Triggering a fresh analysis from the view in FR-011 MUST create a new, separate history entry and MUST NOT modify, overwrite, or remove the historical entry being viewed.
- **FR-013**: While viewing a historical analysis that belongs to a project, the system MUST display that project's name as a clickable label.
- **FR-014**: Clicking the label in FR-013 MUST navigate the user to that project's page.

### Key Entities

- **Historical analysis view**: Not a new stored entity — a read (and re-entry) surface over the existing, already-persisted analysis (and, when present, optimization) records introduced by the project-centric analysis feature. Viewing it does not create or change data; only initiating a fresh analysis from it does.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from "analysis just completed" to "attached to a project" (new or existing) using the modal in 3 actions or fewer, with the layout issues of the current inline form no longer present.
- **SC-002**: 100% of a project's historical analyses can be opened and their original results correctly reviewed, including before/after data when it exists.
- **SC-003**: Running a fresh analysis from a historical view never alters the historical entry it was opened from — verified across repeated re-runs.
- **SC-004**: A user can navigate from a historical analysis back to its owning project in a single click.
- **SC-005**: The Projects page shows zero creation-form fields until the user explicitly requests them.
- **SC-006**: Zero "shared issues" UI elements remain visible on the project page after this change, with no other part of the project page regressing.

## Assumptions

- The Run-page modal reuses the same project-creation fields and validation that exist today (title, description, category, country, region, competitors) — this feature changes presentation (modal vs. inline), not form content, per the description's framing of the problem as "too small and has poor UI."
- "Re-run" (User Story 2 / FR-011, FR-012) means the interactive view still lets the user submit an analysis (pre-filled with, but not limited to, the historical analysis's own URL) through the same submission flow used elsewhere — it does not silently auto-run in the background without user action.
- A fresh analysis triggered from a historical view (FR-011/FR-012) is attached to the same project the historical entry belonged to, consistent with how analyzing from within a project already behaves elsewhere in the app.
- "Removed from the projects UI only" (FR-006/FR-007) means the shared-issues section/panel is no longer rendered; the underlying computation and stored data are explicitly out of scope for removal or modification.
- No new persisted entity is introduced by this feature — it changes how existing projects, analyses, and their results are presented and navigated, not what is stored.
