# Feature Specification: SEO Analyzer Application

**Feature Branch**: `003-seo-analyzer-frontend`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "the frontend is an application page, the previous incollect static website is not needed anymore, we are creating a new brand application that given an url is capable of detect, score and suggest different changes to improve the SEO, so the frontend is the place we manage the different seo projects... Given an url of a static website, the UI is capable of call the backend to start the analysis, it would take some time so realtime notification is important some kind of socket that sends the status updates, for now we don't have a well prepared backend for it create only the service as agnostic as possible. Mock the service (backend interaction) with ts data files. Design an interesting UI that summarizes found recommendations including: ranking (0-100), color ranges per metric, meta tag descriptions/metrics, content improvement suggestions, HTML structure and use suggestions, file sizes, direct copy-paste code generation, and a clear results UI. The UI manages projects; a project can include multiple static URLs to be analyzed; the user can also run a simple analysis without a project; projects relate results across URLs to surface shared patterns; both project-based and simple analyses keep historical data as a timeline; projects support automations — scheduled, calendarized recurring analysis jobs via a user-friendly scheduling mechanism. The UI must be responsive (desktop and mobile). Use a feature-based architecture that is simple and easy to scale. Include a landing/initial page."

## Note on Scope Change

This specification **supersedes** the marketplace/browsing frontend described in `specs/001-catalog-discovery/`. The curated-catalog UI (browse gallery, item detail, dealer inquiries) is no longer part of the product direction; this feature defines the application that replaces it end-to-end, built around SEO analysis of user-submitted URLs.

## Clarifications

### Session 2026-08-09

- Q: When a user submits one URL, does the analysis cover only that exact page, or does it automatically discover and analyze other pages on the same site? → A: Single page only — each analysis run covers exactly the submitted URL. Site-wide coverage comes from adding multiple URLs to a Project.
- Q: Where does the data for projects, analyses, and history live in this phase, given there's no real backend yet? → A: In-memory only — projects, analyses, and history persist while navigating within a session, but a full page reload resets everything back to empty.
- Q: If the same URL is added to two different projects (or analyzed standalone and also added to a project), should it share one history, or get separate independent histories per context? → A: Global identity — a URL has exactly one identity and one shared run history system-wide, regardless of how many projects reference it or whether it's also analyzed standalone.
- Q: Does this application need to meet a formal accessibility standard (e.g., WCAG 2.2 AA), or is baseline responsive/semantic HTML enough for this phase? → A: No formal target for this phase — baseline semantic HTML and responsive layout only; no formal WCAG audit or enforced accessibility testing.
- Q: Can multiple analyses run at the same time (e.g., a project with several URLs kicks off all of them at once), or does the system process one analysis at a time? → A: Concurrent — multiple analyses can run in parallel, each with independent live progress.
- Q: Automations were modeled at both the project level and the URL level (one each). Should a URL be able to hold multiple automations, and should project-level automations be removed? → A: Automations belong only to a URL going forward (project-level automation removed); a single URL may hold multiple automations, and different URLs may have entirely different schedules.
- Q: What visual direction should the color palette take? → A: A distinct indigo/violet primary brand color, separate from the existing green/amber/red severity color-coding, aiming for a more distinctive, less generic look. **Superseded** by the 2026-08-10 session below — gradients and this indigo/violet direction were replaced with the "Dawn Patrol" palette after user feedback that gradients read as generic/common.

### Session 2026-08-10

