# Implementation Plan: Curated Catalog Discovery & Dealer Inquiry

**Branch**: `001-catalog-discovery` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-catalog-discovery/spec.md`

**Note**: This plan is filled in by the `/speckit-plan` command following the InCollect constitution and tech stack.

## Summary

Build a curated marketplace where visitors browse high-end items (furniture, fine art, antiques, decorative objects, jewelry spanning 18th–21st century), filter by category and period, and view item details. Authenticated users can send inquiries to dealers via email notifications. The system includes an admin/curator interface for managing items, categories, dealers, and item status. Built as a full-stack web app: Next.js (App Router) + React + TypeScript on frontend, FastAPI + Pydantic v2 + SQLAlchemy on backend, PostgreSQL database. JWT-based stateless authentication with contract-first API design.

## Technical Context

**Language/Version**: Python 3.12+ (backend), TypeScript (frontend with Next.js 15+)

**Primary Dependencies**: 
- Backend: FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, uvicorn
- Frontend: Next.js (App Router), React 19+, TypeScript
- Database: PostgreSQL 14+
- Email: SMTP (or cloud provider, e.g., SendGrid)

**Storage**: PostgreSQL (primary datastore); no cache layer in MVP

**Testing**: 
- Backend: pytest + httpx for API tests, real request/response cycles
- Frontend: Vitest + React Testing Library (units), Playwright (critical user journeys)

**Target Platform**: Web (Next.js frontend + FastAPI backend), Docker Compose for local dev

**Project Type**: Full-stack web application

**Performance Goals**: 
- Filter queries: < 10 seconds (from spec SC-001)
- Item detail pages: < 1.5 seconds (from spec SC-005)
- Registration form: < 2 minutes to complete (from spec SC-002)
- Backend latency SLOs: p95 < 300ms for read endpoints, < 500ms for write endpoints (constitution default)

**Constraints**: 
- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1 (constitution)
- WCAG 2.2 AA accessibility required (constitution)
- Email delivery must be reliable; dealer notifications are critical (from spec)
- Type safety end-to-end: Pydantic on backend, generated TypeScript client on frontend (constitution)

**Scale/Scope**: 
- Initial catalog: 500+ items (from spec SC-006)
- User base: collectors and designers (from spec)
- Admin interface: curator dashboard for item/dealer management
- Email infrastructure required for dealer notifications

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Spec-Driven & Contract-First ✅
- **Status**: PASS
- **Verification**: Feature spec exists and is detailed (spec.md). API contract will be auto-generated from FastAPI models via OpenAPI. TypeScript client will be generated in CI. No hand-written fetch types allowed.
- **Action**: Ensure all API endpoints are defined in FastAPI with Pydantic models before frontend development.

### Principle II: Type Safety End to End ✅
- **Status**: PASS
- **Verification**: Backend uses Pydantic v2 models at all boundaries. Frontend will use TypeScript strict mode. Generated API client carries types into frontend. JWT token validation will be strongly typed.
- **Action**: Enable TypeScript strict mode in frontend. Enforce mypy strict mode in backend.

### Principle III: Test-First With Meaningful Coverage ✅
- **Status**: PASS
- **Verification**: Each user story is testable independently. Tests will be written against acceptance scenarios. Backend: pytest + httpx. Frontend: Vitest + React Testing Library + Playwright for critical journeys. >=80% coverage on changed code.
- **Action**: Write tests before/during implementation for each acceptance scenario.

### Principle IV: Clear Frontend/Backend Boundary ✅
- **Status**: PASS
- **Verification**: Business logic (user auth, item filtering, inquiry routing, email sending) lives in backend. Frontend is presentation layer (renders, routes, calls API). Admin interface is Next.js + API calls (no business logic in frontend).
- **Action**: Implement authorization checks in FastAPI endpoints. Admin features use same API as public features.

### Principle V: Secure & Private By Default ✅
- **Status**: PASS
- **Verification**: All endpoints except GET /items, GET /items/:id are authenticated with JWT. Input validation at boundaries. Email addresses (PII) sent only to dealers. No PII in logs. Dealer email disabled flag prevents unsolicited inquiries. Password hashing required.
- **Action**: Implement JWT middleware in FastAPI. Use bcrypt for password hashing. Validate all input with Pydantic. Add threat notes for email delivery and image uploads in Phase 1.

### Principle VI: Observability & Operability ✅
- **Status**: PASS (with clarifications)
- **Verification**: Structured JSON logging with request ID. Health endpoints required. Errors logged, not swallowed.
- **Action**: Implement health check endpoint. Add request ID middleware. Log inquiry submissions and email sends.

### Principle VII: Performance Budgets & Accessibility ✅
- **Status**: PASS
- **Verification**: Performance targets defined in spec (10s filters, 1.5s pages). Core Web Vitals budget set. WCAG 2.2 AA required for all UI components.
- **Action**: Add Lighthouse CI checks. Implement accessible form labels, ARIA attributes. Test with screen reader.

### Principle VIII: Simplicity & Small Vertical Slices (YAGNI) ✅
- **Status**: PASS
- **Verification**: Admin interface is in scope to allow curator curation (necessary for MVP). No advanced search, faceted nav, or payment processing. Three user stories prioritized; each independently deployable.
- **Action**: Implement P1 (discovery) first, then P2 (auth), then P3 (inquiry).

**Gate Status**: ✅ **ALL PASS** — Feature is aligned with constitution. No violations detected.

## Project Structure

### Documentation (this feature)

```text
specs/001-catalog-discovery/
├── spec.md              # Feature specification (/speckit-specify output)
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output (generated below)
├── data-model.md        # Phase 1 output (generated below)
├── quickstart.md        # Phase 1 output (generated below)
├── contracts/           # Phase 1 output (generated below)
│   ├── public-api.md    # Public browsing API contract
│   ├── auth-api.md      # Authentication API contract
│   ├── inquiry-api.md   # Inquiry API contract
│   └── admin-api.md     # Admin/curator API contract
├── checklists/
│   └── requirements.md  # Quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root) — Full-Stack Web Application

