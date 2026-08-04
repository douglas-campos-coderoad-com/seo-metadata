# API Contract: Curated Catalog Discovery & Dealer Inquiry

**Date**: 2026-08-04 | **Phase**: 1 (Design) | **Framework**: FastAPI + Pydantic v2 + OpenAPI

## Overview

This document defines the REST API contract for the InCollect marketplace. The API is organized by functional area (Browse/Discovery, Authentication, Inquiry, Admin). All requests use JSON. Authentication uses JWT tokens in the Authorization header (`Bearer <token>`). This contract is auto-generated from FastAPI Pydantic models into OpenAPI schema (`/openapi.json`), which generates the TypeScript client in `packages/api-client`.

## Base URL

```
http://localhost:8000/api/v1  (development)
https://api.incollect.com/api/v1 (production)
```

## Authentication

All endpoints except those explicitly marked `[Public]` require JWT authentication.

**Header**: `Authorization: Bearer <jwt_token>`

JWT tokens are issued on login (POST /auth/login) and have the following claims:
- `sub`: User ID (UUID)
- `email`: User email
- `is_admin`: Boolean (curator/admin flag)
- `exp`: Expiration timestamp
- `iat`: Issued at timestamp

---

## Endpoints by Functional Area

### A. PUBLIC API — Browse & Discovery (P1)

Public endpoints for browsing items and filtering. No authentication required.

#### GET /items [Public]

List curated items with optional filtering by category and period.

**Query Parameters**:
- `category_id` (optional, UUID): Filter by category ID
- `period_id` (optional, UUID): Filter by period ID
- `skip` (optional, int, default=0): Pagination offset
- `limit` (optional, int, default=20, max=100): Page size
- `status` (optional, string, default='available'): Item status filter (available|sold|removed, admin-only for non-available)

**Response** (200 OK):
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "category_id": "uuid",
      "period_id": "uuid",
      "dealer_id": "uuid",
      "dealer_name": "string",  // Denormalized for convenience
      "image_urls": ["string"],
      "condition": "Excellent|Good|Fair|Poor|null",
      "asking_price": "decimal|null",
      "status": "available|sold|removed",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "total": int,
  "skip": int,
  "limit": int
}
```

**Status Codes**:
- 200: Success
- 400: Invalid query parameters (bad UUID, limit > 100)
- 500: Server error

**Notes**:
- If status filter is non-'available', requires admin authentication
- Pagination uses offset/limit (not cursor-based in MVP)
- Supports combining category + period filters (AND logic)

---

#### GET /items/:id [Public]

Get detailed information about a single item.

**Path Parameters**:
- `id` (UUID): Item ID

**Response** (200 OK):
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "category_id": "uuid",
  "category_name": "string",  // Joined from Category
  "period_id": "uuid",
  "period_name": "string",    // Joined from Period
  "dealer_id": "uuid",
  "dealer_name": "string",
  "dealer_email": "string",   // For inquiry form
  "dealer_inquiries_enabled": boolean,
  "image_urls": ["string"],
  "condition": "Excellent|Good|Fair|Poor|null",
  "asking_price": "decimal|null",
  "status": "available|sold|removed",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

**Status Codes**:
- 200: Success
- 404: Item not found
- 500: Server error

**Notes**:
- Public read endpoint; reveals dealer inquiries_enabled status
- If dealer_inquiries_enabled=False, frontend hides inquiry button

---

#### GET /categories [Public]

List all available categories.

**Response** (200 OK):
```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string|null"
    }
  ]
}
```

**Status Codes**:
- 200: Success

---

#### GET /periods [Public]

List all available periods.

**Response** (200 OK):
```json
{
  "periods": [
    {
      "id": "uuid",
      "name": "string",
      "start_year": int,
      "end_year": int
    }
  ]
}
```

**Status Codes**:
- 200: Success

---

### B. AUTHENTICATION (P2)

#### POST /auth/register [Public]

Register a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Validation**:
- `email`: Valid RFC 5322 format, must be unique
- `password`: Min 8 chars, min 1 uppercase, min 1 lowercase, min 1 digit, min 1 special char (!@#$%^&*)
- `name`: Non-empty, max 200 chars

**Response** (201 Created):
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "token": "string",  // JWT token
  "token_type": "bearer"
}
```

