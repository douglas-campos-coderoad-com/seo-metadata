# Feature Specification: PDF Report Export

**Feature Branch**: `005-pdf-report-export`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Create a spec that allows to export all findings and recommendations and the SEO and GEO score to PDF."

## Overview

A completed analysis currently lives only inside the application. Its value — the scores, the findings, and above all the copy-paste HTML fixes — cannot leave the screen. This feature produces a single, self-contained, client-facing PDF report for one analysis run, so the result can be sent to a client, attached to a ticket, handed to a developer who has no access to the app, or archived as evidence of a page's state on a given date.

The report is a hand-off document, not a screenshot: every recommendation carries the exact current and suggested markup, so a developer can implement the whole report without ever opening the tool.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export a completed analysis as a PDF (Priority: P1)

A user has run an analysis on a URL and is looking at the results. They choose to export, and receive a PDF containing the SEO score, the GEO score, the overall score, both score breakdowns, the GEO visibility narrative, every finding, and every recommendation with its full HTML change. The document opens correctly in any standard PDF reader and reads as a finished report, not a data dump.

**Why this priority**: This is the entire feature. Without it nothing is exportable; with it alone the feature already delivers its full value.

**Independent Test**: Run an analysis on a URL, request the export, and verify the resulting file is a valid PDF whose content matches the analysis stored for that run — scores, every finding, and every recommendation present, with no placeholder or empty sections.

**Acceptance Scenarios**:

1. **Given** an analysis in `completed` status, **When** the user requests the PDF export, **Then** a valid PDF file is returned with a filename derived from the analysed URL and the analysis date.
2. **Given** an analysis with findings and recommendations, **When** the PDF is generated, **Then** every finding in the stored analysis appears in the document, and no finding is omitted or truncated.
3. **Given** a recommendation that carries an HTML change, **When** the PDF is generated, **Then** both the current markup and the suggested markup are printed as distinct, readable code blocks, with the location of the change stated.
4. **Given** an analysis whose scores are present, **When** the PDF is generated, **Then** the SEO, GEO, and overall scores are shown alongside the per-dimension breakdown of each.
5. **Given** an analysis that does not exist, **When** the user requests the export, **Then** a clear not-found error is returned and no file is produced.
6. **Given** an analysis in `failed` or `pending` status, **When** the user requests the export, **Then** the request is rejected with a clear message stating the analysis is not exportable, rather than producing an empty report.

---

### User Story 2 - Include the optimizer results when they exist (Priority: P2)

When the user has already run the optimizer (feature `004-seo-optimizer`) for that analysis, the exported PDF additionally contains the optimizer's output: the optimized HTML, the enriched JSON-LD, and the before/after score comparison. When no optimization exists, the report is still complete and makes no reference to a missing section.

**Why this priority**: It significantly increases the document's value as a hand-off artifact, but the export is already useful without it, and it depends on a separate feature having been run.

**Independent Test**: Export one analysis that has an optimization and one that does not; verify the first contains the optimizer sections with before/after scores and the second is a complete document with no empty or dangling optimizer section.

**Acceptance Scenarios**:

1. **Given** an analysis with a completed optimization, **When** the PDF is generated, **Then** the document includes the optimized HTML, the enriched JSON-LD, and the before/after scores.
2. **Given** an analysis with no optimization, **When** the PDF is generated, **Then** the document omits the optimizer sections entirely and remains internally consistent (table of contents, section numbering, and page references match the content).
3. **Given** an analysis whose optimization is in `failed` status, **When** the PDF is generated, **Then** the optimizer sections are omitted exactly as if no optimization existed.

---

### User Story 3 - Present the report to a client (Priority: P3)

The PDF is presentable to a non-technical stakeholder: a cover page carries the analysed URL and the analysis date, the scores are shown visually rather than as bare numbers, severity is colour-coded consistently with the application, and findings are grouped into labelled sections rather than presented as one flat list.

**Why this priority**: Presentation determines whether the document can be sent to a client unedited, but a plain correct report already satisfies the core need.

**Independent Test**: Generate a report and confirm the cover page, the score visualisation, the severity colour coding, and the section grouping are present, and that the severity colours match those used in the application.

**Acceptance Scenarios**:

1. **Given** any exportable analysis, **When** the PDF is generated, **Then** the first page shows the analysed URL, the analysis date, and the overall score.
2. **Given** findings of differing severities, **When** the PDF is generated, **Then** each finding is visually marked with its severity using the same colour meaning as the application.
3. **Given** findings spanning several categories, **When** the PDF is generated, **Then** findings are grouped under their category with a heading per group.
4. **Given** a report of any length, **When** the PDF is generated, **Then** every page after the cover carries a page number and the analysed URL, so printed pages remain attributable.

---

### Edge Cases

