# Quickstart & Validation: PDF Report Export

**Feature**: 005-pdf-report-export | **Date**: 2026-08-16

How to run and validate this feature end to end. Structures are in
[data-model.md](data-model.md); the endpoint is in
[contracts/report-api.md](contracts/report-api.md); decisions are in
[research.md](research.md).

## Prerequisites

- Docker + Docker Compose (the whole stack runs from `docker-compose.yml`)
- `GEMINI_API_KEY` exported — needed only to *produce* an analysis to export, not
  to export one
- The backend image **rebuilt** after this feature's `Dockerfile` change (new Noto
  fonts). Skipping the rebuild is the likeliest cause of a tofu/□□□ report.

```bash
docker compose build api
docker compose up -d
docker compose ps          # api and postgres healthy
```

Chromium requires no separate install step — `backend/Dockerfile` already installs
it for the ingestion path, and this feature reuses it (research.md §1).

## Produce something to export

```bash
# 1. Ingest a URL  -> note the returned ingested_url id
curl -s -X POST http://localhost:8000/api/v1/ingest \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}' | jq '{id, url, status}'

# 2. Analyse it    -> note the returned analysis id (this is the export's key)
curl -s -X POST http://localhost:8000/api/v1/analyze/1 | jq '{id, status, overall_score}'

# 3. Optional: optimize, to exercise the optimizer sections (FR-010)
curl -s -X POST http://localhost:8000/api/v1/optimize/1 | jq '{id, status}'
```

> The export takes the **analysis id** from step 2 — the same identifier
> `/api/v1/optimize/{analysis_id}` uses, not the ingested-url id from step 1.

## Export

```bash
curl -sS -D headers.txt -o report.pdf \
  http://localhost:8000/api/v1/report/1/pdf

grep -i 'content-type\|content-disposition' headers.txt
# content-type: application/pdf
# content-disposition: attachment; filename="seo-report_example-com_2026-08-16.pdf"; ...

file report.pdf     # PDF document, version 1.4
open report.pdf     # macOS
```

## Manual validation scenarios

Each maps to spec acceptance scenarios and success criteria.

### V1 — Content completeness (US1, SC-002, FR-003…FR-009)

```bash
curl -s http://localhost:8000/api/v1/analyze/1 \
  | jq '{findings: (.analysis.findings|length), recs: (.analysis.recommendations|length)}'

pdftotext report.pdf - | grep -c '^'          # document has real, extractable text
```

Confirm in the opened PDF: SEO / GEO / overall scores with both breakdowns; the GEO
visibility narrative; every finding from the JSON, grouped under category headings;
every recommendation with action, rationale, priority, effort; and for each HTML
change, the location plus **two distinct code blocks** (current and suggested).

### V2 — Selectable text (C3, and the feature's whole point)

Select a suggested-markup block in a PDF viewer and paste it into an editor. It must
paste as usable markup. If it cannot be selected, the render regressed to raster and
the Overview's "copy-paste HTML fixes" value is gone.

### V3 — Presentation (US3, FR-011…FR-015)

Page 1 shows the URL, the analysis date, and the overall score. Scores appear
visually (bars/rings), not as bare numbers. Severity colours match the app —
critical red `hsl(0 60% 48%)`, medium orange `hsl(22 78% 50%)`, warning amber
`hsl(38 75% 48%)`, good green `hsl(158 45% 38%)`. Every page after the cover carries
a page number and the URL.

### V4 — Optimizer present and absent (US2, FR-010, SC-006)

Export an analysis **with** an optimization: the optimized HTML, the enriched
JSON-LD, and before/after scores are present. Export one **without**: the document
is complete and contains no heading, no empty section, and no table-of-contents entry
hinting anything is missing.

```bash
curl -s -o with.pdf    http://localhost:8000/api/v1/report/1/pdf
curl -s -o without.pdf http://localhost:8000/api/v1/report/2/pdf
pdftotext without.pdf - | grep -i 'optimiz'   # expect no matches
```

