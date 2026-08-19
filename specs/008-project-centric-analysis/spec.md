# Feature Specification: Project-Centric Analysis Management

**Feature Branch**: `008-project-centric-analysis`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Shift the app from one-off, throwaway analyses to a project-first model. Users should be able to group related analyses under a project, persist their results, review the history of analyses over time, and capture competitor context for future comparison work."

## Clarifications

### Session 2026-08-19

- Q: Should Projects and their analyses belong to a specific authenticated user, or remain globally visible/editable by anyone using the app? → A: Global, no auth — this is a PoC; per-user scoping is explicitly deferred to a later feature.
- Q: Should every analysis be persisted the moment it completes, or only once explicitly added to a project? → A: Only once explicitly added to a project. An unattached first-glance analysis stays exactly as ephemeral/session-only as it behaves today; persistence happens at the moment "Add analysis to a project" is confirmed.
- Q: What should the final list of project categories be? → A: `e-commerce`, `marketplace`, `saas`, `content/blog/media`, `news/journalism`, `local business/services`, `restaurant/food & beverage`, `real estate`, `healthcare/medical`, `legal services`, `travel/hospitality`, `education`, `finance/fintech`, `nonprofit`, `agency/professional services`, `automotive`, `b2b/manufacturing`, `entertainment/events`, `directory/listings`, `community/forum`, `government/public sector`, `other`.
- Q: Can a project be edited/deleted after creation, and can an analysis be removed or reassigned after being added? → A: Yes — in scope. Projects can be renamed/edited and deleted; analyses can be removed from a project or reassigned to a different one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anonymous first-glance analysis keeps working (Priority: P1)

As a first-time visitor, I can still land on the initial page and run a quick analysis of a URL without creating a project or an account, exactly as I can today.

**Why this priority**: This is the app's existing front door and must not regress while everything else is built around it. It's also the trigger point for every other story below.

**Independent Test**: Submit a URL from the initial page without touching any project UI; confirm the analysis runs and displays results exactly as it does before this feature ships.

**Acceptance Scenarios**:

1. **Given** a visitor with no project selected, **When** they submit a URL from the initial page, **Then** the analysis runs and its results display, identical to current behavior.

---

### User Story 2 - Create a project (Priority: P1)

As a user, I can create a project by entering its title, site description, category, and geography, and optionally add a list of competitor sites, so I have a place to organize analyses of a given site over time.

**Why this priority**: Every other story depends on a project existing. This is independently valuable and testable on its own — a user can create and revisit an empty project before ever attaching an analysis to it.

**Independent Test**: Fill out and submit the project creation form (with and without competitor entries); confirm the project is created, persists across a reload, and its metadata displays correctly when reopened.

**Acceptance Scenarios**:

1. **Given** a user fills in title, site description, category, and geography, **When** they submit, **Then** a new project is created and persisted.
2. **Given** a user is creating a project, **When** they add one or more competitor entries (URL + description), **Then** each entry is saved with the project.
3. **Given** a user is creating a project, **When** they remove a competitor entry before submitting, **Then** it is not saved.
4. **Given** a project was created in a previous session, **When** the user reloads the app, **Then** the project and its saved competitor entries still exist and display correctly.
5. **Given** a user submits the project form without any competitor entries, **When** the project is created, **Then** it is created successfully with an empty competitor list.

---

### User Story 3 - Save a completed analysis to a project (Priority: P1)

As a user who just ran a first-glance analysis, I can save that result into a new or an existing project via an "Add analysis to a project" action, so the analysis becomes part of that site's ongoing history instead of disappearing when I navigate away.

**Why this priority**: This is the hinge connecting the existing analysis flow to the new project-first model — the feature's core stated goal.

**Independent Test**: Run a first-glance analysis, use "Add analysis to a project" to attach it to an existing project, then reopen that project and confirm the analysis appears in its history with its full results intact.

**Acceptance Scenarios**:

1. **Given** a first-glance analysis has just completed, **When** the user views its results, **Then** an "Add analysis to a project" action is visible.
2. **Given** the user chooses an existing project, **When** they confirm, **Then** the analysis is associated with that project and appears in its history.
3. **Given** the user chooses to create a new project from this action, **When** they complete the project creation form, **Then** the new project is created and the just-completed analysis is associated with it immediately.
4. **Given** an analysis has already been added to a project, **When** the user views it again, **Then** the app reflects that it belongs to that project rather than offering to add it again.

---

### User Story 4 - Review a project's analysis history (Priority: P2)

As a user, I can open a project and see every analysis that has been run for it over time, each showing its persisted before/after results, so I can track how the site has evolved.

**Why this priority**: This is the payoff of persisting analyses under a project — without it, saving an analysis to a project has no visible benefit. Depends on User Stories 2 and 3 existing first.

**Independent Test**: Add two or more analyses to the same project over separate sessions; open the project and confirm all of them are listed in chronological order, each rendering its own persisted before/after results from stored data (not from any in-memory state left over from the session that created it).

