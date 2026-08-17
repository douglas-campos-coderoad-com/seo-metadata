# API Contract: PDF Report Export

**Feature**: 005-pdf-report-export | **Date**: 2026-08-16

The contract is defined here first (Principle I) and is realised by FastAPI's
generated OpenAPI schema at `/openapi.json`. One new endpoint; no change to any
existing endpoint.

---

## `GET /api/v1/report/{analysis_id}/pdf`

Generate and return the PDF report for one completed analysis.

**Router**: `backend/src/api/report.py`, `APIRouter(prefix='/api/v1', tags=['report'])`
— matching the prefix and tagging convention of `analysis.py` and `optimization.py`.

### Why `GET`

The export is a **read**: it creates no server state and persists nothing (spec
Assumptions). `GET` makes it linkable, retryable, and directly usable as a browser
download target. It is idempotent in content terms (SC-007).

### Path parameters

| Name | Type | Description |
|---|---|---|
| `analysis_id` | `int` | Primary key of `url_analyses`. **Same identifier the optimizer endpoints take** (`POST/GET /api/v1/optimize/{analysis_id}`) — deliberately *not* `ingested_url_id`, which is what `/analyze/{id}` takes. |

### Query parameters

None. SC-001 requires "a single action, with no intermediate configuration step",
so the endpoint exposes no options.

### Authentication

**None** — mirroring `GET /api/v1/analyze/{id}` and `GET /api/v1/optimize/{id}`,
which is what FR-022 ("the same authorization as viewing the analysis itself")
literally requires today.

This is a recorded deviation from Constitution Principle V; see the plan's
Complexity Tracking. The endpoint exposes no data that the existing JSON endpoints
do not already return — only a new format for it. When repo-wide authentication
lands, this endpoint adopts the same dependency as its siblings **in the same
change**, so the FR-022 invariant continues to hold.

### Success response — `200 OK`

Binary PDF body.

| Header | Value |
|---|---|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="<name>.pdf"; filename*=UTF-8''<name>.pdf` |
| `Content-Length` | Byte length of the document |
| `X-Request-ID` | Propagated by the existing `RequestIDMiddleware` |

The body is returned as a complete buffer, never a partial stream: FR-021 forbids
returning a partial or corrupt file, so the bytes are produced fully before the
response begins.

#### Filename (FR-017)

Pattern: `seo-report_{url-slug}_{YYYY-MM-DD}.pdf`

- `url-slug` — host plus path, lowercased, non-alphanumerics collapsed to `-`,
  trimmed to 80 characters. `https://example.com/products/chair?ref=x` →
  `example-com-products-chair`.
- Date — `url_analyses.created_at` (the **analysis** date, not the generation date),
  keeping repeated exports of one analysis identically named (SC-007).
- Both ASCII `filename` and RFC 5987 `filename*` are sent so non-Latin URLs survive
  the round trip.

Two exports of different analyses of the same URL on the same day collide by name.
This is accepted: the browser disambiguates on download, and the spec's requirement
is that exports "remain distinguishable on disk", which URL + date satisfies for the
realistic case.

### Error responses

All errors use FastAPI's standard `{"detail": "..."}` shape, matching the sibling
routers and the app's registered exception handlers.

| Status | Condition | `detail` | Requirement |
|---|---|---|---|
| `404` | No `url_analyses` row with this id | `No analysis found with id {analysis_id}` | FR-016, US1 scenario 5 |
| `409` | Row exists, `status != 'completed'` | `Analysis {analysis_id} is not exportable: status is '{status}'. Only completed analyses can be exported.` | FR-016, US1 scenario 6 |
| `500` | Rendering failed | `Report generation failed` | FR-021 |

**The 404/409 split is the contract's load-bearing detail.** FR-016 requires a
message that "distinguishes 'not found' from 'not yet exportable'"; a single 404 for
both would violate it.

On `500` the response is JSON, never a truncated PDF — a client must be unable to
mistake a failure for a document (FR-021). The underlying exception is logged with
the request id and never echoed to the client (Principle V, SC-005).

### Behavioural guarantees

These are contract-level and are asserted by the tests named in
[quickstart.md](../quickstart.md):

| # | Guarantee | Source |
|---|---|---|
| C1 | Every stored finding and recommendation appears in the document; none is dropped | SC-002, FR-006, FR-007 |
| C2 | Optimizer sections appear only when a `completed` optimization exists, and leave no trace when absent | FR-010, US2 |
| C3 | Text is real, selectable text — not rasterised | Overview ("copy-paste HTML fixes"), research.md §1 |
| C4 | Rendering makes no outbound network request, and the document needs none to display | FR-020, research.md §7 |
| C5 | Two renders of an unchanged analysis produce equal extracted text | SC-007, research.md §11 |
| C6 | Concurrent exports never interleave: each renders in its own browser context | Spec Edge Cases, research.md §4 |
| C7 | No database id, stack trace, or placeholder text appears in the document | SC-005 |
| C8 | Severity colours equal the application's, per the shared mapping table | FR-013, research.md §6 |

### OpenAPI declaration notes

Because the response is binary rather than a Pydantic model, the route declares:

- `response_class=Response` with `media_type='application/pdf'`
- an explicit `responses={200: {'content': {'application/pdf': {}}}, 404: ..., 409: ...}`
  block, so the generated schema documents the real content type instead of
  defaulting to `application/json`.

This matters for Principle I: the OpenAPI schema is the contract, and a binary
endpoint that claims to return JSON is a broken contract.

---

## Frontend consumption contract

`useExportReport` (`frontend/src/features/analysis/hooks/useExportReport.ts`):

- Calls the endpoint with `fetch`, reads `response.blob()`.
- Parses the filename from `Content-Disposition`, falling back to
  `seo-report.pdf` when the header is unreadable (some CORS configurations hide it).
- **Requires `Content-Disposition` to be exposed** — `expose_headers=['Content-Disposition']`
  must be added to the existing `CORSMiddleware` config in `backend/src/main.py`.
  Without it the browser hides the header and every download falls back to the
  generic name, silently breaking FR-017.
- On a non-2xx response, parses `{"detail": ...}` and surfaces that message; it
  never presents a failed request as a completed download (FR-021).
- Exposes `{ exportReport, isExporting, error }`. `isExporting` drives the button's
  busy state and disables it while in flight (SC-004).

The existing shared `ApiClient` is not extended, because every one of its methods
ends in `response.json()`. A binary download needs its own small path rather than a
special case threaded through the shared client.