### V5 — Status gating (US1 scenarios 5 & 6, FR-016)

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/v1/report/999999/pdf   # 404
curl -s http://localhost:8000/api/v1/report/999999/pdf | jq .detail
# Then, against an analysis whose status is 'failed':
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/v1/report/<failed>/pdf # 409
```

Both must return **JSON**, never a partial PDF (FR-021), and the two messages must
read differently.

### V6 — Determinism (SC-007)

```bash
curl -s -o a.pdf http://localhost:8000/api/v1/report/1/pdf
curl -s -o b.pdf http://localhost:8000/api/v1/report/1/pdf
diff <(pdftotext a.pdf -) <(pdftotext b.pdf -) && echo "content identical"
```

Compare **extracted text**, not bytes — Chromium stamps a creation date into the PDF
trailer, so byte equality is not the requirement (research.md §11).

### V7 — Offline / self-contained (FR-020, C4)

Disconnect from the network and open `report.pdf`. It must render fully. Then
confirm nothing was fetched during rendering:

```bash
docker compose logs api | grep -i 'aborted request' | head
```

### V8 — Concurrency (spec Edge Cases, C6)

```bash
for i in 1 2 3 4 5; do curl -s -o "c$i.pdf" http://localhost:8000/api/v1/report/1/pdf & done; wait
for f in c*.pdf; do echo -n "$f "; pdftotext "$f" - | wc -c; done
```

All five must be valid and byte-comparable in extracted-text length. With
`REPORT_RENDER_CONCURRENCY=2` the last three queue rather than launching five
concurrent renders.

### V9 — Edge cases (SC-008)

| Case | How to stage it | Expected |
|---|---|---|
| No findings | Analysis with `analysis.findings = []` | Scores render; explicit "no issues detected"; no blank section |
| Legacy plain strings | Set `analysis.findings` to `["Error during analysis: boom"]` | Renders as readable text; no `{'detail':` object syntax |
| No HTML change | Recommendation with `html_change` absent | Action and rationale only; no empty code block |
| Element absent | `change_type: "add"`, `current_html: ""` | Labelled as an addition, not an empty block |
| Oversized markup | `suggested_html` of 50,000 chars | Truncated with a visible "N characters omitted" note |
| Non-Latin + emoji | URL/title with CJK and 🚀 | Correct glyphs, no □□□ |
| Long unbroken line | 5,000-char single-token markup | Wraps inside the margin; nothing clipped |

The first five are unit-tested against `build_report_document` without a browser
(research.md §8) — stage them via SQL only when validating the rendered output.

## Automated tests

```bash
# Backend — fast layer: view model, mappings, contract. No browser.
docker compose exec api pytest tests/test_report_service.py tests/test_report_mappings.py -v
docker compose exec api pytest tests/contract/test_report_api_contract.py -v

# Backend — slow layer: real Chromium render + text extraction
docker compose exec api pytest tests/integration/test_report_pdf.py -v

# Everything, with the coverage floor Principle III requires
docker compose exec api pytest --cov=src --cov-report=term-missing

# Frontend
cd frontend && npm run test -- ExportReportButton && npm run type-check && npm run lint
```

**The parity test is the one to watch**: `test_report_mappings.py` asserts the
Python severity/colour table matches `frontend/src/shared/lib/severity.ts` and
`AnalysisApiService.mapSeverity`. It is what keeps FR-013 true after the next
frontend change, and it is expected to fail loudly if someone edits one side alone.

## Frontend validation

```bash
docker compose up -d          # or: cd frontend && npm run dev
```

Open `http://localhost:3000`, analyse a URL, and on the run results page use
**Export PDF**:

- The button is disabled until the run is complete and `backendAnalysisId` is set.
- While in flight it shows a busy state and is disabled — no duplicate renders from
  a double-click (SC-004).
- The download filename matches the `Content-Disposition` name (requires
  `expose_headers=['Content-Disposition']` on the CORS middleware — see
  [contracts/report-api.md](contracts/report-api.md); without it the filename
  silently degrades).
- A failed export shows the backend's `detail` message, not a broken download.
- Keyboard: the button is reachable by Tab, has an accessible name, and announces
  its busy state (Principle VII, WCAG 2.2 AA).

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `REPORT_RENDER_CONCURRENCY` | `2` | Max simultaneous Chromium renders (research.md §4) |
| `REPORT_MAX_CODE_CHARS` | `20000` | Per-markup-block truncation threshold (research.md §10) |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `□□□` instead of CJK/emoji | Image not rebuilt after the Dockerfile font change | `docker compose build api` |
| Browser launch fails | `PLAYWRIGHT_BROWSERS_PATH` unset outside the container | Run inside Compose, or set it to `/ms-playwright` |
| Downloads all named `seo-report.pdf` | `Content-Disposition` not exposed to the browser | Add `expose_headers=['Content-Disposition']` to `CORSMiddleware` |
| Export hangs under load | More than `REPORT_RENDER_CONCURRENCY` renders queued | Expected backpressure; raise the limit only with the memory headroom to match |
| 409 on an analysis that looks fine | `status` is not exactly `completed` | `SELECT id, status FROM url_analyses WHERE id = ...` |