**Acceptance Scenarios**:

1. **Given** a project with multiple saved analyses, **When** the user opens it, **Then** they see a chronological history listing each analysis.
2. **Given** an analysis in that history has both a "before" and an "after" (optimized) result, **When** the user views it, **Then** both are rendered from persisted data.
3. **Given** an analysis in that history only has a "before" result (optimization was never run for it), **When** the user views it, **Then** only the before result is shown, with no error.
4. **Given** the user reloads the app entirely, **When** they reopen the project, **Then** the same history and results still display, proving they came from storage and not session memory.

---

### User Story 5 - Smart Search for competitors (Priority: P3)

As a user creating or editing a project, I can click Smart Search to automatically discover and populate candidate competitor entries (URL + description), inferred from the project's own description, category, and geography, so I don't have to research and type them in by hand.

**Why this priority**: Valuable convenience on top of the manual competitor list (User Story 2), but the feature is complete and usable without it — competitors can always be added by hand.

**Independent Test**: With a project's description, category, and geography filled in, click Smart Search; confirm suggested competitor entries appear in the editable list, and that the user can still edit or remove any of them before saving.

**Acceptance Scenarios**:

1. **Given** a project's description, category, and geography are filled in, **When** the user clicks Smart Search, **Then** the app populates the competitor list with suggested URL + description entries.
2. **Given** Smart Search has populated suggestions, **When** the user edits or removes any of them, **Then** their changes are respected and only the final list is saved.
3. **Given** Smart Search cannot produce any confident suggestions, **When** it completes, **Then** the user sees a clear message rather than a silent no-op or an error.
4. **Given** required project fields (description, category, geography) are not yet filled in, **When** the user attempts Smart Search, **Then** they are prompted to fill those in first rather than getting an empty or nonsensical result.

---

### User Story 6 - Edit or delete a project, and manage its analyses (Priority: P2)

As a user, I can edit a project's metadata and competitor list after creation, delete a project I no longer need, and remove an analysis from a project or reassign it to a different project, so I can keep my projects organized and correct over time.

**Why this priority**: Necessary for the feature to be usable beyond a one-time demo — mistakes happen, sites change categories, and analyses sometimes get attached to the wrong project. Depends on User Stories 2 and 3 existing first.

**Independent Test**: Edit an existing project's title/description/category/geography/competitors and confirm the changes persist; remove an analysis from one project and reassign it to another and confirm it now appears only in the new project's history; delete a project and confirm it (and its analyses/competitors) no longer appear.

**Acceptance Scenarios**:

1. **Given** an existing project, **When** the user edits its title, site description, category, geography, or competitor list and saves, **Then** the changes are persisted and reflected the next time the project is viewed.
2. **Given** an existing project, **When** the user chooses to delete it, **Then** they are asked to confirm before the project — along with its analyses and competitor entries — is permanently removed.
3. **Given** an analysis attached to a project, **When** the user removes it from that project, **Then** it no longer appears in that project's history.
4. **Given** an analysis attached to a project, **When** the user reassigns it to a different project, **Then** it appears in the new project's history and no longer in the old one.

### Edge Cases

