# Phase 1 Data Model: PDF Report Export

**Feature**: 005-pdf-report-export | **Date**: 2026-08-16

## Scope of change

**No database change. No migration. No new table.**

The spec's Assumptions state the report "is generated on demand from the stored
analysis and is not itself persisted". Every model below is an in-memory **view
model** — a Pydantic v2 structure built per request, handed to the template, and
discarded.

### Existing tables read (all read-only)

| Table | Model | Fields consumed |
|---|---|---|
| `url_analyses` | `UrlAnalysis` | `id`, `ingested_url_id`, `seo_score`, `geo_score`, `overall_score`, `analysis` (JSONB), `status`, `created_at` |
| `ingested_urls` | `IngestedUrl` | `url` (via the `ingested_url` relationship) |
| `url_optimizations` | `UrlOptimization` | `analysis_id`, `optimized_html`, `optimized_json_ld`, `score_before`, `score_after_estimated`, `status` |

## Source contract: the stored `analysis` JSON

The `url_analyses.analysis` JSONB column is written by `compile_report`
(`backend/src/services/graph_nodes.py:581-588`) from the LLM output whose shape is
fixed by the prompt (`graph_nodes.py:293-349`):

```jsonc
{
  "findings":        [ { "id": "F1", "category": "...", "dimension": "...",
                         "impact": "...", "severity": "...", "status": "...",
                         "title": "...", "detail": "..." } ],
  "recommendations": [ { "id": "R1", "finding_id": "F1", "category": "...",
                         "priority": "...", "effort": "...", "impact": "...",
                         "action": "...", "rationale": "...",
                         "html_change": { "change_type": "add|modify|remove",
                                          "location": "...",
                                          "current_html": "...",
                                          "suggested_html": "..." } } ],
  "geo_visibility":  "2-3 sentences",
  "seo_breakdown":   { "title": 0-15, "meta_description": 0-15, "headings": 0-10,
                       "images_alt": 0-10, "opengraph": 0-10, "json_ld": 0-15,
                       "canonical": 0-5, "robots": 0-5, "performance": 0-5,
                       "content": 0-10 },
  "geo_breakdown":   { "question_answering": 0-20, "natural_language": 0-15,
                       "completeness": 0-20, "structured_data": 0-20,
                       "llm_citability": 0-15, "featured_snippet": 0-10 },
  "errors":          [ "..." ]
}
```

**This shape is LLM-produced and must be treated as untrusted and non-guaranteed.**
Every field below is therefore optional at parse time, with a documented fallback.
Two known deviations from the shape above already exist in production data:

- `analysis.findings` may contain **plain strings** — `analysis_service.py:94`
  writes `[f'Error during analysis: {exc}']` on its error path, and older records
  predate the structured prompt (spec Edge Cases; FR-018).
- `analysis` itself may be `NULL` on a row whose `status` is `completed`.

## View models

All models are `pydantic.BaseModel` in `backend/src/schemas/report.py`.

### `ReportDocument` (root)

The complete input to the template. One instance per export.

| Field | Type | Source | Notes |
|---|---|---|---|
| `url` | `str` | `ingested_urls.url` | FR-011, FR-015 |
| `analysis_date` | `datetime` | `url_analyses.created_at` | FR-011. The **analysis** date, never the generation time (SC-007, research.md §11) |
| `seo_score` | `int \| None` | `url_analyses.seo_score` | FR-003 |
| `geo_score` | `int \| None` | `url_analyses.geo_score` | FR-003 |
| `overall_score` | `int \| None` | `url_analyses.overall_score` | FR-003, FR-011 |
| `seo_breakdown` | `list[ScoreDimension]` | `analysis.seo_breakdown` | FR-004 |
| `geo_breakdown` | `list[ScoreDimension]` | `analysis.geo_breakdown` | FR-004 |
| `geo_visibility` | `str` | `analysis.geo_visibility` | FR-005. Empty string renders the section omitted, not blank |
| `finding_groups` | `list[FindingGroup]` | derived | FR-012 |
| `orphan_recommendations` | `list[ReportRecommendation]` | derived | Recommendations resolving no known finding — rendered, never dropped (SC-002) |
| `optimizer` | `OptimizerSection \| None` | `url_optimizations` | FR-010. `None` omits every optimizer section entirely |
| `has_no_issues` | `bool` | derived | `True` when no findings and no recommendations — drives the explicit "no issues detected" statement (spec Edge Cases) |
| `total_findings` | `int` | derived | Used by the summary and by SC-002 assertions |

**Validation rules**

- A `None` score renders as "Not scored", never as `0` — a missing score and a zero
  score mean different things to a client reading the report.
- `analysis_date` is rendered as an unambiguous absolute date (ISO `YYYY-MM-DD`).

### `ScoreDimension`

One row of a score breakdown (FR-004).

| Field | Type | Notes |
|---|---|---|
| `key` | `str` | Raw key, e.g. `meta_description` |
| `label` | `str` | Human label, e.g. "Meta description" |
| `score` | `int` | Awarded points |
| `max_score` | `int` | From the fixed rubric in `graph_nodes.py:299-318` |
| `ratio` | `float` | `score / max_score`, clamped to `0.0–1.0`; drives the bar width (FR-014) |

**Validation**: `max_score` comes from a constant rubric table, not from the LLM
output. An unknown key falls back to `max_score = score` (ratio 1.0) rather than
dividing by zero.

### `FindingGroup`

Findings grouped under one category heading (FR-012).

| Field | Type | Notes |
|---|---|---|
| `category` | `str` | One of the analyser's nine categories (research.md §6) |
| `label` | `str` | Display heading, e.g. `structured_data` → "Structured data" |
| `findings` | `list[ReportFinding]` | Non-empty — an empty group is never emitted |

