<!-- SPECKIT START -->
**Current Feature**: [Curated Catalog Discovery & Dealer Inquiry](specs/001-catalog-discovery/spec.md)

**Implementation Plan**: [specs/001-catalog-discovery/plan.md](specs/001-catalog-discovery/plan.md)

**Tech Stack**: 
- Frontend: Next.js (App Router) + React + TypeScript (strict mode)
- Backend: FastAPI + Python 3.12+ + Pydantic v2 + SQLAlchemy 2.x + Alembic
- Database: PostgreSQL
- API Contract: Auto-generated from FastAPI OpenAPI schema
- Auth: JWT tokens (stateless)
- Testing: pytest + httpx (backend), Vitest + React Testing Library + Playwright (frontend)

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the implementation plan above.
<!-- SPECKIT END -->
