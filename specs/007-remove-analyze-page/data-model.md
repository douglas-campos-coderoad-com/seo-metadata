# Phase 1 Data Model: Remove Analyze Page

This feature has no data model of its own — it removes a page/nav entry, not an entity. Documented here for traceability against the spec's Key Entities section.

## Removed

### `/analyze` page (`frontend/src/app/analyze/page.tsx`)

Not a data entity — a Next.js route. Rendered `UrlSubmitForm`, `LiveStatusTracker`, and `RecentTargetsList` (see [plan.md](plan.md) Project Structure). All three components are defined in `features/`, shared with the home page, and are **not** deleted — only this page's usage of them is removed. `UrlSubmitForm` and `LiveStatusTracker` remain in active use on the home page; `RecentTargetsList` becomes unused (see below).

### "Analyze" nav entry (`frontend/src/shared/components/ResponsiveNav.tsx`)

The `NAV_LINKS` array entry `{ href: '/analyze', label: 'Analyze' }` is removed, leaving only `{ href: '/projects', label: 'Projects' }`.

## Preserved, unwired

### `RecentTargetsList` (`frontend/src/features/history/components/RecentTargetsList.tsx`)

No change to this file. Per the resolved spec clarification (FR-007), it is kept in the codebase but not rendered anywhere once its only caller (`app/analyze/page.tsx`) is deleted. Its own dependencies (`useAppStore`, `TargetStatusBadge`) are untouched and still used elsewhere, so nothing about this component's own correctness changes — only its reachability from the UI.

## Unaffected

`AnalysisTarget`, `AnalysisRun`, `Project`, `Finding` and all other shared types (`frontend/src/shared/types/index.ts`) are untouched — this feature has no type-layer changes, unlike the automations removal.
