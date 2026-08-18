# Visora Constitution

The governing principles for Visora. This document supersedes ad-hoc practices.
Every spec, plan, task, and pull request MUST be checkable against it. When a
principle and convenience conflict, the principle wins or the principle is amended
first — never silently ignored.

## Core Principles

### I. Spec-Driven & Contract-First (NON-NEGOTIABLE)

No production code is written before a spec exists for it. The flow is
constitution → specify → clarify → plan → tasks → analyze → implement, and code
is a downstream artifact of an approved spec, not the starting point. The API is
the contract between frontend and backend: FastAPI's generated OpenAPI schema is
the single source of truth, and the TypeScript client the frontend consumes is
generated from it — never hand-written and never allowed to drift. A change to an
endpoint's shape is a spec change first.

### II. Type Safety End to End

Types are enforced, not aspirational. The backend runs Pydantic v2 models at every
boundary and `mypy` in strict mode; the frontend runs TypeScript in `strict` mode
with no implicit `any` and no unchecked `as` casts across the API boundary. The
generated API client carries backend types into the frontend so a breaking backend
change fails the frontend build rather than surfacing at runtime.

### III. Test-First With Meaningful Coverage

Tests are written against the spec's acceptance scenarios before the implementation
that satisfies them. Backend uses `pytest` with `httpx` for API-level tests and
exercises real request/response cycles; frontend uses Vitest + React Testing Library
for units and Playwright for critical user journeys. Each user story in a spec must
be independently testable and independently demonstrable. Coverage is a floor
(>=80% on changed code), not a target to game — a test must be able to fail for a
real reason.

### IV. Clear Frontend/Backend Boundary

Business logic, authorization decisions, and data validation live in the backend.
The Next.js app is a presentation and orchestration layer: it renders, routes,
handles UX state, and calls the API — it does not reimplement rules the server owns,
and it never trusts client-side checks for security. Server Components and route
handlers may call the API, but the authoritative logic stays behind FastAPI.

### V. Secure & Private By Default

Every endpoint is authenticated and authorized unless it is explicitly and
deliberately public. All input is validated at the boundary; secrets come from the
environment and never from source control; user data is minimized, and PII is never
placed in logs or URLs. The project follows OWASP ASVS as its baseline and treats a
new attack surface (upload, redirect, third-party call, new query param) as
requiring an explicit threat note in its plan.

### VI. Observability & Operability

Structured JSON logging with a correlation/request ID that flows from the frontend
request through the API is required. Every service exposes health and readiness
endpoints. Errors are actionable: no silently swallowed exceptions, no `print`
debugging shipped. Frontend and backend emit the signals needed to answer "is it
up, is it fast, is it erroring" without redeploying.

### VII. Performance Budgets & Accessibility

The frontend holds a performance budget (Core Web Vitals: LCP < 2.5s, INP < 200ms,
CLS < 0.1 on the reference device/network) and meets WCAG 2.2 AA — accessibility is
a requirement, not a later pass. The backend holds latency SLOs stated per feature
in its plan (default: p95 < 300ms for reads, < 500ms for writes, excluding cold
start). A change that blows a budget is a defect.

### VIII. Simplicity & Small Vertical Slices (YAGNI)

Build the simplest thing that satisfies the current spec. Prefer a working vertical
slice (one real user journey, end to end) over broad horizontal scaffolding.
Abstraction is earned by a second real use case, not anticipated. Any deviation
into added complexity must be justified in the plan's Complexity Tracking section.

## Technology & Architecture Constraints

- Repository: a single monorepo. Frontend in `frontend/`, backend in `backend/`,
  the generated API client in `packages/api-client`, shared config/infra in `infra/`.
- Frontend: Next.js (App Router) + React + TypeScript (strict). Data fetching via the
  generated, typed API client. Styling and component conventions are fixed once in
  the plan and not mixed thereafter.
- Backend: FastAPI on Python 3.12+, managed with `uv`. Pydantic v2 for models,
  SQLAlchemy 2.x (or SQLModel) with Alembic migrations, PostgreSQL as the primary
  datastore. Async endpoints where I/O-bound.
- Contract: FastAPI serves `/openapi.json`; the TS client in `packages/api-client`
  is regenerated from it in CI, and a drift between schema and client fails the build.
- Environments: everything runs locally via Docker Compose (`web`, `api`, `db`) with
  a single `make dev` / documented command. No "works only on my machine" setup.
- Configuration is environment-based (12-factor); no secrets in the repo.

## Development Workflow & Quality Gates

- Trunk-based with short-lived feature branches named `NNN-feature-slug` matching the
  spec branch created by `/speckit-specify`.
- Definition of Done for a task: the relevant spec acceptance scenarios pass; tests
  written and green; `mypy`, `ruff`/linter, `tsc`, and frontend lint all clean; the
  build passes; docs/OpenAPI regenerated if the contract changed.
- CI is the gate. Lint, type-check, unit + integration tests, contract-client
  regeneration check, and both app builds must pass before merge. Red CI blocks merge.
- Pull requests state which spec and which user stories they implement, and reviewers
  verify the change conforms to this constitution before approving.
- Run `/speckit-clarify` before `/speckit-plan` on any non-trivial feature, and
  `/speckit-analyze` after `/speckit-tasks` to catch spec/plan/task drift before
  `/speckit-implement`.

## Governance

This constitution supersedes other practices. Amendments are made by editing this
file with a version bump and a one-line rationale; they take effect once merged.
All PRs and reviews verify compliance, and any added complexity must be justified in
the plan rather than assumed. Use `.specify/memory/constitution.md` as the runtime
source of truth referenced by every Spec Kit command.

Versioning of this document follows semantic versioning: MAJOR for a
backward-incompatible principle removal/redefinition, MINOR for a new principle or
materially expanded guidance, PATCH for clarifications and wording.

**Version**: 1.0.0 | **Ratified**: 2026-08-04 | **Last Amended**: 2026-08-04