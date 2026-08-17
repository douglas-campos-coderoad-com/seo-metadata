<!-- SPECKIT START -->
**Current Feature**: [PDF Report Export](specs/005-pdf-report-export/spec.md)

**Implementation Plan**: [specs/005-pdf-report-export/plan.md](specs/005-pdf-report-export/plan.md)

**Tech Stack**: 
- Frontend: Next.js (App Router) + React + TypeScript (strict mode)
- Backend: FastAPI + Python 3.12+ + Pydantic v2 + SQLAlchemy 2.x + Alembic
- Database: PostgreSQL
- API Contract: Auto-generated from FastAPI OpenAPI schema
- Auth: JWT tokens (stateless)
- Testing: pytest + httpx (backend), Vitest + React Testing Library + Playwright (frontend)
- PDF rendering: Jinja2 template printed via the Playwright Chromium already in the backend image

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the implementation plan above.
<!-- SPECKIT END -->