- What happens when a user chooses "Add analysis to a project" but has no existing projects yet? They must be able to create one inline, as part of the same flow (User Story 3, Scenario 3).
- What happens to a project's analysis history entry when only the "before" result exists (the optimization step was skipped, failed, or hasn't run yet)? It must still display cleanly (User Story 4, Scenario 3), not error or block the rest of the history from rendering.
- What happens when Smart Search is clicked with incomplete project context (missing description/category/geography)? See User Story 5, Scenario 4.
- Are duplicate competitor URLs (added manually and also suggested by Smart Search, or entered twice by hand) prevented, or is the list a simple free-form list the user is responsible for curating? Treated as a simple list the user curates — no automatic de-duplication is required for this feature.
- What happens if a user submits a competitor entry with a URL but no description, or vice versa? Both fields are required per entry; an incomplete entry cannot be added to the list.
- What happens to an analysis's persisted record when it is removed from its project, given analyses are only persisted because they were attached to a project (FR-013)? Since nothing else justifies keeping it durable, removing an analysis from a project deletes its persisted record entirely — there is no "unattached but still persisted" state. Reassigning to a different project instead changes which project it belongs to, without deleting it.
- What happens to a project's analyses and competitor entries when the project itself is deleted? They are permanently deleted along with it (see User Story 6, Scenario 2) — deletion requires explicit user confirmation first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST preserve the existing anonymous, project-less "first-glance" analysis flow on the initial page exactly as it works today.
- **FR-002**: Once a first-glance analysis completes, the system MUST surface an "Add analysis to a project" action that lets the user associate that analysis with either an existing project or a newly created one.
- **FR-003**: The system MUST support many analyses belonging to one project (one-to-many), with each analysis belonging to at most one project.
- **FR-004**: Once an analysis is added to a project (per FR-013), the system MUST persist its results — including both "before" and "after" (optimized) results, when available — in durable storage, and the UI MUST render a project's analysis history from that stored data rather than from client-side session state.
- **FR-005**: Project creation MUST capture: a title, a site description, a category (see FR-011 for the finalized value list), and a geography (country and region).
- **FR-006**: A project MUST support a dynamic, repeatable list of competitor entries, each with a URL and a description, which the user can add to or remove from at any time while editing the project.
- **FR-007**: The system MUST provide a "Smart Search" action that proposes competitor entries (URL + description) using the project's description, category, and geography as input, and MUST let the user review, edit, or remove any proposed entry before it is saved — proposals are never saved automatically without the user completing the save action.
- **FR-008**: A project view MUST show the chronological history of all analyses associated with that project.
- **FR-009**: Projects, their analyses (with before/after results), and their competitor entries MUST all be persisted in the database, surviving application restarts and full page reloads.
- **FR-010**: The system MUST NOT run analyses or comparisons against the stored competitor sites as part of this feature — competitor entries are captured for future use only.
- **FR-011**: Category MUST be a fixed set of selectable values: `e-commerce`, `marketplace`, `saas`, `content/blog/media`, `news/journalism`, `local business/services`, `restaurant/food & beverage`, `real estate`, `healthcare/medical`, `legal services`, `travel/hospitality`, `education`, `finance/fintech`, `nonprofit`, `agency/professional services`, `automotive`, `b2b/manufacturing`, `entertainment/events`, `directory/listings`, `community/forum`, `government/public sector`, `other`.
- **FR-012**: Projects and their analyses MUST be globally visible and editable by anyone using the app, with no authentication or per-user ownership — consistent with how every other persisted record in this system works today.
- **FR-013**: An anonymous first-glance analysis MUST remain ephemeral/session-only, exactly as it behaves today, unless and until the user explicitly adds it to a project (User Story 3) — at which point it MUST be written to durable storage. Analyses never added to a project are never persisted.
- **FR-014**: Users MUST be able to edit an existing project's title, site description, category, geography, and competitor list after creation.
- **FR-015**: Users MUST be able to delete a project. Deleting a project MUST require explicit confirmation and MUST permanently delete its associated analyses and competitor entries along with it.
- **FR-016**: Users MUST be able to remove an analysis from its project (which permanently deletes that analysis's persisted record, per FR-013) or reassign it to a different project (which preserves the record and changes its project association).

### Key Entities

- **Project**: A user-defined container representing one site being tracked over time. Attributes: title, site description, category, geography (country, region), creation date. Has many Analyses and many Competitor entries.
- **Analysis**: A single run of the existing SEO/GEO analysis pipeline against a URL. Remains ephemeral/session-only exactly as today unless and until it is added to a project, at which point it becomes a persisted record carrying its "before" (initial) results and, when available, its "after" (optimized) results, plus the timestamp it ran (see FR-013). Belongs to at most one Project.
- **Competitor**: A `{ URL, description }` pair representing a site the project owner considers competitive. Belongs to exactly one Project. Not itself analyzed as part of this feature — stored for future comparison work.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a project with all required metadata in under 2 minutes.
- **SC-002**: 100% of analyses a user adds to a project are still visible, with their full before/after results, after a complete application reload — proving persistence rather than session memory.
- **SC-003**: A user can go from a just-completed first-glance analysis to seeing it inside a project's history in 3 actions or fewer (e.g., click "Add to project," choose/create a project, confirm).
- **SC-004**: Smart Search returns at least one usable competitor suggestion for a well-formed project description within 15 seconds, for the large majority of well-formed inputs.
- **SC-005**: A project containing 10+ historical analyses loads and displays its full history without the user perceiving a meaningful delay.

## Out of Scope

- Running analyses, scans, or comparisons against any stored competitor site. Competitor entries captured by this feature are inert, stored data intended for a future comparison feature.
- User accounts, authentication, and per-user project ownership. This feature is a proof of concept: all projects are globally visible/editable, matching current app behavior. Real user scoping is explicitly deferred to a future feature.

## Assumptions

- Geography is captured as free-form country and region text rather than a constrained lookup list, since no specific geography taxonomy was requested.
- Smart Search's proposed competitor entries are inserted into the same editable list used for manually-added competitors — the user reviews and can prune before saving; nothing is saved until the project (or edit) is explicitly submitted.
- When "Add analysis to a project" leads to creating a new project, the same project-creation form/fields from User Story 2 are reused, immediately followed by associating the just-completed analysis with the newly created project — no separate, lighter-weight "quick create" form is introduced.
- The existing before/after analysis and optimization logic itself (how scores and suggestions are computed) is unchanged by this feature; the change is what happens to those results afterward (persisted and organized under a project) and how the UI sources them (from storage instead of session state).
- Competitor entries are not deduplicated automatically; the user is responsible for curating their own list.
