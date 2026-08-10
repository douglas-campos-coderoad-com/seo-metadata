# Phase 1 Data Model: SEO Analyzer Application

Entities mirror `spec.md`'s Key Entities section, refined with concrete fields for the mocked in-memory store (`shared/store`). All identifiers are client-generated strings (e.g., `crypto.randomUUID()`); nothing here persists beyond the browser session (see spec Clarifications/Assumptions).

## AnalysisTarget

One globally unique URL (per Clarifications: "Global identity" decision). Central identity that Projects and standalone analyses both reference.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier |
| `url` | string | Normalized (trimmed, lowercased scheme/host) form of the submitted URL; normalization is the uniqueness key |
| `displayUrl` | string | Original as-entered URL, for display |
| `createdAt` | ISO datetime | First time this URL was ever submitted |
| `latestRunId` | string \| null | Convenience pointer to the most recent `AnalysisRun` |
| `projectIds` | string[] | Zero or more Projects referencing this target (empty = standalone-only) |
| `runIds` | string[] | Ordered (chronological) list of all `AnalysisRun` ids for this target — the history timeline (FR-019) |

**Rules**:
- Uniqueness enforced on `url` (normalized). Creating/adding a URL that already resolves to an existing target upserts a reference rather than creating a new target (FR-014, Clarifications).
- `runIds` never shrinks; every run (manual or automation-triggered) appends here, giving one shared timeline regardless of context (FR-018, FR-024).

## Project

A named grouping of references to one or more `AnalysisTarget`s.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier |
| `name` | string | User-provided |
| `createdAt` | ISO datetime | |
| `targetIds` | string[] | References into `AnalysisTarget` (not ownership — see global identity rule) |

**Rules**:
- Removing a target from a project only removes the reference; the target and its history are unaffected (they may still be referenced elsewhere or standalone).
- Empty `targetIds` is valid (FR: "guidance to add a URL rather than an empty/broken screen").
- Projects do not hold their own automations (see Clarifications); a project's "automation picture" is simply the union of its referenced targets' own Automations.

## AnalysisRun

One execution of analysis against an `AnalysisTarget` at a point in time. One point on that target's history timeline.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier |
| `targetId` | string | Owning `AnalysisTarget` |
| `triggeredBy` | `'manual'` \| `'automation'` | Does not change how it's displayed in history (FR-024) — recorded for completeness only |
| `status` | `'queued'` \| `'fetching'` \| `'analyzing'` \| `'complete'` \| `'failed'` | State machine below |
| `startedAt` | ISO datetime | |
| `completedAt` | ISO datetime \| null | Set on `complete` or `failed` |
| `score` | number (0–100) \| null | Set only when `status === 'complete'` |
| `failureReason` | string \| null | Human-readable; set only when `status === 'failed'` (FR-012 error clarity, SC-007) |
| `findingIds` | string[] | Populated when `status === 'complete'` |
| `httpStatus` | number \| null | Reachability metadata, mirrors the ingestion contract in `specs/002-url-ingestion/contracts/api.md` |
| `contentType` | string \| null | |
| `contentSizeBytes` | number \| null | Feeds file-size findings (FR-011) |

**State transitions**: `queued → fetching → analyzing → complete`, or `queued|fetching|analyzing → failed` at any point (e.g., unreachable URL, non-HTML content — see spec Edge Cases). Terminal states: `complete`, `failed`. No transition leaves a terminal state (a re-analysis creates a **new** `AnalysisRun`, per FR: "resubmitting shows the most recent result" while prior runs remain in history).

## Finding

A single scored observation produced by a completed `AnalysisRun`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier |
| `runId` | string | Owning `AnalysisRun` |
| `category` | `'meta-tags'` \| `'content'` \| `'html-structure'` \| `'file-size'` | Matches FR-008…FR-011 categories |
| `severity` | `'good'` \| `'warning'` \| `'critical'` | Drives the color range (FR-007) via `shared/lib/severity.ts` |
| `title` | string | Short label, e.g. "Missing meta description" |
| `description` | string | What was found / why it matters |
| `metricValue` | string \| number \| null | e.g., current meta description length, heading count |
| `isMissing` | boolean | True when the underlying element was absent (FR-011 in spec.md — "flag as missing rather than blank") |
| `suggestion` | string | Plain-language improvement suggestion (FR-009/FR-010) |
| `codeSnippet` | string \| null | Ready-to-copy fix, when applicable (FR-012) |

## SharedIssue

A derived (computed, not separately stored) view: a `Finding` pattern recurring across ≥2 targets in the same Project.

| Field | Type | Notes |
|---|---|---|
| `signature` | string | Grouping key — same `category` + normalized `title` across findings |
| `projectId` | string | |
| `category` | Finding['category'] | |
| `severity` | Finding['severity'] | Highest severity observed among matches |
| `title` | string | |
| `affectedTargetIds` | string[] | Targets (≥2) in the project whose *latest completed run* has a matching finding |

**Rules**: Computed on read from each project target's latest completed run's findings — not persisted as its own record, so it always reflects current data (FR-016).

## Automation

A recurring schedule attached to exactly one `AnalysisTarget` (URL). A target may have any number of Automations, each independent (per Clarifications — automations no longer attach to Projects).

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier |
| `targetId` | string | The owning `AnalysisTarget` |
| `recurrence` | `{ frequency: 'daily'\|'weekly'\|'monthly'; time: string /* HH:mm */; weekday?: number; dayOfMonth?: number }` | Structured rule (see research.md §5) |
| `recurrenceLabel` | string | Human-readable rendering of `recurrence` (FR-022), e.g. "Every Monday at 9:00 AM" |
| `active` | boolean | Paused automations keep their config but stop producing runs (FR-023) |
| `lastRunId` | string \| null | |
| `nextRunAt` | ISO datetime | Computed from `recurrence` relative to now/`lastRunAt` |

**Rules**: A scheduled trigger (simulated per spec Assumptions) creates a normal `AnalysisRun` with `triggeredBy: 'automation'` against its `targetId` and appends it to that target's `runIds` exactly like a manual run (FR-024). Deleting or pausing one Automation never affects any other Automation on the same target.

## Relationships overview

```
Project 1 ── * targetIds ──> * AnalysisTarget
AnalysisTarget 1 ── * runIds ──> * AnalysisRun
AnalysisRun 1 ── * findingIds ──> * Finding
AnalysisTarget 1 ── * ──> * Automation (a target may hold multiple independent automations)
SharedIssue = computed over (Project.targetIds → latest AnalysisRun → Finding), grouped by signature, filtered to count ≥ 2
```
