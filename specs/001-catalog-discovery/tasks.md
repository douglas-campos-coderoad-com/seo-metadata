# Tasks: Curated Catalog Discovery & Dealer Inquiry

**Input**: Design documents from `specs/001-catalog-discovery/` (spec.md, plan.md, data-model.md, contracts/api.md)

**Prerequisites**: All design artifacts complete (plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Each story can be implemented, tested, and deployed independently.

**Tech Stack** (from plan.md):
- **Backend**: FastAPI + Python 3.12+ + Pydantic v2 + SQLAlchemy 2.x + Alembic + pytest + httpx
- **Frontend**: Next.js (App Router) + React 19+ + TypeScript (strict mode) + Vitest + React Testing Library + Playwright
- **Database**: PostgreSQL 14+
- **Auth**: JWT tokens (stateless)
- **Monorepo**: `backend/`, `frontend/`, `packages/api-client/`, `infra/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create backend directory structure (`backend/src/models`, `backend/src/schemas`, `backend/src/api`, `backend/src/services`, `backend/src/middleware`, `backend/src/db`, `backend/migrations`)
- [ ] T002 Create frontend directory structure (`frontend/src/app`, `frontend/src/components`, `frontend/src/lib`, `frontend/src/styles`, `frontend/src/types`)
- [ ] T003 Create infra directory structure (`infra/postgres`, `infra/env`)
- [ ] T004 [P] Initialize FastAPI project with dependencies in `backend/requirements.txt` (FastAPI, uvicorn, sqlalchemy, alembic, pydantic, bcrypt, python-jose, pydantic[email], pytest, httpx, python-dotenv)
- [ ] T005 [P] Initialize Next.js project with dependencies in `frontend/package.json` (next, react, typescript, tailwindcss, vitest, playwright, axios/fetch client)
- [ ] T006 [P] Setup Makefile with `make dev`, `make test`, `make gen-client`, `make build` commands
- [ ] T007 [P] Configure TypeScript strict mode in `frontend/tsconfig.json` and `backend/pyproject.toml` (or `mypy.ini`)
- [ ] T008 [P] Setup linting and formatting: `backend/` (ruff, black, mypy), `frontend/` (eslint, prettier)
- [ ] T009 Create docker-compose.yml for local dev (frontend, backend, postgres, mailhog for email testing)
- [ ] T010 Create .env.example file with all required environment variables (DATABASE_URL, JWT_SECRET, SMTP settings, etc.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T011 [P] Initialize Alembic migrations framework in `backend/migrations/` with `alembic init`
- [ ] T012 [P] Create SQLAlchemy base session management in `backend/src/db/session.py`
- [ ] T013 [P] Create database configuration in `backend/src/db/__init__.py` (Database URL, engine, sessionmaker)
- [ ] T014 [P] Implement JWT authentication middleware in `backend/src/middleware/auth.py` (token validation, user context injection)
- [ ] T015 [P] Implement error handling middleware in `backend/src/middleware/errors.py` (logging, error response formatting)
- [ ] T016 [P] Create logging configuration in `backend/src/middleware/logging.py` (structured JSON logging with request IDs)
- [ ] T017 [P] Setup FastAPI application factory in `backend/src/main.py` (middleware registration, route mounting, CORS config)
- [ ] T018 [P] Create base models in `backend/src/models/__init__.py` (SQLAlchemy declarative base, common timestamp fields)
- [ ] T019 [P] Create Pydantic base schemas in `backend/src/schemas/__init__.py` (BaseSchema, PaginatedResponse)
- [ ] T020 Create database initialization script in `backend/src/db/init_db.py` (seed categories, periods, demo dealers)
- [ ] T021 Create health check endpoint in `backend/src/api/health.py` (GET /health returns JSON status)
- [ ] T022 Implement NextAuth.js / JWT handling in frontend `frontend/src/lib/auth.ts` (token storage, request headers, useAuth hook)
- [ ] T023 Create API client setup in `frontend/src/lib/api-client/` (base URL, error handling, interceptors for JWT)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Browse Curated Marketplace with Filters (Priority: P1) 🎯 MVP

**Goal**: Visitors can browse a curated marketplace, filter items by category and period, and view detailed item pages. Deliverable MVP.

**Independent Test**: Navigate to /browse, apply filters, view item details - all without authentication. Validate SC-001, SC-005, SC-006 from spec.

### Database & Models for User Story 1

- [ ] T024 [P] Create Category model in `backend/src/models/category.py` (id, name, description, timestamps)
- [ ] T025 [P] Create Period model in `backend/src/models/period.py` (id, name, start_year, end_year, timestamps)
- [ ] T026 [P] Create Dealer model stub in `backend/src/models/dealer.py` (id, name, email, inquiries_enabled, timestamps) - full implementation in Phase 5
- [ ] T027 [P] Create Item model in `backend/src/models/item.py` (id, title, description, category_id, period_id, dealer_id, image_urls, condition, asking_price, status, timestamps with proper foreign keys and indexes)

### Schemas (API Input/Output) for User Story 1

- [ ] T028 [P] Create Category schema in `backend/src/schemas/categories.py` (CategorySchema, CategoryCreate for admin)
- [ ] T029 [P] Create Period schema in `backend/src/schemas/periods.py` (PeriodSchema, PeriodCreate for admin)
- [ ] T030 [P] Create Item schema in `backend/src/schemas/items.py` (ItemListResponse, ItemDetailResponse with joined dealer/category/period names, ItemCreate for admin)
- [ ] T031 Create ItemFilterQuery schema in `backend/src/schemas/items.py` (category_id, period_id, skip, limit, status)

### Services (Business Logic) for User Story 1

- [ ] T032 [P] Create ItemService in `backend/src/services/item_service.py` (get_items with filtering, get_item_by_id, validate filters, handle pagination)
- [ ] T033 [P] Create CategoryService in `backend/src/services/category_service.py` (list_categories, get_category)
- [ ] T034 [P] Create PeriodService in `backend/src/services/period_service.py` (list_periods, get_period)

### API Endpoints for User Story 1

- [ ] T035 [P] Implement public browse endpoints in `backend/src/api/items.py` (GET /items with filters, GET /items/:id) - map to contracts/api.md spec
- [ ] T036 [P] Implement category endpoints in `backend/src/api/categories.py` (GET /categories public)
- [ ] T037 [P] Implement period endpoints in `backend/src/api/periods.py` (GET /periods public)
- [ ] T038 Create Alembic migration for Category, Period, Item, Dealer tables in `backend/migrations/versions/001_initial_schema.py`
- [ ] T039 Create database seed script in `backend/src/db/seed_data.py` (insert 5 categories, 4 periods, 2+ dealers, 10+ items across categories/periods)

### Frontend Pages for User Story 1

- [ ] T040 [P] Create BrowseGallery component in `frontend/src/components/BrowseGallery.tsx` (item grid with images, title, dealer, category, period)
- [ ] T041 [P] Create ItemFilters component in `frontend/src/components/ItemFilters.tsx` (category dropdown, period dropdown, clear filters button, apply logic)
- [ ] T042 [P] Create ItemCard component in `frontend/src/components/ItemCard.tsx` (item preview card for grid)
- [ ] T043 [P] Create ItemDetail component in `frontend/src/components/ItemDetail.tsx` (full item info: images, title, description, condition, price, dealer, period, category)
- [ ] T044 Create browse page in `frontend/src/app/browse/page.tsx` (layout, BrowseGallery + ItemFilters integration, data fetching)
- [ ] T045 Create item detail page in `frontend/src/app/browse/[itemId]/page.tsx` (fetch item by ID, render ItemDetail component)
- [ ] T046 Create home/landing page in `frontend/src/app/page.tsx` (redirect to /browse or landing text)

### Frontend Hooks & API Integration for User Story 1

- [ ] T047 [P] Create useItems hook in `frontend/src/lib/hooks/useItems.ts` (fetch items with filters, pagination, error handling, caching)
- [ ] T048 [P] Create useCategories hook in `frontend/src/lib/hooks/useCategories.ts` (fetch categories)
- [ ] T049 [P] Create usePeriods hook in `frontend/src/lib/hooks/usePeriods.ts` (fetch periods)

### Styling for User Story 1

- [ ] T050 [P] Setup Tailwind CSS in `frontend/` with dark mode support (tailwind.config.js)
- [ ] T051 [P] Create global styles in `frontend/src/styles/globals.css` (typography, spacing, colors)
- [ ] T052 [P] Create component styles (BrowseGallery, ItemCard, ItemFilters, ItemDetail) using Tailwind

### Tests for User Story 1

- [ ] T053 [P] Contract test for GET /items in `backend/tests/contract/test_items_list.py` (test filtering by category, period, combined, pagination, response schema)
- [ ] T054 [P] Contract test for GET /items/:id in `backend/tests/contract/test_items_detail.py` (test detail response, verify dealer name/inquiries_enabled included)
- [ ] T055 [P] Contract tests for GET /categories and GET /periods in `backend/tests/contract/test_filters.py`
- [ ] T056 [P] Integration test for browse + filter journey in `backend/tests/integration/test_browse_flow.py` (create items, filter, assert results)
- [ ] T057 [P] Frontend unit tests for ItemFilters in `frontend/tests/unit/ItemFilters.test.tsx` (filter state, apply logic)
- [ ] T058 [P] Frontend integration test for browse page in `frontend/tests/integration/browse.test.tsx` (render, fetch items, apply filters)
- [ ] T059 Playwright E2E test for browse journey in `frontend/tests/e2e/browse.spec.ts` (open /browse, apply filters, click item, verify detail page)

**Checkpoint**: User Story 1 complete and independently testable. MVP deliverable. Can deploy at this point and validate SC-001, SC-005, SC-006.

---

## Phase 4: User Story 2 - User Registration & Sign In (Priority: P2)

**Goal**: Visitors can register with email/password and sign in to access inquiry functionality. New user accounts unlock P3 (inquiry sending).

**Independent Test**: Register new user, verify account created, sign out, sign in with credentials, access protected routes. Validate SC-002 from spec.

### Database & Models for User Story 2

- [ ] T060 Create User model in `backend/src/models/user.py` (id, email [unique, indexed], password_hash [bcrypt], name, created_at, last_sign_in, is_admin, timestamps)

### Schemas for User Story 2

- [ ] T061 [P] Create User schema in `backend/src/schemas/users.py` (UserRegisterRequest, UserLoginRequest, UserResponse with id/email/name/is_admin, TokenResponse)
- [ ] T062 [P] Create password validation rules in `backend/src/schemas/users.py` (min 8 chars, uppercase, lowercase, digit, special char)

### Services for User Story 2

- [ ] T063 Create AuthService in `backend/src/services/auth_service.py` (register_user with validation/hashing, authenticate_user, create_jwt_token, validate_token)
- [ ] T064 [P] Create UserService in `backend/src/services/user_service.py` (get_user_by_id, get_user_by_email, list_users for admin)
- [ ] T065 Implement password validation function in `backend/src/services/auth_service.py` (check complexity rules, return specific error messages)

### API Endpoints for User Story 2

- [ ] T066 Implement registration endpoint in `backend/src/api/auth.py` (POST /auth/register: validate email/password, hash password, create user, issue token) - map to contracts/api.md
- [ ] T067 Implement login endpoint in `backend/src/api/auth.py` (POST /auth/login: validate credentials, return JWT token and user info)

### Frontend Pages & Components for User Story 2

- [ ] T068 [P] Create AuthForm component in `frontend/src/components/AuthForm.tsx` (email input, password input, password complexity display, submit button, error messages)
- [ ] T069 [P] Create registration page in `frontend/src/app/auth/register/page.tsx` (AuthForm for registration, success redirect to /browse, token storage)
- [ ] T070 [P] Create login page in `frontend/src/app/auth/login/page.tsx` (AuthForm for login, success redirect to /browse, token storage)
- [ ] T071 Create header/navigation component in `frontend/src/components/Header.tsx` (show user info if authenticated, sign out button, login/register links if not)

### Frontend Auth Hooks for User Story 2

- [ ] T072 Create useAuth hook in `frontend/src/lib/hooks/useAuth.ts` (current user context, isAuthenticated, logout, redirect to login if needed)
- [ ] T073 Create API calls for auth in `frontend/src/lib/api-client/auth.ts` (register, login, validate token)

### Validation for User Story 2

- [ ] T074 [P] Create email validation schema in `frontend/src/lib/validation.ts` (RFC 5322 regex, mirrors backend)
- [ ] T074a [P] Create password validation schema in `frontend/src/lib/validation.ts` (complexity rules, mirrors backend)

### Database Migration for User Story 2

- [ ] T075 Create Alembic migration for User table in `backend/migrations/versions/002_add_users.py` (email unique index, password_hash, is_admin default false)

### Tests for User Story 2

- [ ] T076 [P] Contract test for POST /auth/register in `backend/tests/contract/test_auth_register.py` (valid/invalid email, weak password, duplicate email, successful registration)
- [ ] T077 [P] Contract test for POST /auth/login in `backend/tests/contract/test_auth_login.py` (valid/invalid credentials, token issued, user info in response)
- [ ] T078 [P] Integration test for registration flow in `backend/tests/integration/test_register_flow.py` (create user, verify in DB, token valid)
- [ ] T079 [P] Integration test for login flow in `backend/tests/integration/test_login_flow.py` (authenticate, verify token claims, subsequent requests with token)
- [ ] T080 [P] Frontend unit tests for AuthForm in `frontend/tests/unit/AuthForm.test.tsx` (validation, error display, submit)
- [ ] T081 [P] Frontend integration test for auth journey in `frontend/tests/integration/auth.test.tsx` (register, verify user stored, sign out, sign in)
- [ ] T082 Playwright E2E test for auth journey in `frontend/tests/e2e/auth.spec.ts` (register, verify redirect, sign out, sign in, verify protected access)

**Checkpoint**: User Stories 1 & 2 complete. Can demo marketplace browsing and user authentication. Foundation for P3 inquiry feature ready.

---

## Phase 5: User Story 3 - Send Dealer Inquiry (Priority: P3)

**Goal**: Authenticated users can send inquiries to dealers about items. Dealer receives email notification with customer contact info. System prevents duplicate inquiries.

**Independent Test**: Sign in, navigate to item with inquiries_enabled=true, submit inquiry form, verify inquiry recorded and dealer email sent. Validate SC-003, SC-004 from spec.

### Database & Models for User Story 3

- [ ] T083 Create Inquiry model in `backend/src/models/inquiry.py` (id, user_id [FK], item_id [FK], dealer_id [FK], message, status enum, email_sent boolean, email_sent_at, timestamps with proper foreign keys and indexes on (item_id, user_id) for duplicate checking)
- [ ] T084 Update Dealer model in `backend/src/models/dealer.py` to add inquiries_enabled boolean (default True) - done in earlier phase but update here if needed

### Schemas for User Story 3

- [ ] T085 Create Inquiry schemas in `backend/src/schemas/inquiries.py` (InquiryCreateRequest with item_id/message, InquiryResponse with user/item/dealer/message/status)

### Services for User Story 3

- [ ] T086 Create InquiryService in `backend/src/services/inquiry_service.py` (create_inquiry with validation, check duplicates within 24h, check dealer.inquiries_enabled, check item.status='available')
- [ ] T087 Create EmailService in `backend/src/services/email_service.py` (send_dealer_inquiry_email with formatted email template from contracts/api.md spec)
- [ ] T088 Implement inquiry creation with email sending in InquiryService (call EmailService.send_dealer_inquiry_email, update email_sent flag, handle send failures gracefully)

### API Endpoints for User Story 3

- [ ] T089 Implement inquiry submission endpoint in `backend/src/api/inquiries.py` (POST /inquiries: requires auth, validates item/dealer/message, creates inquiry, sends email) - map to contracts/api.md
- [ ] T090 Implement inquiry retrieval endpoints in `backend/src/api/inquiries.py` (GET /inquiries for user's sent inquiries, GET /inquiries?type=received for dealer's received [admin only])

### Frontend Pages & Components for User Story 3

- [ ] T091 Create InquiryForm component in `frontend/src/components/InquiryForm.tsx` (message textarea, submit button, validation, loading state, error/success messages)
- [ ] T092 Create inquiry modal/page in `frontend/src/app/inquiries/[itemId]/page.tsx` (show item details, InquiryForm, submission handling)
- [ ] T093 Update ItemDetail component to show inquiry button (if dealer.inquiries_enabled=true) or "Contact dealer directly" message (if false)
- [ ] T094 Update browse/[itemId]/page.tsx to show Inquiry button that links to or opens InquiryForm

### Frontend Hooks for User Story 3

- [ ] T095 Create useInquiry hook in `frontend/src/lib/hooks/useInquiry.ts` (submit inquiry, fetch user's inquiries)
- [ ] T096 Create API calls for inquiries in `frontend/src/lib/api-client/inquiries.ts` (POST /inquiries, GET /inquiries)

### Database Migration for User Story 3

- [ ] T097 Create Alembic migration for Inquiry table in `backend/migrations/versions/003_add_inquiries.py` (user_id, item_id, dealer_id foreign keys, status enum, email_sent, email_sent_at, indexes)

### Email Configuration

- [ ] T098 Setup SMTP configuration in `backend/src/config.py` (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD from environment)
- [ ] T099 Create email template for dealer inquiry in `backend/src/services/email_templates.py` (format from contracts/api.md spec)

### Tests for User Story 3

- [ ] T100 [P] Contract test for POST /inquiries in `backend/tests/contract/test_inquiries_submit.py` (valid submission, unauthenticated rejection, item not found, dealer inquiries disabled, duplicate prevention)
- [ ] T101 [P] Contract test for GET /inquiries in `backend/tests/contract/test_inquiries_list.py` (user can see own inquiries, dealer can see received inquiries [with auth check])
- [ ] T102 [P] Integration test for inquiry submission flow in `backend/tests/integration/test_inquiry_flow.py` (submit inquiry, verify DB record, verify email sent)
- [ ] T103 [P] Integration test for duplicate prevention in `backend/tests/integration/test_inquiry_duplicates.py` (submit twice within 24h, verify 409 conflict)
- [ ] T104 [P] Email delivery test in `backend/tests/integration/test_email_delivery.py` (mock SMTP, verify email format and content)
- [ ] T105 [P] Frontend unit tests for InquiryForm in `frontend/tests/unit/InquiryForm.test.tsx` (validation, empty message rejection, submit)
- [ ] T106 [P] Frontend integration test for inquiry journey in `frontend/tests/integration/inquiry.test.tsx` (sign in, navigate to item, submit inquiry, verify success message)
- [ ] T107 Playwright E2E test for full inquiry journey in `frontend/tests/e2e/browse.spec.ts` (browse, filter, select item, submit inquiry, verify confirmation)

**Checkpoint**: All three user stories complete. Full marketplace with inquiry functionality ready. Can deploy and run quickstart.md validation scenarios.

---

## Phase 6: Admin/Curator Interface

**Goal**: Administrators can create/edit items, manage categories/periods, manage dealers, and control dealer settings (inquiries_enabled flag).

**Independent Test**: Admin login, create item, edit dealer inquiries_enabled flag, verify changes visible in public marketplace.

### Database & Models (Update existing)

- [ ] T108 Verify User model has is_admin boolean field for curator access control

### Schemas for Admin Interface

- [ ] T109 [P] Create admin item creation schema in `backend/src/schemas/items.py` (ItemCreateRequest with all required fields)
- [ ] T110 [P] Create admin dealer schema in `backend/src/schemas/dealers.py` (DealerSchema, DealerUpdateRequest for inquiries_enabled/contact_info)
- [ ] T111 [P] Create admin category schema in `backend/src/schemas/categories.py` (CategoryCreateRequest)
- [ ] T112 [P] Create admin period schema in `backend/src/schemas/periods.py` (PeriodCreateRequest)

### Services for Admin Interface

- [ ] T113 Create admin item management service methods in ItemService (create_item, update_item, delete_item soft delete)
- [ ] T114 [P] Create DealerService in `backend/src/services/dealer_service.py` (create_dealer, update_dealer, list_dealers, get_dealer)
- [ ] T115 [P] Create admin category management service methods in CategoryService (create_category, update_category)
- [ ] T116 [P] Create admin period management service methods in PeriodService (create_period, update_period)

### API Endpoints for Admin Interface

- [ ] T117 Create item CRUD endpoints in `backend/src/api/admin_items.py` (POST /admin/items, PATCH /admin/items/:id, DELETE /admin/items/:id) - require is_admin=true
- [ ] T118 Create dealer management endpoints in `backend/src/api/admin_dealers.py` (GET /admin/dealers, PATCH /admin/dealers/:id for inquiries_enabled toggle)
- [ ] T119 Create category management endpoints in `backend/src/api/admin_categories.py` (POST /admin/categories, PATCH /admin/categories/:id) - require is_admin=true
- [ ] T120 Create period management endpoints in `backend/src/api/admin_periods.py` (POST /admin/periods, PATCH /admin/periods/:id) - require is_admin=true
- [ ] T121 Create auth guard middleware for admin endpoints in `backend/src/middleware/admin_guard.py` (verify is_admin=true, reject with 403 if not)

### Frontend Admin Pages

- [ ] T122 Create admin layout in `frontend/src/app/admin/layout.tsx` (auth wall: redirect non-admins, side navigation for admin panels)
- [ ] T123 [P] Create item management page in `frontend/src/app/admin/items/page.tsx` (list items, create form, edit form)
- [ ] T124 [P] Create item edit page in `frontend/src/app/admin/items/[itemId]/edit/page.tsx` (form with fields: title, description, category, period, dealer, images, condition, asking_price, status)
- [ ] T125 [P] Create dealer management page in `frontend/src/app/admin/dealers/page.tsx` (list dealers, toggle inquiries_enabled flag)
- [ ] T126 [P] Create category management page in `frontend/src/app/admin/categories/page.tsx` (list categories, create form)
- [ ] T127 [P] Create period management page in `frontend/src/app/admin/periods/page.tsx` (list periods, create form)

### Frontend Admin Components

- [ ] T128 [P] Create ItemForm component in `frontend/src/components/admin/ItemForm.tsx` (reusable for create/edit)
- [ ] T129 [P] Create DealerToggle component in `frontend/src/components/admin/DealerToggle.tsx` (inquiries_enabled switch)
- [ ] T130 [P] Create CategoryForm component in `frontend/src/components/admin/CategoryForm.tsx` (category create/edit form)
- [ ] T131 [P] Create PeriodForm component in `frontend/src/components/admin/PeriodForm.tsx` (period create/edit form)

### Frontend Admin Hooks

- [ ] T132 [P] Create useAdminItems hook in `frontend/src/lib/hooks/useAdminItems.ts` (CRUD operations for items)
- [ ] T133 [P] Create useAdminDealers hook in `frontend/src/lib/hooks/useAdminDealers.ts` (list, toggle inquiries_enabled)
- [ ] T134 [P] Create useAdminCategories hook in `frontend/src/lib/hooks/useAdminCategories.ts` (CRUD for categories)
- [ ] T135 [P] Create useAdminPeriods hook in `frontend/src/lib/hooks/useAdminPeriods.ts` (CRUD for periods)

### Tests for Admin Interface

- [ ] T136 [P] Contract tests for admin item endpoints in `backend/tests/contract/test_admin_items.py` (create, update status, edit fields, 403 for non-admin)
- [ ] T137 [P] Contract tests for dealer management in `backend/tests/contract/test_admin_dealers.py` (toggle inquiries_enabled, verify public endpoint reflects change)
- [ ] T138 [P] Integration test for admin item creation in `backend/tests/integration/test_admin_items.py` (create item, verify in browse results)
- [ ] T139 [P] Integration test for dealer inquiry control in `backend/tests/integration/test_dealer_inquiry_control.py` (toggle flag, verify inquiry submission blocked)
- [ ] T140 [P] Frontend integration test for admin item creation in `frontend/tests/integration/admin.test.tsx` (admin login, create item, verify in marketplace)
- [ ] T141 [P] Playwright E2E test for admin workflow in `frontend/tests/e2e/admin.spec.ts` (admin login, create item, verify live in marketplace, toggle dealer flag)

**Checkpoint**: Admin interface complete. Curators can fully manage marketplace without backend database access.

---

## Phase 7: API Client Generation & Integration

**Goal**: Auto-generate TypeScript client from FastAPI OpenAPI schema and verify contract compliance.

**Independent Test**: Generate client, verify types match backend, test API calls with generated client in frontend.

- [ ] T142 Create client generation script in `Makefile` (openapi-typescript /api/v1/openapi.json -o packages/api-client/src/types.ts)
- [ ] T143 Create typed fetch client wrapper in `packages/api-client/src/client.ts` (base URL, error handling, interceptors)
- [ ] T144 Export generated client in `packages/api-client/src/index.ts` (re-export types and client)
- [ ] T145 Create CI check to fail if generated client diffs from committed version (enforce contract-first design)
- [ ] T146 Test frontend can import and use generated client types (no hand-written fetch types)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Performance, accessibility, documentation, and quality improvements

- [ ] T147 [P] Run Lighthouse audit on all frontend pages and fix issues to meet Core Web Vitals targets (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- [ ] T148 [P] Audit all frontend components for WCAG 2.2 AA accessibility (focus management, aria-labels, semantic HTML, keyboard navigation)
- [ ] T149 [P] Add database indexes per data-model.md (composite indexes on (category_id, period_id), indexes on dealer_id, status, created_at)
- [ ] T150 [P] Implement pagination caching with React Query or SWR in frontend (avoid re-fetching)
- [ ] T151 [P] Add request/response logging middleware in backend (correlation IDs, endpoint latency tracking)
- [ ] T152 [P] Create comprehensive API documentation (OpenAPI rendered on /docs via Swagger UI)
- [ ] T153 [P] Add error recovery: client-side retry logic for failed API calls, exponential backoff
- [ ] T154 [P] Create database backup strategy documentation in `infra/BACKUP.md`
- [ ] T155 [P] Security review: password storage (bcrypt cost), HTTPS in prod, JWT secret strength, CORS config, input validation
- [ ] T156 [P] Create DEPLOYMENT.md documentation (environment variables, database migrations, build steps, docker deployment)
- [ ] T157 [P] Create README.md with:
  - Feature overview
  - Local dev setup (`make dev`)
  - Test suite commands (`make test`)
  - API documentation link
  - Deployment instructions
  - Tech stack summary
- [ ] T158 [P] Run full test suite and verify >=80% coverage on changed code (`pytest --cov` backend, `vitest --coverage` frontend)
- [ ] T159 [P] Update TypeScript types in frontend based on final OpenAPI schema (regenerate client if needed)
- [ ] T160 [P] Performance testing: Load test filter queries with 500+ items, verify < 10s response time
- [ ] T161 [P] Run quickstart.md validation scenarios end-to-end:
  - Scenario 1: Browse & Filter (P1)
  - Scenario 2: Register & Sign In (P2)
  - Scenario 3: Send Dealer Inquiry (P3)
  - Scenario 4: Admin Interface
- [ ] T162 [P] Fix any bugs found during quickstart validation
- [ ] T163 Create CHANGELOG.md documenting feature release
- [ ] T164 Team final review and sign-off before merge/deployment

**Checkpoint**: Feature complete, tested, documented, and ready for production deployment.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-5)**: All depend on Foundational phase completion
  - Can proceed sequentially (P1 → P2 → P3) for safer MVP approach
  - Or in parallel if team capacity allows (all stories start after Foundational done)
- **Admin Interface (Phase 6)**: Can start after Phase 2 Foundational, or after Phase 5 if coordinating with other stories
- **API Client Generation (Phase 7)**: Start after Phase 5 (all endpoints defined)
- **Polish (Phase 8)**: Depends on all features complete (all prior phases)

### Within Each User Story

1. Database models first
2. Schemas (Pydantic for validation)
3. Services (business logic)
4. API endpoints
5. Frontend components & pages
6. Frontend hooks & API integration
7. Tests (write before or with implementation, per TDD)

### Parallel Opportunities

**Within Phase 1 (Setup)**: All tasks marked [P] can run in parallel (different directories, no dependencies)

**Within Phase 2 (Foundational)**: All [P] tasks can run in parallel, then dependencies flow (middleware, services, endpoints)

**After Phase 2 Complete**: 
- All three user stories (P1, P2, P3) can start in parallel
- Different team members can work on different stories simultaneously
- Or proceed sequentially for simpler MVP approach

**Within Each User Story**:
- Models can be created in parallel (T024-T027, T060, T083 - different files)
- Schemas can be created in parallel (T028-T031, T061-T062, T085)
- Services can be created in parallel if no dependencies
- Frontend components can be created in parallel (different files)
- Tests marked [P] can run in parallel

---

## Parallel Example: Team of 3 Developers

```
Day 1-2: All together
  Phase 1 (Setup) → T001-T010: Project structure, dependencies
  Phase 2 (Foundational) → T011-T023: Database, auth, logging, API setup

Day 3+: Split teams (after Foundational done)
  Developer A: User Story 1 (Browse) → Phase 3 tasks T024-T059
  Developer B: User Story 2 (Auth) → Phase 4 tasks T060-T082
  Developer C: User Story 3 (Inquiry) → Phase 5 tasks T083-T107
  
Day 7+: Regroup
  All together: Phase 6 (Admin) → T108-T141
  Parallel: Phase 7 (Client Gen) → T142-T146
  Parallel: Phase 8 (Polish) → T147-T164
```

---

## Implementation Strategy

### MVP First (Recommended for Learning)

1. Complete Phase 1: Setup (T001-T010)
2. Complete Phase 2: Foundational (T011-T023) - BLOCKING
3. Complete Phase 3: User Story 1 - Browse (T024-T059)
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1, confirm SC-001/SC-005/SC-006
5. DEPLOY/DEMO if ready
6. Then add P2 (Auth) → Phase 4
7. Then add P3 (Inquiry) → Phase 5
8. Then add Admin → Phase 6

### Incremental Delivery (For Team)

- Weeks 1-2: Setup + Foundational (Phases 1-2) - whole team
- Week 3: User Story 1 - Browse (Phase 3) - one developer, first MVP release
- Week 4: User Story 2 - Auth (Phase 4) - parallel with P1 if possible
- Week 5: User Story 3 - Inquiry (Phase 5) - parallel with P2 if possible
- Week 6: Admin Interface (Phase 6) - curator capabilities
- Week 7: Client generation + Polish (Phases 7-8) - final testing and deployment

### Continuous Validation

After each user story completes:
1. Run relevant quickstart.md scenarios
2. Test success criteria from spec.md
3. Verify >=80% test coverage
4. Run Lighthouse and accessibility audit
5. Get team sign-off before moving to next story

---

## Notes & Best Practices

- **[P] tasks** = parallelizable (different files, no blocking dependencies). Launch together.
- **[Story] label** = maps task to specific user story for traceability and independent completion.
- **Test-first approach**: Write tests before implementation (per constitution III). Verify tests FAIL before implementation.
- **Each user story independently testable**: Can deploy each story alone and validate it works.
- **Commit frequency**: Small commits after each task or logical group (don't wait for full phase).
- **Database migrations**: Run Alembic migrate before tests; seed data in test fixtures.
- **API client generation**: Automate in CI; fail build if drift detected (contract-first gate).
- **Performance**: Run performance tests during Phase 8 (T160 filter queries, T147 Lighthouse).
- **Security**: Review password hashing (bcrypt cost=12), JWT secret strength, HTTPS in prod, CORS config (T155).
- **Accessibility**: Test WCAG 2.2 AA during development, not as afterthought (T148).
- **Documentation**: Keep README.md, DEPLOYMENT.md, API docs in sync with features (T157).
- **Team coordination**: Use this task list to track progress; mark [x] as complete; note blockers.

---

## Quick Reference: Task Counts

| Phase | Name | Task Range | Count |
|-------|------|-----------|-------|
| 1 | Setup | T001-T010 | 10 tasks |
| 2 | Foundational | T011-T023 | 13 tasks |
| 3 | US1: Browse | T024-T059 | 36 tasks |
| 4 | US2: Auth | T060-T082 | 23 tasks |
| 5 | US3: Inquiry | T083-T107 | 25 tasks |
| 6 | Admin | T108-T141 | 34 tasks |
| 7 | Client Gen | T142-T146 | 5 tasks |
| 8 | Polish | T147-T164 | 18 tasks |
| **TOTAL** | | **T001-T164** | **164 tasks** |

---

## Success Criteria Mapping

| Spec Success Criteria | User Story | Tasks | Validation |
|----------------------|-----------|-------|-----------|
| SC-001: Filters < 10s | P1 | T024-T057 | T160 performance test |
| SC-002: Register < 2min | P2 | T060-T082 | T082 E2E test |
| SC-003: Inquiry < 3min | P3 | T083-T107 | T107 E2E test |
| SC-004: 95% email delivery | P3 | T086-T088 | T102-T104 email tests |
| SC-005: Item detail < 1.5s | P1 | T024-T057 | T160 performance test |
| SC-006: 500+ items support | P1 | T038-T039 | T057 integration test |
| SC-007: Validation 100% | P2 | T074-T074a | T076 contract test |

---

## Checkpoint Validation Commands

```bash
# After Phase 1 (Setup)
make dev  # Verify Docker Compose and services start

# After Phase 2 (Foundational)
make test  # Verify CI checks pass (lint, type, tests)

# After Phase 3 (US1 - Browse)
# Test Scenario 1 from quickstart.md
curl "http://localhost:8000/api/v1/items?limit=10"  # Verify items return
make test  # Verify all US1 tests pass

# After Phase 4 (US2 - Auth)
# Test Scenario 2 from quickstart.md
curl -X POST "http://localhost:8000/api/v1/auth/register" ...  # Register user
curl -X POST "http://localhost:8000/api/v1/auth/login" ...  # Sign in

# After Phase 5 (US3 - Inquiry)
# Test Scenario 3 from quickstart.md
curl -X POST "http://localhost:8000/api/v1/inquiries" ...  # Submit inquiry

# After Phase 6 (Admin)
# Test Scenario 4 from quickstart.md
curl -X POST "http://localhost:8000/api/v1/admin/items" ...  # Create item

# After Phase 7 (Client Gen)
make gen-client  # Generate TypeScript client
npm install  # Verify frontend can import generated types

# After Phase 8 (Polish)
make test  # Final test run
npm run lighthouse  # Verify Core Web Vitals
npm run a11y  # Verify accessibility
# Run full quickstart.md validation
```
