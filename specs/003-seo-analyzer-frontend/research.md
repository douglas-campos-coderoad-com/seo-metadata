# Phase 0 Research: Visora Analyzer Application

No `[NEEDS CLARIFICATION]` markers remain in `spec.md` (resolved via `/speckit-clarify`). The research below covers the technical/implementation decisions needed to fill `plan.md`'s Technical Context — these are choices the spec deliberately left to planning (see spec.md Assumptions: "UI visual design system, component library, and frontend code organization... are implementation decisions to be finalized in the implementation plan").

## 1. Component/visual layer: shadcn/ui-style primitives on top of existing Tailwind

**Superseded decision (Phase 1–7, later revised mid-Phase 8)**: daisyUI (v4.x) was used initially — see rationale below, kept for history. It was fully replaced per an explicit user request to change the look and feel to shadcn/ui, made while Phase 8 (Polish) was in progress. The user chose to do the swap immediately rather than defer it, so every component built in Phases 1–7 was migrated in the same session.

**Current decision**: Hand-built, shadcn/ui-pattern primitives in `frontend/src/shared/components/ui/` (`Button`, `Badge`, `Card`, `Input`, `Label`, `Select`, `Alert`), following shadcn/ui's actual conventions: `class-variance-authority` (`cva`) for variants, a `cn()` helper (`clsx` + `tailwind-merge`), Radix `Slot` for `asChild` polymorphism on `Button`, and CSS-variable-driven theme tokens (`--background`, `--primary`, `--destructive`, etc., plus app-specific `--success`/`--warning` for the severity system) mapped into `tailwind.config.js` colors.

**Rationale**: This is not installed via the shadcn CLI (`npx shadcn init`/`add`), which fetches component source over the network interactively — not compatible with a non-interactive agent session. Instead the same well-documented public source patterns were reproduced directly as files, which is how shadcn/ui is designed to be used (you own the component source, there is no runtime package). Two scoped simplifications versus "real" shadcn/ui: (1) `Select` is a styled native `<select>`, not the Radix-based `@radix-ui/react-select` — this app's selects are short, static option lists with no need for custom-styled option rendering; (2) `Alert` is CVA-based like shadcn/ui but does not include `AlertTitle`/icon-slot sub-components, since every usage in this app is a single-line message.