- Q: The indigo/violet gradient theme was reported as generic and common across other sites — what should replace it? → A: "Dawn Patrol," a fully-specified dark-first ocean palette and type system provided by the user: Abyss `#071A28` (background), Ocean `#0E4C5B` (panels/cards), Glass `#5EC5D1` (links/active/focus), Foam `#EDF6F5` (text), Sunrise `#FF7A5C` (accent — primary CTA + key marker only, used sparingly), Golden `#FFCB6B` (positive deltas/highlights); typography: Clash Display (headings, used sparingly), Hanken Grotesk (body), Space Mono (data/metrics, tabular figures); style principles: soft 8–16px corners, depth from background lifts rather than heavy shadows, generous negative space, horizontal banding over card grids, minimal ambient motion ("a slow swell"), calm neutral error states instead of alarm-red, metrics presented like a surf forecast. This **also redefines the severity system**: no separate light theme was specified (this is the single default theme, not gated behind a `.dark` class); "good" now maps to Golden, "critical/failed" now maps to a muted, desaturated calm-neutral tone (not bright red) rather than the original independent traffic-light green/amber/red.
- Q: Should the single-URL analyze input be reachable only from `/analyze`, or available directly on the landing page? → A: The landing page now embeds the same URL-submission input and live-status flow directly (not just a CTA link), so a user can interact with the core functionality at first glance without navigating away. `/analyze` remains available as its own route.
- Q: The dark-first "Dawn Patrol" theme above was reported as not the better choice for users — what should change? → A: Convert the theme to light, keeping the same Dawn Patrol brand hues (Ocean, Glass, Foam, Sunrise, Golden) but restructured for a light background rather than inverted 1:1 (e.g., Foam's hue becomes the pale page background instead of foreground text; Ocean/Glass are deepened where used as text/links for legible contrast on light surfaces). This remains a single theme with no toggle — light now, as dark was before — not a light/dark pair.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analyze a Single URL (Priority: P1)

A user lands in the app, enters a URL for a static website, and starts an analysis without needing to create a project first. They see live progress while the analysis runs, and when it completes they see a results view with an overall 0–100 score, color-coded metrics, and categorized findings (meta tags, content, HTML structure, file sizes) with concrete suggestions — including ready-to-copy code snippets — for improving SEO.

**Why this priority**: This is the core value proposition of the product. Every other capability (projects, history, automations) exists to organize and extend this single interaction, so it must work standalone first.

**Independent Test**: Can be fully tested by submitting one URL with no project selected, watching status update from "queued" → "running" → "complete," and verifying the results view renders a score, color-coded findings by category, and at least one copyable code suggestion.

**Acceptance Scenarios**:

1. **Given** the user is on the analyze screen, **When** they enter a valid URL and start analysis, **Then** the system shows a live-updating status (e.g., queued, fetching, analyzing, complete) without requiring a manual page refresh.
2. **Given** an analysis is running, **When** it finishes successfully, **Then** the user sees an overall score (0–100), a breakdown by category (meta tags, content, HTML structure, file sizes), and each finding's severity communicated by color.
3. **Given** a finding has a concrete fix, **When** the user views it, **Then** a ready-to-copy code snippet is available with a one-action copy control.
4. **Given** the user enters an invalid or unreachable URL, **When** they start analysis, **Then** the system shows a clear error and does not enter a "running" state.
5. **Given** an analysis is running, **When** the underlying connection to status updates drops, **Then** the UI indicates it lost the live connection and offers a way to recover (e.g., reconnect or check status manually), rather than appearing to hang silently.

---

### User Story 2 - Organize URLs into Projects and Spot Shared Issues (Priority: P2)

A user creates a project and adds multiple URLs from the same site to it. They run analysis across the project's URLs and can see, across all of them, which SEO issues recur — so they know a problem is systemic (e.g., a template-level issue) rather than isolated to one page.

**Why this priority**: Once single-URL analysis works (P1), grouping URLs is the next highest-value step — it turns individual findings into actionable, site-wide insight, which is a key differentiator from a one-off checker.

**Independent Test**: Can be fully tested by creating a project, adding 2+ URLs, running analysis on each, and verifying a cross-URL view highlights findings that appear on more than one URL in the project — independent of history or automation features.

**Acceptance Scenarios**:

1. **Given** the user is managing projects, **When** they create a new project and add one or more URLs, **Then** the project persists and lists its URLs with their latest analysis status.
2. **Given** a project has multiple analyzed URLs, **When** the user views the project summary, **Then** findings that recur across two or more URLs are surfaced as shared/systemic issues, distinct from issues unique to one page.
3. **Given** the user no longer wants a project-based analysis, **When** they choose to analyze a URL standalone, **Then** the system does not require selecting or creating a project.
4. **Given** a project has no URLs yet, **When** the user views it, **Then** they see guidance to add a URL rather than an empty/broken screen.

---

### User Story 3 - Review Historical Trends Over Time (Priority: P3)

A user revisits a previously analyzed URL (standalone or inside a project) and sees a timeline of past analysis runs, so they can tell whether SEO health is improving, worsening, or unchanged over time.

**Why this priority**: History depends on there being results to look back on (P1/P2), and it delivers meaningful value on its own — tracking progress — without requiring automation to exist yet.

**Independent Test**: Can be fully tested by running analysis on the same URL at two different points in time and verifying both runs appear as distinct points on that URL's timeline, viewable independent of any scheduling feature.

**Acceptance Scenarios**:

1. **Given** a URL has been analyzed more than once, **When** the user opens its history, **Then** they see each past run as a point in a timeline, each with its score and date.
2. **Given** the user selects a past run from the timeline, **When** viewed, **Then** they see that run's full results as they appeared at that time.
3. **Given** a URL belongs to a project, **When** the user views project-level history, **Then** they can see how the project's aggregate/shared issues have changed across runs over time.
4. **Given** a URL has only one run so far, **When** the user views its history, **Then** the system shows that single data point without implying a trend that doesn't yet exist.

---

### User Story 4 - Schedule Recurring Analyses (Automations) (Priority: P4)

A user sets up an automation on a URL so that analysis reruns automatically on a recurring schedule (e.g., weekly), without the user needing to remember to trigger it manually — feeding new data points into that URL's historical timeline automatically. A URL may have more than one automation (e.g., a quick daily check and a deeper weekly one), each with its own independent schedule.

**Why this priority**: Automations are a force-multiplier on top of history (P3) — valuable, but the product delivers its core promise without them, so they come last.

**Independent Test**: Can be fully tested by configuring a recurring schedule on a URL and verifying the schedule is saved, displayed in a human-readable form (e.g., "every Monday at 9am"), and can be edited or canceled — independent of whether a real trigger engine exists yet.

**Acceptance Scenarios**:

1. **Given** the user is viewing a URL's history, **When** they set up a recurring schedule using a calendar-friendly picker, **Then** the schedule is saved and displayed in plain language.
2. **Given** an automation is active, **When** the user views it, **Then** they can see when it last ran and when it is next scheduled to run.
3. **Given** a URL already has one automation, **When** the user adds another schedule to the same URL, **Then** both automations exist independently, each tracked and displayed separately.
4. **Given** the user no longer wants an automation, **When** they pause or delete it, **Then** only that automation stops appearing as active and no longer contributes new scheduled runs — any other automations on the same URL are unaffected.
5. **Given** a scheduled run occurs, **When** it completes, **Then** its result is added to the URL's historical timeline exactly as a manually triggered run would be.

---

### User Story 5 - Land on an Introductory Page (Priority: P5)

A first-time visitor arrives at the application's landing page, understands what the product does, and can start their first analysis immediately, right there, without navigating anywhere else first (see Clarifications).

**Why this priority**: Important for adoption and first impressions, but the application delivers its full functional value without it — this can be the last piece added.

**Independent Test**: Can be fully tested by visiting the root URL as a new visitor and verifying the page explains the product's purpose and offers the same URL-submission input used elsewhere in the app, independent of all other features being complete.

**Acceptance Scenarios**:

1. **Given** a new visitor opens the application root, **When** the landing page loads, **Then** they see an explanation of what the tool does and a working URL-submission input, not just a link elsewhere.
2. **Given** a new visitor, **When** they submit a URL directly from the landing page, **Then** the same live-progress-then-results flow used elsewhere in the app runs, without requiring a prior navigation to a separate analyze screen.
3. **Given** a returning user, **When** they open the application root, **Then** they can reach their existing projects/history from the landing entry point without confusion.

---

### Edge Cases

- What happens when a user submits a URL that returns non-HTML content (e.g., a PDF)? The analysis should fail clearly with a reason, not silently produce an empty/misleading score.
- What happens if live status updates are unavailable entirely (e.g., real-time channel never connects)? The user must still be able to learn the outcome (e.g., by checking status on return) rather than being stuck on a permanent "starting" state.
- How does the system handle a project with a large number of URLs (e.g., 50+)? The shared-issue view must remain readable rather than becoming an unreadable wall of results.
- What happens if two automations on overlapping targets would trigger at the same time? Each should still run and record independently.
- What happens when a user views results on a small/mobile viewport? All findings, scores, and code snippets must remain fully readable and copyable without horizontal scrolling.
- What happens if a scheduled automation's target URL has since become unreachable? That run should be recorded as a failed run in history, not silently skipped without a trace.
- What happens if the user tries to add the same URL to a project twice, or the same URL to two different projects (or standalone and also to a project)? Resolved: URLs are globally unique Analysis Targets (see Clarifications); adding an existing URL anywhere else in the system creates a new reference to the same target and its one shared history — it never creates a duplicate, disconnected history.

## Requirements *(mandatory)*

### Functional Requirements

**Analysis (core)**
- **FR-001**: System MUST allow a user to submit a single static-website URL for SEO analysis without requiring a project. Each analysis run MUST cover only the exact submitted URL — the system MUST NOT automatically discover or analyze other pages on the same site; multi-page coverage is achieved only by adding multiple URLs to a Project (see Projects requirements).
- **FR-002**: System MUST validate submitted URLs and reject malformed input before starting analysis.
- **FR-003**: System MUST show live-updating analysis status (e.g., queued, in progress, complete, failed) without requiring the user to manually refresh the page. Multiple analyses MUST be able to run concurrently, each with its own independently tracked live status.
- **FR-004**: System MUST clearly indicate when the live status connection is lost and provide a way to recover the current status.
- **FR-005**: System MUST implement the analysis-triggering and status-update mechanism behind a backend-agnostic interface, so the current mocked implementation can later be replaced by a real backend without changing the UI layer.

**Results & Recommendations**
- **FR-006**: System MUST present an overall SEO score from 0 to 100 for each completed analysis.
- **FR-007**: System MUST define and consistently apply color ranges to communicate severity for every scored metric (e.g., good / needs improvement / critical).
- **FR-008**: System MUST present meta-tag-related findings, including which tags were checked and their current values/state.
- **FR-009**: System MUST present content-improvement suggestions derived from the analyzed page.
- **FR-010**: System MUST present HTML structure and semantic-usage suggestions (e.g., heading hierarchy, structural issues).
- **FR-011**: System MUST report file-size metrics relevant to the analyzed page.
- **FR-012**: System MUST provide ready-to-copy code snippets for findings that have a concrete code-level fix, with a one-action copy control.
- **FR-013**: System MUST present all of the above (score, categorized findings, suggestions, snippets) in a single, clearly organized results view per analysis run.

**Projects**
- **FR-014**: System MUST allow a user to create a project and add multiple URLs to it. If an added URL is already known to the system (standalone or in another project), the project MUST reference that URL's existing Analysis Target and shared history rather than creating a duplicate.
- **FR-015**: System MUST allow analysis to be run per-URL within a project, including triggering analysis for several of a project's URLs at once and tracking each concurrently.
- **FR-016**: System MUST identify and surface findings that recur across two or more URLs within the same project as shared/systemic issues, distinct from single-page findings.
- **FR-017**: System MUST allow analysis to be run without any project (standalone), independent of the projects feature.

**History**
- **FR-018**: System MUST retain a historical record of every analysis run, for both standalone URLs and project URLs, for the duration of the current session (in-memory); a full page reload resets all data in this phase (see Assumptions).
- **FR-019**: System MUST present a URL's (or project's) historical runs as a timeline of dated data points, each showing at least its score.
- **FR-020**: System MUST allow a user to open any past run and view that run's full results as captured at that time.