- **An analysis with no findings and no recommendations.** The report must still be produced, showing the scores and stating explicitly that no issues were detected — never a blank section.
- **Legacy analyses stored as plain strings.** Older stored analyses hold findings and recommendations as plain text rather than structured objects, and the backend's own error path writes a plain-text finding. The report must render these as text without failing and without printing raw object syntax.
- **A recommendation with no HTML change**, or one whose current markup is empty because the element does not yet exist. The report must show only the parts that exist and label an absent element as such rather than printing an empty code block.
- **Very long markup in a code block.** Long, unbroken lines of HTML must wrap or otherwise stay inside the page margin; content must never be clipped off the edge of the page.
- **Non-Latin characters and emoji** in the page title, findings, or markup must render correctly rather than as missing glyphs.
- **A very large analysis** (many findings, each with long markup) must still produce a complete document without truncation, or must state clearly what was omitted and why.
- **Repeated exports of the same unchanged analysis** must produce equivalent content, so a report can be regenerated and still match one sent earlier.
- **A concurrent export request** while another is running for the same analysis must not corrupt or interleave the two documents.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to export a single completed analysis as a PDF document.
- **FR-002**: System MUST generate the PDF server-side, so the output is identical regardless of the client that requested it and can be produced without a user's browser.
- **FR-003**: The report MUST include the SEO score, the GEO score, and the overall score for the analysis.
- **FR-004**: The report MUST include the full per-dimension breakdown behind each of the SEO and GEO scores.
- **FR-005**: The report MUST include the GEO visibility narrative from the analysis.
- **FR-006**: The report MUST include every finding stored on the analysis, with its title, its detail, its severity, and its category.
- **FR-007**: The report MUST include every recommendation stored on the analysis, with its action, its rationale, its priority, and its effort.
- **FR-008**: For each recommendation carrying an HTML change, the report MUST print the change location, the current markup, and the suggested markup, each as a distinct, readable code block.
- **FR-009**: The report MUST associate each recommendation with the finding it resolves, so a reader can see which problem each fix addresses.
- **FR-010**: The report MUST include the optimizer output — optimized HTML, enriched JSON-LD, and before/after scores — when a completed optimization exists for the analysis, and MUST omit those sections entirely when it does not.
- **FR-011**: The report MUST open with a cover page carrying the analysed URL, the analysis date, and the overall score.
- **FR-012**: The report MUST group findings into labelled sections by category rather than presenting one undifferentiated list.
- **FR-013**: The report MUST colour-code severity using the same severity meanings the application uses, so a reader moving between the two is never misled.
- **FR-014**: The report MUST present the scores visually, not as bare numbers alone.
- **FR-015**: Every page after the cover MUST carry a page number and the analysed URL.
- **FR-016**: System MUST reject an export request for an analysis that is not in a completed state, with a message that distinguishes "not found" from "not yet exportable".
- **FR-017**: System MUST name the downloaded file after the analysed URL and the analysis date, so multiple exports remain distinguishable on disk.
- **FR-018**: System MUST render findings and recommendations that are stored as plain text — as legacy records and the analyser's error path produce — as readable text, without failing and without exposing raw internal data structures.
- **FR-019**: System MUST keep all report content within the printable page area, wrapping long markup rather than clipping it.
- **FR-020**: System MUST render the report as a self-contained document that displays correctly with no network access when opened.
- **FR-021**: System MUST return a clear, actionable error when report generation fails, and MUST NOT return a partial or corrupt file.
- **FR-022**: The export MUST be subject to the same authorization as viewing the analysis itself: a user who may not view an analysis MUST NOT be able to export it.

### Key Entities

- **Analysis Report**: The generated document for one analysis run. Composed at request time from the analysis and, when present, its optimization. Attributes: the analysed URL, the analysis date, the three scores, the two score breakdowns, the visibility narrative, the ordered list of findings, the ordered list of recommendations, and the optional optimizer section.
- **Report Finding Entry**: A single finding as it appears in the document. Attributes: category, severity, title, detail, and the recommendation that resolves it, if any.
- **Report Recommendation Entry**: A single recommendation as it appears in the document. Attributes: the finding it resolves, action, rationale, priority, effort, and the HTML change (location, current markup, suggested markup).
- **Optimizer Section**: The optional portion sourced from an existing optimization. Attributes: optimized HTML, enriched JSON-LD, score before, score after.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from viewing a completed analysis to holding the PDF in a single action, with no intermediate configuration step.
- **SC-002**: 100% of the findings and recommendations stored on an analysis appear in its exported report — an automated comparison between stored analysis and generated document finds no omissions.
- **SC-003**: A developer given only the PDF can apply every recommended change without access to the application, because each change states its location, its current markup, and its replacement.
- **SC-004**: A report for a typical analysis is ready within 10 seconds of being requested, and the user is told the export is in progress rather than left with an unresponsive action.
- **SC-005**: The exported report can be sent to a client without editing: no placeholder text, no empty sections, no truncated content, and no internal identifiers exposed on the page.
- **SC-006**: Exporting an analysis that has an optimization and one that does not both succeed, and the report without an optimization contains no evidence that a section is missing.
- **SC-007**: Re-exporting an unchanged analysis produces a document whose content matches the previous export.
- **SC-008**: Every documented edge case — no findings, plain-text legacy records, absent HTML change, oversized markup, non-Latin characters — produces a complete, readable report rather than an error or a visual defect.

## Assumptions

- The export covers exactly one analysis run. Exporting a whole project, or comparing two runs side by side, is out of scope for this feature and would be specified separately.
- The report is generated on demand from the stored analysis and is not itself persisted; regenerating an unchanged analysis is expected to reproduce the same content, which makes storing the file unnecessary.
- The report is produced in the language the analysis content is already written in; multi-language report generation is out of scope.
- The scores, findings, recommendations, and HTML changes are consumed as the analyser already stores them. This feature does not re-run, re-score, or re-word an analysis, and it does not correct a deficient one.
- The severity and category vocabularies are those the analyser already produces. Where the report groups or colours them, it reuses the same mapping the application applies, so the two never disagree.
- The optimizer feature (`004-seo-optimizer`) is the only source of the optional optimizer section; if that feature's output shape changes, this report changes with it.
- Existing authentication and authorization are reused; this feature introduces no new access model.
- Generating the document introduces a new rendering dependency into the backend runtime, and the deployment image must carry whatever fonts the report's character coverage requires.
