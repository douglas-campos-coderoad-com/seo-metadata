# Feature Specification: Remove Analyze Page

**Feature Branch**: `007-remove-analyze-page`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "remove the analyze page and navbar item, is not needed anymore"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - No dedicated Analyze entry point remains (Priority: P1)

As a user of the app, I no longer see a separate "Analyze" navigation item or land on a standalone Analyze page, because submitting a URL for analysis is already fully available from the home page and a second, identical entry point is redundant.

**Why this priority**: The nav item and page are the most visible surfaces of this now-redundant flow; removing them first delivers the requested cleanup immediately and is independently verifiable.

**Independent Test**: Load the app; confirm no "Analyze" nav link exists; visit the former Analyze page URL directly and confirm it resolves the same way the app already handles any other retired/unknown route.

**Acceptance Scenarios**:

1. **Given** the app is loaded, **When** a user views the main/responsive navigation, **Then** no "Analyze" link is present (only "Projects" remains alongside the home link).
2. **Given** a user navigates directly to the former Analyze page URL, **When** the page loads, **Then** the app does not render a dedicated Analyze page — it behaves the same as visiting any other retired route.

---

### User Story 2 - Submitting a URL for analysis still works exactly as before (Priority: P1)

As a user, I can still paste a URL, submit it, watch live progress, and land on the results page — all from the home page — because the home page already contains this entire flow and nothing about removing the duplicate Analyze page changes it.

**Why this priority**: This is the core value of the product. Removing a redundant entry point must not touch or regress the underlying capability, so this is equally critical to verify alongside User Story 1.

**Independent Test**: From the home page, submit a URL, confirm live status is shown while the run is in progress, and confirm the app navigates to the results page once the run completes — identical to the current home-page behavior today.

**Acceptance Scenarios**:

1. **Given** a user is on the home page, **When** they submit a valid URL, **Then** they see live progress and are taken to the results page on completion, exactly as today.
2. **Given** a user is on the home page, **When** they submit an invalid URL, **Then** they see an inline validation error and remain on the home page.

---

### User Story 3 - No leftover references to the removed page (Priority: P2)

As a developer working in this codebase after the removal, I don't encounter dead links, unused imports, orphaned components, outdated automated tests, or stale documentation pointing at the removed Analyze page, because leftover references would confuse future work.

**Why this priority**: Lower user-facing impact than P1, but necessary for the removal to be considered complete and for the codebase/tests to stay trustworthy.

**Independent Test**: Search the frontend codebase and its automated tests/docs for references to the removed page and confirm none remain outside historical specification documents; run the automated test suite and confirm it passes.

**Acceptance Scenarios**:

1. **Given** the Analyze page is removed, **When** the frontend project is built, **Then** the build succeeds with no references to the removed page or its route.
2. **Given** the Analyze page is removed, **When** the automated test suite (including end-to-end tests that previously opened the Analyze page directly) runs, **Then** every test still passes, exercising the same user journey through the home page instead.
3. **Given** the Analyze page is removed, **When** current, user-facing documentation describing the app's pages/navigation is reviewed, **Then** it no longer lists a separate Analyze page.

### Edge Cases

- What happens to a user with an old bookmark or shared link pointing at the former Analyze page URL? It must resolve the same way the app already handles other retired routes (consistent with the precedent already set when the Automations page was removed) — not crash or show a blank/broken page.
- The Analyze page currently also shows a short list of recently-analyzed URLs (`RecentTargetsList`). Resolved: this component is preserved in the codebase but is **not** wired into the home page (or anywhere else) as part of this feature — it becomes intentionally unused, kept for a future feature to place. It is exempt from the "no leftover references" cleanup in User Story 3/FR-005 below.
- Does anything else assume the Analyze page exists (e.g., a link from elsewhere in the app pointing at it)? Any such reference must be updated to point at the home page instead, since that page now serves the same purpose.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST NOT present a navigation entry point (menu link, button, or shortcut) labeled "Analyze" or leading to a page distinct from the home page.
- **FR-002**: The app MUST NOT expose a reachable, dedicated Analyze page; visiting the former route MUST behave the same as visiting any other retired/unknown route in the app.
- **FR-003**: The home page MUST continue to support the full URL-submission flow (submit a URL, see live progress, land on results) without any behavior change caused by this removal.
- **FR-004**: Any automated test that currently exercises the URL-submission flow via the dedicated Analyze page MUST be updated to exercise the same flow via the home page instead, so coverage of that flow is not lost.
- **FR-005**: User-facing and contributor-facing documentation describing the app's pages/navigation MUST NOT list a separate Analyze page.
- **FR-006**: This removal MUST NOT alter the backend's analysis API in any way — it is a frontend page/navigation change only.
- **FR-007**: The recently-analyzed-URLs list component MUST be preserved in the codebase (not deleted) but MUST NOT be rendered on the home page or any other page as part of this feature — it is intentionally left unwired for a future feature to place.

### Key Entities

- **Analyze page** *(removed)*: A frontend page that duplicated the home page's URL-submission flow (submit URL → live progress → results). Being retired because the home page already provides the primary flow.
- **Recently-analyzed URLs list** *(preserved, unwired)*: The component the Analyze page used to show recently-analyzed URLs. Kept in the codebase per this feature's Assumptions/FR-007 but not placed anywhere; not deleted, not linked.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user browsing the app cannot find a separate "Analyze" nav item or page during normal exploration (0 discoverable dedicated-Analyze surfaces).
- **SC-002**: 100% of previously-passing tests in the frontend suite continue to pass after the removal, with the URL-submission journey still covered end-to-end via the home page.
- **SC-003**: The full submit-a-URL-and-view-results workflow completes successfully from the home page 100% of the time, matching pre-removal behavior exactly.
- **SC-004**: A repository-wide search for references to the removed page returns 0 results in active frontend source and user-facing docs (historical/spec documents describing prior decisions are exempt).

## Assumptions

- The former Analyze route resolving like any other retired/unknown route (rather than redirecting to home) is the correct default, consistent with the precedent already established when the Automations page was removed in this same codebase.
- The backend's `/analyze/{id}` API endpoint is a completely separate concept (a REST endpoint used internally by the analysis pipeline) and is explicitly out of scope — this feature only removes the frontend page and navigation entry.
- Historical specification documents (e.g., the original frontend spec that introduced this page) are a record of past decisions and are out of scope for editing; only currently-active documentation needs to stop describing a separate Analyze page.
- No replacement or redesigned entry point is being requested — this is a straight removal of a redundant page, not a redesign of the home page.
- The recently-analyzed-URLs component is deliberately kept but left unmounted rather than deleted or moved onto the home page now — the user explicitly chose this over both original options (move it now / delete it), preserving the option to place it in a future feature without redoing the work.