Components with no shadcn/ui equivalent were hand-built in the same visual language rather than left as daisyUI leftovers: `ScoreRadial` (SVG circle + `stroke-dasharray`, replacing daisyUI's `radial-progress`), the step tracker in `LiveStatusTracker` (plain Tailwind numbered-circle row, replacing `steps`), and the vertical run list in `RunTimeline` (a bordered list, replacing `timeline`).

**Alternatives considered**:
- Keep daisyUI — rejected: explicit, direct user instruction to replace it.
- Full Radix-based shadcn/ui Select for the two `<select>` usages — rejected as disproportionate; native selects with shadcn-style input classes cover a 3–7 option list identically for the user, at a fraction of the code.
- Plain unstyled Tailwind only (no primitive layer) — rejected for the same reason it was rejected originally: too much repeated hand-styling across 5 features' worth of buttons/badges/cards.

## 1b. Color/type theme: "Dawn Patrol" (supersedes the indigo/violet gradient)

**Superseded decision**: An indigo/violet primary with a gradient Hero/wordmark, applied on top of the shadcn/ui primitives above. Reported by the user as generic/common across other sites; replaced in the same session it was added.

**Current decision**: "Dawn Patrol" — a fully-specified, user-provided dark-first ocean palette and type system, implemented as CSS variables in `globals.css` (see spec.md Clarifications, 2026-08-10 session, for the full color/type spec) and Tailwind `fontFamily` entries (`display`/`sans`/`mono`) in `tailwind.config.js`. Hanken Grotesk and Space Mono are self-hosted via `next/font/google`; Clash Display isn't a Google Font, so it's loaded from Fontshare via a `<link>` tag in `app/layout.tsx` and referenced through a plain `--font-display` CSS variable — this is the one piece with a runtime network dependency (acceptable: it degrades to the `sans-serif` fallback in the `font-display` stack if the request fails, never breaking layout).

**Key implementation decisions**:
- **No gradients anywhere.** Depth/visual interest instead comes from the Ocean-on-Abyss background lift (Card `bg-card` vs page `bg-background`), a single restrained ambient-motion element in the Hero (a blurred, slowly-pulsing circle — "a slow swell" — gated behind `prefers-reduced-motion: no-preference`), and horizontal banding in `FeatureHighlights` (divided flex row) instead of a 3-card grid.
- **Single theme, not a light/dark pair — converted from dark to light after user feedback** (spec.md Clarifications, second 2026-08-10 entry). All tokens still live on `:root` directly rather than gated behind a `.dark` class, since there is no theme toggle in this app to justify maintaining two palettes; the conversion restructured the same brand hues for a light background rather than layering on a second palette. Concretely: Foam's hue became the pale page background instead of foreground text; Ocean/Glass were deepened in lightness/saturation where used as text, links, or the focus ring, since the brief's literal pastel values (tuned to read on a near-black background) would have insufficient contrast on a light one. `success`/`warning`/`destructive` were left unchanged — they're small filled chips with self-contained internal contrast (dark text on a colored chip), so page background doesn't affect their legibility either way.
- **Severity system, revised twice.** First pass mapped `good` → Golden and `critical` → a muted tone derived from Sunrise's hue; user feedback flagged this as not "referential" enough — Golden doesn't read as "good" the way green conventionally does, and a Sunrise-derived critical color risked being confused with the primary CTA (same hue family). Now `success`/`warning`/`destructive` are a calm-but-referential green/amber/red family — muted in saturation to stay in the coastal aesthetic ("calm neutral error states instead of alarm-red"), but each hue unambiguously signals good/warning/critical, and `destructive`'s hue is shifted away from `--primary` (Sunrise) so the two are never confusable. `Sunrise` remains reserved solely for `--primary` (the CTA/key-marker accent, used sparingly), keeping "one accent, once per view" intact.
- **Numeric/data values use Space Mono with tabular figures** (`font-mono tabular-nums`) — scores, timestamps, run counts, measured metric values — interpreting "metrics presented like a surf forecast" as data-table-style monospaced figures rather than inventing a new bespoke widget.

**Alternatives considered**:
- Keep the indigo/violet + gradient theme — rejected: direct user feedback that it read as generic/common.
- Full light+dark palette pair (with a toggle) — rejected as unrequested scope; no toggle UI exists, and the user asked to convert the existing single theme, not add a second one alongside it.
- Keep the dark-first version — rejected: direct user feedback that light is better for users.
- A literal traffic-light red for critical/destructive states — rejected: explicitly contradicts "calm neutral error states instead of alarm-red."

## 2. Real-time status updates without a real backend

**Decision**: Model the live-status requirement (FR-003/FR-004) behind a `AnalysisService` interface with one method to start an analysis and one to subscribe to its status stream. The only implementation in this phase, `MockAnalysisService`, uses the browser's native `EventTarget` to emit a sequence of status events (`queued → fetching → analyzing → complete|failed`) driven by `setTimeout`, mirroring what a WebSocket/SSE `onmessage` stream would deliver.

**Rationale**: The spec's Assumptions explicitly defer the real transport choice to planning while asking for a "backend-agnostic" service (FR-005) that "mirrors the intended real API and real-time status contract" so it can be swapped later. `EventTarget` is a zero-dependency, standard browser API — sufficient to fake a push channel realistically (including the "connection drop" edge case from spec.md, which the mock can simulate by intentionally failing to emit further events) without pulling in a WebSocket client library that has nothing to actually connect to yet.

**Alternatives considered**:
- A small pub/sub library (e.g., `mitt`) — functionally equivalent to `EventTarget` for this use case; rejected to avoid an unnecessary dependency when the platform API already covers it.
- Polling (`setInterval` re-reading store state) — works but is a weaker stand-in for the eventual real transport contract (push events with a payload), and doesn't naturally model a "lost connection" edge case; rejected.

## 3. Application state management

**Decision**: Use Zustand for the shared, session-scoped store (Analysis Targets, Runs, Findings, Projects, Automations).

**Rationale**: Per spec Clarifications, several runs can be in flight concurrently (FR-003), each needing independent live updates without re-rendering unrelated UI. Zustand's selector-based subscriptions let each live-status component subscribe to just its own run, which plain React Context (single subscription granularity) would not do without extra memoization work. It also has a minimal API (~1KB), which fits the plan's "simple, easy to scale" architecture goal as more features are added on top of the same store.

**Alternatives considered**:
- React Context + `useReducer` — no new dependency, but a single context re-renders all consumers on every state change unless manually split into many contexts, which adds its own complexity as features grow; rejected in favor of Zustand's simplicity at scale.
- Redux Toolkit — much more boilerplate/ceremony than this session-scoped, no-persistence store needs; rejected as disproportionate.

## 4. Historical timeline visualization

**Decision**: Render history (FR-019) as a list of dated data points (score + status per run) using daisyUI's `timeline` component; no charting/graphing library.

**Rationale**: FR-019 only requires "a timeline of dated data points, each showing at least its score" — a discrete list, not a continuous trend line. daisyUI's `timeline` component satisfies this directly.

**Alternatives considered**:
- A charting library (e.g., Recharts, Chart.js) for a score-over-time line graph — would look polished but isn't required by any functional requirement or success criterion; rejected under the spec's simplicity/YAGNI framing to avoid an unrequested dependency. Can be revisited later if a trend visualization is explicitly requested.

## 5. Automation scheduling UI ("calendar-friendly")

**Decision**: Implement a small internal recurrence model (`{ frequency: 'daily'|'weekly'|'monthly', time: 'HH:mm', weekday?, dayOfMonth? }`) captured via native `<input type="date">`/`<input type="time">` plus daisyUI `select`/`radio` controls, and a pure formatting function that turns the structured rule into the human-readable string required by FR-022 (e.g., "every Monday at 9:00 AM").

**Rationale**: The spec requires "user-friendly," calendar-based scheduling and a human-readable display — it does not require full cron/RFC5545 expressiveness or a visual month-grid calendar widget. A small internal model is enough to satisfy FR-021/FR-022/FR-023 and keeps the automations feature self-contained and simple, consistent with "automation execution is simulated in this phase" (spec Assumptions).

**Alternatives considered**:
- A full calendar/date-picker library (e.g., `react-big-calendar`, cron-parser) — materially heavier than what any functional requirement calls for; rejected as premature given execution itself is simulated in this phase.

## 6. Mock data / mock service organization

**Decision**: Each feature owns its own fixture templates under `features/<name>/mocks/` (e.g., realistic sample findings per category), while a single in-memory "mock database" module inside `shared/realtime` (backed by the Zustand store) owns entity creation/lookup so that global URL identity (per Clarifications) and shared-issue detection (FR-016) have one authoritative place to live.

**Rationale**: Keeps fixture *content* (what a finding looks like) colocated with the feature that renders it, while keeping entity *identity and relationships* (targets, projects, runs) centralized — avoiding two features independently reinventing "what counts as the same URL."

**Alternatives considered**:
- One giant global mocks file — simpler at first but works against the feature-based architecture goal and becomes a bottleneck file as more features are added; rejected.
