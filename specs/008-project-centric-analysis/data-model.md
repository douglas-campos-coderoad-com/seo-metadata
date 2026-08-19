# Phase 1 Data Model: Project-Centric Analysis Management

## New entities

### `Project` (new table: `projects`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Integer | PK, indexed | |
| `title` | String(255) | NOT NULL | FR-005 |
| `description` | Text | NOT NULL | site description, FR-005 |
| `category` | String(50) | NOT NULL | one of the 22 values in FR-011, validated at the Pydantic layer (research.md §7) |
| `country` | String(100) | NOT NULL | free-form text, FR-005 / spec Assumptions |
| `region` | String(100) | NULLABLE | free-form text; some countries/geographies have no meaningful "region" |
| `created_at` / `updated_at` | DateTime(tz) | NOT NULL | via `TimestampMixin`, matching every other model |

**Relationships**: has many `Competitor` (cascade delete, FR-015). Has many `UrlAnalysis` via `url_analyses.project_id` (cascade delete, FR-015).

**Validation rules**: `title`, `description`, `country` required and non-empty (FR-005). `category` must be one of the fixed 22 values (FR-011). No uniqueness constraint on `title` — global, no-auth scope (FR-012) means nothing meaningfully disambiguates "the same" project by name; duplicates are allowed.

**Lifecycle**: create (US2) → read/list (US2, US4) → update (US6/FR-014, full-replace of editable fields + competitor list) → delete (US6/FR-015, cascades to competitors and analyses). No soft-delete — FR-015 says "permanently removed."

### `Competitor` (new table: `competitors`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Integer | PK, indexed | |
| `project_id` | Integer | FK → `projects.id`, `ondelete='CASCADE'`, NOT NULL, indexed | |
| `url` | String(2048) | NOT NULL | matches `ingested_urls.url` column width for consistency; not validated as a live/reachable URL (out of scope, FR-010) |
| `description` | Text | NOT NULL | FR-006 |
| `created_at` / `updated_at` | DateTime(tz) | NOT NULL | via `TimestampMixin` |

**Relationships**: belongs to exactly one `Project`.

**Validation rules**: both `url` and `description` required per entry (Edge Cases: "an incomplete entry cannot be added to the list"). No de-duplication (Edge Cases, explicit decision). Not analyzed or scored by this feature (FR-010) — purely inert stored data.

**Lifecycle**: created/replaced as a whole list whenever the owning project is created or edited (FR-006, FR-014; see research.md §4 for the whole-list-replace approach). Deleted when the project is deleted (cascade) — no independent lifecycle of its own.

## Modified entity

### `UrlAnalysis` (existing table: `url_analyses`) — one new column

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `project_id` | Integer | FK → `projects.id`, `ondelete='CASCADE'`, **NULLABLE**, indexed | **New.** `NULL` = not yet added to any project (FR-013's ephemeral state, at the DB level — see research.md §1 for why this is DB-level-persisted-but-user-unreachable rather than truly absent). Set on "Add analysis to a project" (FR-002) or "reassign" (FR-016); deleting the analysis (FR-016 "remove") deletes this row entirely rather than nulling the column back out.

No other columns on `UrlAnalysis` or `UrlOptimization` change. All existing analysis/optimization logic, endpoints, and behavior for the anonymous first-glance flow are untouched (spec Assumptions).

## Conceptual "Analysis" (spec's Key Entity) → concrete tables

The spec's `Analysis` entity (with "before" and "after" results) is not one new table — it's the existing `UrlAnalysis` ("before": `seo_score`, `geo_score`, `overall_score`, `analysis`, `json_ld`) **left-joined** with its optional `UrlOptimization` child ("after": `optimized_html`, `optimized_content`, `score_before`, `score_after_estimated`, `copy_paste_ready`), read through the new `project_id` link. See research.md §3 for the query shape.

```text
Project (1) ──< (many) Competitor
Project (1) ──< (many) UrlAnalysis [via project_id, nullable]
UrlAnalysis (1) ──< (0 or 1) UrlOptimization  [pre-existing relationship, unchanged]
```

## State summary

| State | Meaning |
|---|---|
| `UrlAnalysis.project_id IS NULL` | Anonymous/first-glance analysis; reachable only within the session that produced it (FR-013) |
| `UrlAnalysis.project_id = X` | Analysis belongs to project X; appears in that project's history (FR-008), rendered from persisted before/after data (FR-004) |
| `UrlOptimization` row exists for an analysis | "After" result available; history entry renders both before and after |
| `UrlOptimization` row absent for an analysis | Optimization never run; history entry renders "before" only, no error (Edge Cases) |