**Ordering**: groups follow a fixed category order (severity-weighted, most
consequential first), not dict insertion order, so SC-007 holds across renders.

### `ReportFinding`

| Field | Type | Source | Notes |
|---|---|---|---|
| `ref` | `str` | `finding.id` | e.g. `F1`. Used to pair with recommendations; safe to display (it is not a database id) |
| `title` | `str` | `finding.title` | Falls back to `detail`, then to "Finding" |
| `detail` | `str` | `finding.detail` | FR-006 |
| `category` | `str` | `finding.category` | FR-006; unknown → `content` |
| `severity` | `Severity` | `finding.severity` | FR-006, collapsed per research.md §6 |
| `severity_label` | `str` | derived | "Critical" / "Medium" / "Needs improvement" / "Good" |
| `severity_color` | `str` | derived | HSL literal matching the app (FR-013) |
| `recommendation` | `ReportRecommendation \| None` | joined on `finding_id` | FR-009 |

### `ReportRecommendation`

| Field | Type | Source | Notes |
|---|---|---|---|
| `ref` | `str` | `recommendation.id` | e.g. `R1` |
| `resolves_ref` | `str \| None` | `finding_id` | FR-009 |
| `action` | `str` | `action` | FR-007 |
| `rationale` | `str` | `rationale` | FR-007 |
| `priority` | `str` | `priority` | FR-007; unknown → `medium` |
| `effort` | `str` | `effort` | FR-007; unknown → `medium` |
| `html_change` | `HtmlChange \| None` | `html_change` | FR-008; absent renders no code block at all |

### `HtmlChange`

| Field | Type | Notes |
|---|---|---|
| `change_type` | `str` | `add` / `modify` / `remove` |
| `location` | `str` | FR-008. Empty → "Location not specified" |
| `current_markup` | `str \| None` | `None` when empty — see below |
| `suggested_markup` | `str \| None` | `None` when empty |
| `current_is_absent` | `bool` | `True` when `change_type == "add"` and `current_html` is empty |
| `current_truncated_chars` | `int` | `0` unless truncated (research.md §10) |
| `suggested_truncated_chars` | `int` | `0` unless truncated |

**Validation rules (all from the spec's Edge Cases and FR-008)**

- An empty `current_html` becomes `current_markup = None` with
  `current_is_absent = True`; the template prints *"Element does not exist yet —
  this is an addition"* instead of an empty code block.
- A value longer than `REPORT_MAX_CODE_CHARS` (20,000) is truncated and the
  `*_truncated_chars` counter records the loss, which the template states visibly.
- Both markup fields render as **text inside `<pre><code>`**, autoescaped. Never
  as live markup (research.md §7).

### `OptimizerSection`

Present only when a `url_optimizations` row exists for the analysis **with status
`completed`**. A `failed` or `pending` optimization is treated exactly as if none
existed (FR-010, spec User Story 2 scenario 3).

| Field | Type | Notes |
|---|---|---|
| `optimized_html` | `str \| None` | Same truncation rules as `HtmlChange` |
| `optimized_json_ld` | `str \| None` | JSON pretty-printed with `indent=2`, `ensure_ascii=False` |
| `score_before` | `dict \| None` | FR-010 |
| `score_after` | `dict \| None` | From `score_after_estimated` |

### `Severity` (enum)

The four values the application uses — `critical`, `medium`, `warning`, `good` —
matching `FindingSeverity` in `frontend/src/shared/types`.

The analyser's raw vocabulary (`critical | high | medium | low`) is collapsed into
this enum by `report_mappings.py` using the same rules as
`AnalysisApiService.mapSeverity` (`AnalysisApiService.ts:398-414`):

| Raw value | Collapsed | Colour |
|---|---|---|
| `critical`, `high` | `critical` | `hsl(0 60% 48%)` |
| `medium` | `medium` | `hsl(22 78% 50%)` |
| `low`, `warning` | `warning` | `hsl(38 75% 48%)` |
| `pass`, `good` | `good` | `hsl(158 45% 38%)` |
| anything else / missing | `warning` | `hsl(38 75% 48%)` |

This table is the subject of the parity contract test (research.md §6): it is what
makes FR-013 enforceable.

## Derivation rules

The single pure function `build_report_document(analysis, ingested_url, optimization)`
applies, in order:

1. **Normalise** — coerce `analysis` `None` to `{}`; coerce any plain-string finding
   or recommendation into its structured form (FR-018).
2. **Index** — build `{finding_id: recommendation}`. Recommendations with no
   `finding_id`, or one matching no finding, go to `orphan_recommendations`.
3. **Join** — attach each recommendation to its finding (FR-009).
4. **Group** — bucket findings by category, drop empty buckets, order by the fixed
   category order (FR-012).
5. **Score** — zip each breakdown dict against the rubric into `ScoreDimension`s (FR-004).
6. **Truncate** — apply `REPORT_MAX_CODE_CHARS` to every markup value, recording
   the omitted count (research.md §10).
7. **Attach optimizer** — only when a `completed` optimization exists (FR-010).

The function performs no I/O and touches no browser, which is what makes every
edge case in SC-008 a fast unit test.

## State transitions

The report itself has no lifecycle — it is composed and returned. The **gating**
state belongs to the source analysis (FR-016):

| `url_analyses.status` | Export outcome |
|---|---|
| `completed` | 200, PDF returned |
| `pending`, `running`, `failed` | 409 — "analysis is not exportable" |
| row absent | 404 — "not found" |

The two error cases are deliberately different status codes so the message
"distinguishes 'not found' from 'not yet exportable'", as FR-016 requires.