```text
backend/                           # FastAPI + SQLAlchemy + Alembic
├── src/
│   ├── models/                    # SQLAlchemy ORM models (Item, Category, Period, User, Dealer, Inquiry)
│   ├── schemas/                   # Pydantic v2 models (request/response)
│   │   ├── items.py               # ItemCreate, ItemDetail, ItemList
│   │   ├── categories.py          # CategorySchema
│   │   ├── periods.py             # PeriodSchema
│   │   ├── users.py               # UserRegister, UserLogin
│   │   ├── dealers.py             # DealerSchema
│   │   └── inquiries.py           # InquiryCreate, InquiryDetail
│   ├── api/                       # FastAPI route handlers
│   │   ├── items.py               # GET /items, GET /items/:id, POST /items (admin)
│   │   ├── categories.py          # GET /categories, POST /categories (admin)
│   │   ├── periods.py             # GET /periods, POST /periods (admin)
│   │   ├── auth.py                # POST /auth/register, POST /auth/login
│   │   ├── dealers.py             # GET /dealers, POST /dealers (admin), PATCH /dealers/:id (admin, dealer self)
│   │   ├── inquiries.py           # POST /inquiries, GET /inquiries (dealer/admin)
│   │   └── health.py              # GET /health
│   ├── services/                  # Business logic (filtering, auth, email)
│   │   ├── item_service.py        # Item queries, filtering
│   │   ├── auth_service.py        # User registration, JWT token creation
│   │   ├── inquiry_service.py     # Inquiry submission, email routing
│   │   └── email_service.py       # Email sending to dealers
│   ├── middleware/                # Request logging, auth, error handling
│   ├── db/                        # Database initialization, session management
│   ├── migrations/                # Alembic migrations
│   └── main.py                    # FastAPI app setup, logging, middleware
├── tests/
│   ├── conftest.py                # pytest fixtures (db, client)
│   ├── test_items.py              # Tests for item endpoints
│   ├── test_auth.py               # Tests for registration/login
│   ├── test_inquiries.py          # Tests for inquiry submission and email
│   ├── test_admin.py              # Tests for admin/curator endpoints
│   └── integration/               # Full workflow tests
├── requirements.txt               # Python dependencies
├── uv.lock                        # uv lockfile
└── Dockerfile                     # Backend container

frontend/                          # Next.js + React + TypeScript
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Landing/home (redirect to /browse)
│   │   ├── browse/
│   │   │   ├── page.tsx           # Marketplace browse page (P1)
│   │   │   └── [itemId]/
│   │   │       └── page.tsx       # Item detail page (P1)
│   │   ├── auth/
│   │   │   ├── register/page.tsx  # Registration form (P2)
│   │   │   └── login/page.tsx     # Sign-in form (P2)
│   │   ├── inquiries/
│   │   │   └── [itemId]/page.tsx  # Inquiry form modal/page (P3)
│   │   └── admin/
│   │       ├── layout.tsx         # Admin layout (auth wall)
│   │       ├── items/
│   │       │   ├── page.tsx       # Item management list
│   │       │   └── [itemId]/edit/page.tsx
│   │       ├── dealers/page.tsx   # Dealer management
│   │       └── categories/page.tsx
│   ├── components/
│   │   ├── BrowseGallery.tsx      # Item grid with filters (P1)
│   │   ├── ItemFilters.tsx        # Category + period filters (P1)
│   │   ├── ItemCard.tsx           # Item preview card
│   │   ├── ItemDetail.tsx         # Item detail view (P1)
│   │   ├── InquiryForm.tsx        # Inquiry message form (P3)
│   │   ├── AuthForm.tsx           # Registration/login form (P2)
│   │   ├── AdminPanel.tsx         # Admin CRUD components
│   │   └── common/                # Header, footer, loading, error states
│   ├── lib/
│   │   ├── api-client/            # GENERATED from OpenAPI (via openapi-typescript or similar)
│   │   │   └── types.ts           # Auto-generated API types from FastAPI schema
│   │   ├── auth.ts                # JWT token storage, request headers
│   │   ├── hooks/
│   │   │   ├── useAuth.ts         # useAuth() hook for accessing current user
│   │   │   ├── useItems.ts        # useItems() hook with caching
│   │   │   └── useInquiry.ts      # useInquiry() hook
│   │   └── validation.ts          # Email/password validation rules (mirrors backend)
│   ├── styles/
│   │   └── globals.css            # Global styles, Tailwind config
│   └── types/                     # Custom TypeScript types (extends generated API types)
├── tests/
│   ├── unit/                      # Vitest unit tests
│   │   ├── ItemFilters.test.tsx   # Filter logic
│   │   └── AuthForm.test.tsx
│   ├── integration/               # React Testing Library
│   │   ├── browse.test.tsx        # Browse + filter journey (P1)
│   │   ├── auth.test.tsx          # Register + login journey (P2)
│   │   └── inquiry.test.tsx       # Inquiry submission journey (P3)
│   └── e2e/                       # Playwright
│       ├── browse.spec.ts         # Critical user journey: discover + inquire
│       └── admin.spec.ts          # Critical admin workflow
├── package.json
├── tsconfig.json                  # TypeScript strict mode
├── next.config.js
└── Dockerfile                     # Frontend container

infra/
├── docker-compose.yml             # Local dev: frontend, backend, postgres
├── postgres/                      # PostgreSQL init scripts
└── env/
    ├── .env.example
    └── .env.development

packages/
└── api-client/                    # GENERATED from backend OpenAPI
    ├── src/
    │   ├── index.ts               # Re-exports all types and client
    │   ├── types.ts               # Generated Pydantic models as TypeScript types
    │   └── client.ts              # Typed fetch wrapper or openapi-typescript client
    └── package.json

Makefile                           # make dev, make test, make gen-client, make build
```

### Key Design Decisions

1. **Repository Structure**: Single monorepo with separate backend/ and frontend/ directories. Packages/api-client is auto-generated.
2. **Authentication**: JWT tokens issued on login, stored in frontend (httpOnly cookie or secure storage), sent with each API request.
3. **API Contract**: FastAPI generates `/openapi.json`. CI regenerates api-client on every commit; drift fails the build.
4. **Admin Interface**: Same API routes as public features; authorization enforced in FastAPI middleware/route handlers.
5. **Email Delivery**: FastAPI service sends formatted emails to dealers on inquiry submission (SMTP or cloud provider).
6. **Image Handling**: Items have image URLs (stored in database); hosting external (CDN or object storage like S3). File upload not in MVP.
7. **Filtering**: Query parameters (category=Furniture&period=18th-Century). No search index in MVP; basic SQL WHERE.
8. **Testing Strategy**: Tests written first, against acceptance scenarios. Backend tests exercise full request/response. Frontend tests verify user journeys.
9. **Accessibility**: All forms require proper labels, error messages. Admin interface built with accessibility in mind (ARIA, keyboard nav).
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