**Automations**
- **FR-021**: System MUST allow a user to configure a recurring schedule (automation) for a URL, using a calendar-friendly scheduling interface. A URL MUST be able to hold more than one automation at a time, each with its own independent schedule.
- **FR-022**: System MUST display each automation's schedule in a human-readable form, along with its last-run and next-scheduled-run times.
- **FR-023**: System MUST allow a user to pause, resume, or delete an existing automation.
- **FR-024**: Completed automation-triggered runs MUST appear in the same historical timeline as manually triggered runs, with no distinction required for the user to understand history.

**Application shell**
- **FR-025**: System MUST provide a landing page that explains the product's purpose and embeds the same URL-submission input (not merely a link to it) so a user can start an analysis directly from the landing page at first glance.
- **FR-026**: System MUST be fully usable on both desktop and mobile viewport widths across all screens (landing, analyze, results, projects, history, automations).

### Key Entities

- **Analysis Target**: A single URL the user wants analyzed, identified globally and uniquely across the system (one URL = one Analysis Target). May be referenced by zero or more Projects and/or analyzed standalone; every reference shares the same run history and most-recent-run status — there is exactly one timeline per URL regardless of how many contexts reference it.
- **Project**: A named grouping of references to one or more Analysis Targets belonging to the same site/initiative. Aggregates shared findings across its referenced targets' histories. Adding a URL already known elsewhere in the system simply adds a reference to the existing Analysis Target rather than creating a new one. Automations are not configured at the project level — they belong to individual targets (see Automation).
- **Analysis Run**: One execution of the analysis process against an Analysis Target at a point in time. Attributes: target reference, status (queued/running/complete/failed), start/completion timestamps, overall score, failure reason (if any). Represents one point on a target's history timeline.
- **Finding**: A single scored observation from an Analysis Run within a category (meta tags, content, HTML structure, file size). Attributes: category, severity/color range, description, metric value(s), suggested fix description, optional copyable code snippet.
- **Shared Issue**: A Finding pattern detected as recurring across two or more Analysis Targets within the same Project.
- **Automation**: A recurring schedule attached to exactly one Analysis Target (URL). A target may have multiple Automations, each independent. Attributes: recurrence rule (human-readable), target reference, active/paused state, last-run reference, next-scheduled-run time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from entering a URL to seeing full analysis results (for a typical static page) with visible progress throughout, with zero manual refreshes required.
- **SC-002**: 90% of users can identify at least one actionable, copy-ready fix from a results view without external help (first-attempt task success).
- **SC-003**: A user managing a project with 5+ URLs can identify at least one issue shared across multiple pages in under 1 minute.
- **SC-004**: A user can configure a recurring automation for a URL in under 2 minutes.
- **SC-005**: A user can locate and open a specific past analysis run from a target's history in under 30 seconds.
- **SC-006**: All core screens (landing, analyze, results, projects, history, automations) remain fully usable with no horizontal scrolling or clipped content on mobile viewport widths.
- **SC-007**: 100% of failed analysis runs (invalid URL, unreachable page, unsupported content) display a specific, human-readable failure reason rather than a generic error.