**Error Responses**:
- 400 Bad Request: Validation error (invalid email format, weak password, email taken, missing fields)
  ```json
  {
    "detail": "Email already registered" | "Password does not meet complexity requirements" | ...
  }
  ```
- 500 Internal Server Error: Unexpected error

**Notes**:
- Password hashed with bcrypt (cost=12) before storage
- User is created with is_admin=False (curator flag not auto-set)
- Token is issued immediately after registration

---

#### POST /auth/login [Public]

Sign in with email and password.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "is_admin": boolean,
  "token": "string",  // JWT token
  "token_type": "bearer"
}
```

**Error Responses**:
- 401 Unauthorized: Invalid credentials
  ```json
  {
    "detail": "Invalid email or password"
  }
  ```
- 500 Internal Server Error

**Notes**:
- Password compared against bcrypt hash
- Token issued with user claims (id, email, is_admin, exp, iat)
- last_sign_in updated in database

---

### C. INQUIRIES (P3)

All inquiry endpoints require JWT authentication.

#### POST /inquiries [Authenticated]

Submit a new inquiry about an item to its dealer.

**Request Body**:
```json
{
  "item_id": "uuid",
  "message": "I'm very interested in this item. Can you provide more details about its provenance?"
}
```

**Validation**:
- `item_id`: Valid UUID, item must exist, status must be 'available'
- `message`: Non-empty, min 5 chars, max 5000 chars
- User must be authenticated (JWT token required)
- Dealer must have `inquiries_enabled=True`

**Response** (201 Created):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "item_id": "uuid",
  "dealer_id": "uuid",
  "message": "string",
  "status": "pending",
  "email_sent": boolean,
  "email_sent_at": "ISO8601|null",
  "created_at": "ISO8601"
}
```

**Error Responses**:
- 401 Unauthorized: Not authenticated
- 400 Bad Request: Validation error
  ```json
  {
    "detail": "Item not found" | "Dealer has disabled inquiries" | "Message is required" | "Item is not available"
  }
  ```
- 409 Conflict: Duplicate inquiry (same user, same item within 24 hours)
  ```json
  {
    "detail": "You have already sent an inquiry for this item. Please wait before sending another."
  }
  ```
- 500 Internal Server Error

**Side Effects**:
- Inquiry created in database
- Email sent to dealer (if SMTP configured)
- email_sent=True on successful send; error logged if send fails

**Notes**:
- Duplication check: Prevent multiple pending inquiries from same user for same item within 24 hours
- Item status must be 'available' (not sold or removed)
- Dealer inquiries_enabled flag must be True

---

#### GET /inquiries [Authenticated]

List inquiries (different endpoints for users vs. dealers vs. admins).

**Query Parameters**:
- `type` (optional, string): 'sent' | 'received' (default: 'sent' for users, 'received' for dealers/admins)

**User Response** (200 OK) — `type='sent'`:
```json
{
  "inquiries": [
    {
      "id": "uuid",
      "item_id": "uuid",
      "item_title": "string",
      "dealer_id": "uuid",
      "dealer_name": "string",
      "status": "pending|responded|resolved",
      "created_at": "ISO8601"
    }
  ]
}
```

**Dealer/Admin Response** (200 OK) — `type='received'`:
```json
{
  "inquiries": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "user_email": "string",
      "user_name": "string",
      "item_id": "uuid",
      "item_title": "string",
      "message": "string",
      "status": "pending|responded|resolved",
      "created_at": "ISO8601"
    }
  ]
}
```

**Status Codes**:
- 200: Success
- 401: Not authenticated
- 403: Forbidden (dealer can only see own inquiries, user can only see sent inquiries)

---

### D. ADMIN/CURATOR INTERFACE

All admin endpoints require JWT authentication with `is_admin=True`.

#### POST /admin/items [Admin]

Create a new item in the catalog.

**Request Body**:
```json
{
  "title": "string (max 255)",
  "description": "string (max 5000)",
  "category_id": "uuid",
  "period_id": "uuid",
  "dealer_id": "uuid",
  "image_urls": ["string (valid URLs)"],
  "condition": "Excellent|Good|Fair|Poor|null",
  "asking_price": "decimal|null",
  "status": "available|sold|removed"
}
```

**Validation**:
- All required fields present and valid
- category_id, period_id, dealer_id must exist
- image_urls must be valid URLs (at least one)
- condition and status are constrained enums
- Only users with is_admin=True can create

