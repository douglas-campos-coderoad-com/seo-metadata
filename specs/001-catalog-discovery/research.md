# Research: Curated Catalog Discovery & Dealer Inquiry

**Date**: 2026-08-04 | **Phase**: 0 (Research) | **Status**: Complete

## Summary

No critical unknowns identified. Technical context fully specified by InCollect constitution and clarifications gathered in `/speckit-clarify`. All architectural and technology choices are pre-determined by project standards.

## Technology Decisions

### Backend Framework & ORM
**Decision**: FastAPI + SQLAlchemy 2.x + Alembic  
**Rationale**: Constitution specifies FastAPI for backend. SQLAlchemy 2.x with async support aligns with FastAPI async patterns. Alembic handles schema migrations.  
**Alternatives Considered**: Django (heavier, not needed for this feature); raw psycopg2 (too low-level)

### Authentication Strategy
**Decision**: JWT token-based (stateless)  
**Rationale**: Clarification confirmed JWT preference. Stateless design scales horizontally. Tokens sent as Bearer in Authorization header.  
**Alternatives Considered**: Session-based (requires server-side storage); OAuth2 (out of scope)

### Email Delivery
**Decision**: SMTP-based or cloud provider (e.g., SendGrid, AWS SES)  
**Rationale**: Clarification confirms email-only notification for dealers. SMTP is standard, cloud providers offer better deliverability. Decision deferred to implementation.  
**Alternatives Considered**: In-app notifications only (deferred to v2); SMS (out of scope)

### Frontend Framework
**Decision**: Next.js (App Router) + React + TypeScript  
**Rationale**: Constitution specifies Next.js with App Router. App Router enables Server Components for admin auth, Server Actions for form submission.  
**Alternatives Considered**: Remix (similar capabilities); plain React SPA (less structured)

### API Client Generation
**Decision**: Auto-generated from FastAPI OpenAPI schema  
**Rationale**: Constitution mandates contract-first design. OpenAPI schema is source of truth. CI regenerates client and fails if drift detected.  
**Alternatives Considered**: Hand-written fetch layer (violates constitution); GraphQL (added complexity not justified)

### Database
**Decision**: PostgreSQL 14+  
**Rationale**: Specified in constitution. Rich query capabilities support filtering by category + period. JSON support for future extensibility.  
**Alternatives Considered**: MongoDB (not needed for relational data); SQLite (not suitable for concurrent users)

### Testing Framework
**Decision**: pytest + httpx (backend), Vitest + React Testing Library + Playwright (frontend)  
**Rationale**: Constitution specifies. pytest + httpx tests full request/response cycles. Playwright tests critical user journeys end-to-end.  
**Alternatives Considered**: Jest (slower than Vitest); E2E-only testing (insufficient coverage)

### Image Hosting
**Decision**: External URLs (CDN or object storage), not uploaded in MVP  
**Rationale**: Simplifies MVP scope. Item images stored as URLs in database. Upload feature deferred to v2.  
**Alternatives Considered**: File uploads to server (adds complexity); data URIs (not scalable)

### Admin Interface
**Decision**: Same backend API + Next.js frontend pages with auth guards  
**Rationale**: Clarification confirmed admin interface in scope. Re-uses same API and auth system. Curator authentication enforced in middleware.  
**Alternatives Considered**: Separate admin panel (adds duplication); Django admin (not part of tech stack)

## No Unresolved Clarifications

All critical decisions have been made. The implementation can proceed to Phase 1 (design artifacts) with full confidence in technical direction.

## Deferred Decisions (v2+)

- Email provider selection (SMTP vs. SendGrid vs. AWS SES) — resolved during implementation
- Image upload functionality
- Caching strategy (Redis) if performance requires
- Advanced search and faceted navigation
- In-app notifications for dealers
- Multi-currency support for item valuations