## Assumptions

- **No real backend exists yet.** This phase delivers the frontend against a mocked service layer (backed by static/fixture data) that mirrors the intended real API and real-time status contract, so the mock can later be swapped for a live backend with minimal UI changes. Actual SEO analysis logic, scraping, and scoring computation are simulated, not really performed.
- **No formal accessibility standard (e.g., WCAG) is required for this phase** (see Clarifications). Baseline semantic HTML and responsive layout are expected, but no formal audit or enforced accessibility testing gate is in scope; this can be raised to a hard requirement in a later iteration.
- **Data persistence is session-scoped only (in-memory) in this phase** (see Clarifications). Projects, analyses, and history survive while the user navigates within the app but are reset on a full page reload. Durable storage (browser-persisted or real backend-backed) is a future iteration, not part of this spec.
- **Automation execution is simulated in this phase.** Since there is no backend job runner yet, "triggering" a scheduled run is mocked/simulated for demonstration purposes; the UI and data model behave as if a real scheduler exists.
- **No authentication/multi-user separation is required in this phase.** The application is treated as a single-workspace tool (consistent with there being no backend yet). Multi-user accounts and access control can be introduced in a later iteration if the product is exposed to multiple external users.
- **"Static website" scope**: analysis targets are assumed to be publicly reachable, primarily static/server-rendered pages (consistent with the agnostic scraping approach already defined for backend ingestion); JavaScript-heavy SPA analysis quality may be limited until backend scraping (with its Playwright fallback) is actually connected. Each analysis run is scoped to exactly one page (the submitted URL) — no automatic crawling (see Clarifications).
- **This feature entirely replaces** the catalog/marketplace frontend scope from `specs/001-catalog-discovery/`; no marketplace UI (browse gallery, dealer inquiries, item admin) is preserved or extended going forward.
- Real-time status updates are assumed to use a persistent, push-based connection (e.g., a WebSocket-style channel); the exact transport and its mocked equivalent are technical decisions to be finalized in the implementation plan, not in this spec.
- UI visual design system, component library, and frontend code organization (e.g., feature-based folder structure) are implementation decisions to be finalized in the implementation plan, not in this spec.
