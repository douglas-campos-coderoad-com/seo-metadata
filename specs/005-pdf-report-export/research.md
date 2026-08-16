# Phase 0 Research: PDF Report Export

**Feature**: 005-pdf-report-export | **Date**: 2026-08-16

This document resolves every `NEEDS CLARIFICATION` raised in the plan's Technical
Context, plus the five ambiguities that `/speckit-clarify` surfaced but that were
not answered interactively before planning began. Each of those five is resolved
here as an explicit, reversible decision rather than left as a blocker; they are
listed together in **§9 Decisions taken without clarification** so a reviewer can
overturn any of them cheaply.

---

## 1. PDF rendering engine

**Decision**: Render an HTML/CSS template to PDF with **Playwright's bundled
Chromium** (`page.pdf()`), driven from the existing async FastAPI process.

**Rationale**:

- `playwright==1.40.0` is already in `backend/requirements.txt`, and
  `backend/Dockerfile` already runs `playwright install-deps chromium` and
  `playwright install chromium` into `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`.
  **This feature therefore adds no new system-level rendering dependency** — it
  reuses the browser the ingestion path already ships. The spec's Assumption
  ("Generating the document introduces a new rendering dependency into the backend
  runtime") is already satisfied by the current image; only fonts need adding (§3).
- Chromium is the only candidate that gives, for free, all four of the layout
  requirements the spec states: page headers/footers with page numbers
  (`footerTemplate` with `pageNumber`/`totalPages` → FR-015), reliable long-token
  wrapping via `overflow-wrap`/`white-space: pre-wrap` (FR-019), full webfont and
  system-font embedding (FR-020), and real selectable text.
- Selectable text is not cosmetic here: the Overview states the document's core
  value is "copy-paste HTML fixes". A raster or image-based pipeline would destroy
  the feature's stated purpose.

**Alternatives considered**:

| Option | Rejected because |
|---|---|
| WeasyPrint | New pip + system dependency (cairo/pango). No JS, weaker CSS support, and no built-in running-header page counter — FR-015 would need manual pagination math. |
| ReportLab | Imperative canvas layout. Every requirement about wrapping, grouping and code blocks becomes hand-written layout code; highest effort, worst fidelity, violates Principle VIII. |
| wkhtmltopdf | Effectively unmaintained, ships a forked ancient WebKit, requires a new apt package, and renders modern CSS inconsistently. |
| Client-side (jsPDF / browser print) | Directly contradicts FR-002 (server-side, identical output regardless of client, producible without a browser). |

---

## 2. HTML templating

**Decision**: **Jinja2** with `autoescape=True`, templates under
`backend/src/templates/report/`.

**Rationale**: Jinja2 is a small, pure-Python addition and the conventional
FastAPI choice. Autoescaping is the security control that matters here (§7): the
report embeds attacker-influenced markup (`current_html`, `suggested_html`,
`optimized_html` originate from a third-party page and from an LLM), and every one
of those values must land in the document as **visible text inside a code block**,
never as live markup.

**Note**: `jinja2` must be added explicitly to `backend/requirements.txt`. It is
present transitively today, but depending on a transitive dependency for a direct
import is a build-fragility defect.

**Alternatives considered**: Python f-strings / `string.Template` (no autoescape —
rejected on security grounds); building the DOM via JS inside the page (moves logic
out of testable Python and into an untestable browser context).

---

## 3. Fonts and character coverage

**Decision**: Add `fonts-noto-core` and `fonts-noto-color-emoji` to the existing
`apt-get install` layer in `backend/Dockerfile`. The report CSS declares a font
stack that ends in the Noto families.

**Rationale**: `python-slim-bookworm` plus `playwright install-deps chromium`
provides Latin coverage (Liberation/DejaVu) but no CJK, no Arabic/Hebrew, and no
emoji. The spec's edge case "Non-Latin characters and emoji … must render correctly
rather than as missing glyphs" therefore fails on the current image. Noto Core plus
the colour-emoji font closes the gap for the scripts this tool realistically
encounters.

**Known limitation to verify during implementation**: Chromium rasterises
colour-emoji glyphs when printing to PDF. Emoji will appear correctly but as images
rather than selectable text. This is acceptable — the edge case requires "render
correctly rather than as missing glyphs", not selectability of emoji specifically.

---

## 4. Browser lifecycle and concurrency

**Decision**: One **long-lived Chromium instance** owned by the FastAPI app
(started on the `startup` event, closed on `shutdown`), with each export rendering
in its **own fresh `BrowserContext`**, guarded by an
`asyncio.Semaphore(REPORT_RENDER_CONCURRENCY)` defaulting to **2**.

**Rationale**:

- Launching a browser per request costs roughly 0.3–1s and a large memory spike;
  amortising the launch is what keeps SC-004's 10s budget comfortable.
- A per-export `BrowserContext` is the isolation boundary. This is precisely what
  satisfies the spec's edge case *"A concurrent export request while another is
  running for the same analysis must not corrupt or interleave the two documents"*:
  two exports share no cookies, no storage, no DOM, and no page state.
- The semaphore is the answer to unbounded resource growth. Chromium page renders
  are memory-heavy; without a bound, N simultaneous exports can OOM the API
  container and take down unrelated endpoints. Requests queue instead of failing.
- The browser is started lazily and re-launched if found disconnected, so a crashed
  Chromium degrades to a slow export rather than a permanently broken endpoint.

**Alternatives considered**: browser-per-request (simple, but wastes the launch cost
on every call and still needs a bound); a separate renderer microservice (correct at
much larger scale, but violates Principle VIII today — no second real use case yet).

---

## 5. Delivery model: synchronous vs. asynchronous job

**Decision**: **Synchronous.** `GET /api/v1/report/{analysis_id}/pdf` blocks and
returns the PDF bytes with `Content-Type: application/pdf` and a
`Content-Disposition: attachment` filename.

**Rationale**:

- It matches the two sibling endpoints already in the codebase: `POST /analyze/{id}`
  and `POST /optimize/{id}` both run a multi-second LangGraph pipeline synchronously.
  An async job model here would be the *only* one of its kind, and would need polling
  infrastructure, a job store, and a retention policy — none of which exist.
- SC-001 requires "a single action, with no intermediate configuration step", and
  SC-004 sets a 10s readiness budget. Rendering a document from data already in the
  database (no LLM calls, no network) is expected to land in the 1–4s range, well
  inside that budget.
- Principle VIII (simplicity, YAGNI): an async job pipeline is anticipated
  complexity, not a second real use case.

**Consequence to accept**: an export occupies a request slot for its duration, and
the semaphore in §4 means a third concurrent export waits. At the current scale this
is correct. The trigger for revisiting: sustained p95 above the 8s SLO, or exports
routinely exceeding 40 findings with very large markup.

**Alternatives considered**: 202 + job id + polling (correct at scale, unjustified
now); synchronous-with-async-fallback (worst of both — two code paths, two frontend
states, for a budget we are not close to exceeding).

---

## 6. Severity and category vocabularies — resolving a real conflict

**Finding**: the backend and the frontend use **different vocabularies today**, and
FR-013 requires the PDF to agree with the application.

- Backend prompt (`graph_nodes.py:283`) emits severity `critical | high | medium | low`
  and nine categories: `metadata, content, headings, images, structured_data, social,
  crawlability, performance, geo_aeo` (`graph_nodes.py:282`).
- Frontend (`frontend/src/shared/types`) knows only `good | warning | critical | medium`
  and four categories, collapsing the backend's values in
  `AnalysisApiService.mapSeverity` / `mapCategory` (`AnalysisApiService.ts:366-414`).
- Colours live in `frontend/src/styles/globals.css` as HSL custom properties and are
  bound to severities in `frontend/src/shared/lib/severity.ts`.

**Decision**:

1. **Categories** — the report groups by the **backend's nine categories**, using
   human-readable labels. This follows the spec's Assumption that "the severity and
   category vocabularies are those the analyser already produces", and it is strictly
   better for the reader: the UI's four-way collapse loses information a hand-off
   document should keep.
2. **Severity colours** — the report maps the backend's four severities through the
   **same collapse the UI applies** (`critical|high → critical`, `medium → medium`,
   `low → warning`, `pass/good → good`) and paints them with the **same colour
   values** as the app. This is what FR-013 actually demands: a reader moving between
   app and PDF must never be misled.
3. The mapping and the colour values are ported to **one Python module**
   (`src/services/report_mappings.py`) holding the severity collapse, the four
   colour tokens as literal HSL/hex, and the category labels.
4. A **parity contract test** asserts the Python severity table matches the
   TypeScript one. Without it, the two silently diverge on the next UI change and
   FR-013 breaks with no failing test.

**Colour tokens carried over** (from `globals.css:37-46`):

| Severity | CSS token | Value |
|---|---|---|
| critical | `--destructive` | `hsl(0 60% 48%)` |
| medium | `--medium` | `hsl(22 78% 50%)` |
| warning | `--warning` | `hsl(38 75% 48%)` |
| good | `--success` | `hsl(158 45% 38%)` |

**Alternatives considered**: re-using the UI's four collapsed categories (loses
detail the hand-off document exists to carry); having the frontend send its own
colours to the backend (breaks FR-002's "identical regardless of client").

---

## 7. Security: rendering untrusted markup

**Threat note** (required by Principle V for any new attack surface).

The report embeds strings that are **not trusted**: `current_html` and
`suggested_html` come from a third-party page and from an LLM, and `optimized_html`
comes from an LLM. Rendering them in a real browser is the risk this feature
introduces.

**Controls**:

1. **Autoescape on** in Jinja2, and every markup value rendered inside
   `<pre><code>` as text. No `|safe` filter anywhere in the report templates. This
   is the primary control: the markup is *displayed*, never *executed*.
2. **No network access from the render context.** The page is loaded via
   `page.set_content()` (not a URL), and a route handler aborts every outbound
   request. This kills SSRF via an injected `<img src="http://169.254.169.254/…">`
   and simultaneously guarantees FR-020 (self-contained, displays correctly offline)
   — nothing external can be referenced because nothing external can load.
3. **JavaScript disabled** in the rendering context. The report is static; no
   template needs script, so the capability is removed entirely.
4. **All CSS inlined** into the template; no external stylesheet or webfont URL.
5. **No internal identifiers in the output** (SC-005): database ids, ingested-url
   ids, and error stack traces are excluded from the rendered document.

---

## 8. Legacy and malformed stored data

**Decision**: the report builder **normalises defensively at the boundary**, in a
pure function, mirroring the pattern the frontend already proved in
`AnalysisApiService.ts:290-338`:

- A finding or recommendation stored as a **plain string** becomes an entry whose
  detail is that string, with category `content` and severity `warning`
  (FR-018). This is not hypothetical: `analysis_service.py:94` writes
  `[f'Error during analysis: {exc}']` on its error path.
- A **missing `html_change`**, or one whose `current_html` is empty, renders only
  the parts that exist; an absent element is labelled *"Element does not exist yet —
  this is an addition"* rather than printing an empty code block.
- **Unknown severity or category values** fall back to `warning` / `content` rather
  than raising, exactly as `mapSeverity`'s `default` branch does.
- A recommendation whose `finding_id` matches no finding is still rendered, in an
  "Additional recommendations" group — it is never dropped, because SC-002 requires
  100% of stored recommendations to appear.
- `analysis` being `NULL` on a `completed` row yields an empty-but-valid report
  stating no issues were detected.

Because this normalisation is a pure function over the stored JSON, it is unit
tested without a browser — which is what keeps the expensive PDF integration tests
few and the edge-case coverage (SC-008) cheap.

---

## 9. Decisions taken without clarification

`/speckit-clarify` was invoked but ended with **0 of 5 questions answered** before
`/speckit-plan` began. Those five ambiguities are resolved above as engineering
decisions. Each is cheap to reverse; none blocks implementation.

| # | Open question | Decision | Where | Reversal cost |
|---|---|---|---|---|
| 1 | Sync response vs. async job | Synchronous | §5 | Low — endpoint shape changes, service layer unchanged |
| 2 | Behaviour on a very large analysis | Never drop content; truncate an individual code block above 20,000 chars with an explicit "N characters omitted" note | §10 | Low — one constant |
| 3 | Concurrency / throttling | Shared browser, per-export context, `Semaphore(2)` | §4 | Low — one env var |
| 4 | Text fidelity / accessibility | Real selectable text mandatory; tagged-PDF structure best-effort | §11 | Medium |
| 5 | Cover-page branding | No branding beyond the report title; the cover carries URL, date, and score only, per FR-011 | — | Low — template edit |

---

## 10. Large-analysis policy

**Decision**: The spec's edge case offers a choice — "must still produce a complete
document without truncation, **or** must state clearly what was omitted and why".
We take the first branch for *records* and the second for *oversized individual
values*:

- **No finding and no recommendation is ever dropped**, at any size. SC-002 makes
  omission a defect.
- A **single markup block** longer than `REPORT_MAX_CODE_CHARS` (default 20,000) is
  truncated, and the block is followed by an explicit line:
  *"… truncated, N characters omitted."* This bounds a pathological single value
  (a minified page inlined into `suggested_html`) without ever silently losing a
  record.

**Rationale**: silent truncation would violate SC-005 ("no truncated content" being
sendable to a client) by hiding the loss; an explicit, visible note satisfies the
spec's stated alternative and keeps the reader informed.

---

## 11. Determinism (SC-007)

**Decision**: SC-007 is satisfied as **content equivalence, not byte equality**.

**Rationale**: Chromium stamps a `CreationDate` into the PDF trailer, so two
renders of identical input differ in bytes. The requirement is that a regenerated
report "matches one sent earlier" in what it says. Controls:

- The document displays the **analysis date**, never the generation timestamp.
- Findings render in **stored order**, with ties broken by finding `id` — no
  set/dict iteration order leaks into the layout.
- No random ids, no "generated at" line in the visible content.

The test asserts extracted-text equality across two renders, not byte equality.

---

## 12. Performance target

**Decision**: **p95 < 8s** for a typical analysis (≤ 40 findings), measured from
request to last byte, explicitly excluding cold browser launch.

**Rationale**: Principle VII requires a per-feature latency SLO and sets defaults of
p95 < 300ms for reads. A document render cannot meet that, so this feature declares
an explicit exception rather than silently blowing the budget (recorded in the
plan's Complexity Tracking). 8s sits under SC-004's 10s user-facing promise with
margin for queueing behind one other export.

---

## 13. Frontend integration

**Decision**: A single `ExportReportButton` on the run results page
(`frontend/src/app/runs/[runId]/page.tsx`), enabled only when
`run.backendAnalysisId` is set and the run is complete. It fetches the PDF as a
blob and triggers a download via an object URL.

**Rationale**: the page already gates on `run.backendAnalysisId` (line 32), so the
enabling condition is established. A blob download is required because the existing
`ApiClient` only parses JSON — the export needs `response.blob()` and must read the
filename from `Content-Disposition`, so it adds one focused method rather than
bending the shared client.

Per SC-004 the button holds a busy state for the duration and is disabled while in
flight, which also prevents a user from queueing duplicate renders by double-click.

**Note on Principle I**: the repo has no `packages/api-client`; the client at
`frontend/src/lib/api-client.ts` is hand-written. This is **pre-existing drift**
from the constitution, not introduced here. This feature follows the existing
pattern and does not attempt a repo-wide client-generation migration.