**Response** (201 Created):
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "category_id": "uuid",
  "period_id": "uuid",
  "dealer_id": "uuid",
  "image_urls": ["string"],
  "condition": "string|null",
  "asking_price": "decimal|null",
  "status": "available|sold|removed",
  "created_at": "ISO8601"
}
```

**Status Codes**:
- 201: Created
- 401: Not authenticated
- 403: Not admin
- 400: Validation error
- 500: Server error

---

#### PATCH /admin/items/:id [Admin]

Update an existing item.

**Path Parameters**:
- `id` (UUID): Item ID

**Request Body** (all optional):
```json
{
  "title": "string",
  "description": "string",
  "category_id": "uuid",
  "period_id": "uuid",
  "condition": "Excellent|Good|Fair|Poor|null",
  "asking_price": "decimal|null",
  "image_urls": ["string"],
  "status": "available|sold|removed"
}
```

**Response** (200 OK): Updated item (same schema as POST response)

**Status Codes**:
- 200: Success
- 401: Not authenticated
- 403: Not admin
- 404: Item not found
- 400: Validation error
- 500: Server error

---

#### GET /admin/dealers [Admin]

List all dealers (for admin/curator management).

**Response** (200 OK):
```json
{
  "dealers": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "contact_info": "string|null",
      "inquiries_enabled": boolean,
      "created_at": "ISO8601"
    }
  ]
}
```

---

#### PATCH /admin/dealers/:id [Admin]

Update dealer profile (e.g., set inquiries_enabled flag).

**Request Body**:
```json
{
  "name": "string|null",
  "contact_info": "string|null",
  "inquiries_enabled": "boolean|null"
}
```

**Response** (200 OK): Updated dealer

---

#### POST /admin/categories [Admin]

Create a new category.

**Request Body**:
```json
{
  "name": "string (unique, max 100)",
  "description": "string|null"
}
```

**Response** (201 Created)

---

#### POST /admin/periods [Admin]

Create a new period.

**Request Body**:
```json
{
  "name": "string (unique)",
  "start_year": int,
  "end_year": int
}
```

**Response** (201 Created)

---

### E. HEALTH & DIAGNOSTICS

#### GET /health [Public]

Service health check.

**Response** (200 OK):
```json
{
  "status": "ok",
  "version": "string",
  "timestamp": "ISO8601"
}
```

---

## Response Headers

All endpoints return:
- `Content-Type: application/json`
- `X-Request-ID`: Correlation ID for logging/tracing
- `X-RateLimit-Limit`: Rate limit (if enforced)
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp

---

## Error Handling

All error responses follow this schema:

```json
{
  "detail": "string",
  "status_code": int,
  "timestamp": "ISO8601"
}
```

**Common Status Codes**:
- 200: OK
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized (missing/invalid JWT token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 409: Conflict (duplicate inquiry)
- 500: Internal Server Error

---

## Pagination

Endpoints that return lists support offset-based pagination:

**Query Parameters**:
- `skip` (int, default=0): Number of items to skip
- `limit` (int, default=20, max=100): Number of items to return

**Response**:
```json
{
  "items": [...],
  "total": int,
  "skip": int,
  "limit": int
}
```

---

## Rate Limiting

Not implemented in MVP. To be added in v2 based on usage patterns.

---

## Versioning

Current version: v1 (in URL path: `/api/v1`)

Breaking changes will increment version number. Clients must specify version in path.

---

## OpenAPI / Swagger

The FastAPI application auto-generates OpenAPI schema:

**Endpoints**:
- `GET /openapi.json` — Full OpenAPI 3.0 schema (used by client generator)
- `GET /docs` — Swagger UI (interactive API explorer)
- `GET /redoc` — ReDoc documentation

---

## Notes for Client Generation

The TypeScript client is generated from `/openapi.json` using `openapi-typescript` (or similar):

1. Backend defines all endpoints with Pydantic request/response models
2. FastAPI generates `/openapi.json` automatically
3. CI runs: `openapi-typescript /api/v1/openapi.json -o packages/api-client/src/types.ts`
4. Client types are guaranteed to match backend models
5. If endpoint schema changes, CI regeneration fails and alerts the team
6. Frontend imports from `packages/api-client` and uses generated types

This ensures contract-first design: backend schema is single source of truth.
