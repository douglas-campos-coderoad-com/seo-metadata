# Quickstart & Validation: Curated Catalog Discovery & Dealer Inquiry

**Date**: 2026-08-04 | **Phase**: 1 (Design) | **Purpose**: End-to-end feature validation

This document describes runnable validation scenarios that prove the feature works end-to-end. Each scenario maps to one of the three user stories (P1, P2, P3) and includes prerequisites, setup commands, test commands, and expected outcomes.

## Prerequisites

1. **Local Development Stack Running**:
   - PostgreSQL running (via Docker Compose)
   - FastAPI backend running (`make dev` or `python -m uvicorn ...`)
   - Next.js frontend running (`npm run dev`)
   - Both accessible locally (backend: `http://localhost:8000`, frontend: `http://localhost:3000`)

2. **Seeded Database**:
   - Categories table populated with 5 categories (Furniture, Fine Art, Antiques, Decorative Objects, Jewelry)
   - Periods table populated with 4 periods (18th, 19th, 20th, 21st Century)
   - At least 2 dealers in Dealers table with emails configured
   - At least 10 items in Items table across multiple categories/periods

3. **Test Utilities**:
   - `curl` or Postman for manual API testing
   - Browser with DevTools for frontend validation
   - Email mock service (e.g., MailHog) for dealer notification testing (optional, for detailed validation)

---

## Scenario 1: Browse & Filter (P1 — Core Discovery)

**User Story**: Visitors browse the marketplace, apply filters by category and period, and view item details.

**Acceptance Criteria** (from spec):
- Default item listing shows curated catalog
- Category filter updates results
- Period filter updates results
- Combined filters (category AND period) work
- Item detail page loads with full information
- Filter reset returns full catalog

### Test Steps

#### 1a. Setup

```bash
# Ensure DB is seeded
docker-compose exec postgres psql -U incollect -d incollect_dev -c \
  "INSERT INTO categories VALUES (uuid_generate_v4(), 'Furniture', 'Furniture items');
   INSERT INTO periods VALUES (uuid_generate_v4(), '18th Century', 1700, 1799);
   INSERT INTO dealers VALUES (uuid_generate_v4(), 'Antique Dealer Co', 'dealer@example.com', null, true);
   INSERT INTO items VALUES (uuid_generate_v4(), 'Victorian Chair', 'A fine Victorian chair...', 
     (SELECT id FROM categories LIMIT 1), (SELECT id FROM periods LIMIT 1), 
     (SELECT id FROM dealers LIMIT 1), ARRAY['https://example.com/chair.jpg'], 'Excellent', 1500.00, 'available');"

# Start services
make dev
```

#### 1b. Test: Default Catalog

**Test**: Navigate to `http://localhost:3000/browse`

**Expected Outcome**:
- Page loads in < 1.5 seconds (measure with DevTools)
- Catalog displays grid of items (at least 10 items visible)
- Items show: image, title, dealer name, category, period

**Validation Command**:
```bash
# API call to verify data
curl -s "http://localhost:8000/api/v1/items?limit=10" | jq '.items | length'
# Expected: 10 or more items
```

#### 1c. Test: Category Filter

**Test**: 
1. Click "Furniture" category filter on browse page
2. Observe catalog updates

**Expected Outcome**:
- Only items with category="Furniture" displayed
- Filter UI shows "Furniture" as active
- Total item count updates

**Validation Command**:
```bash
CATEGORY_ID=$(curl -s "http://localhost:8000/api/v1/categories" | jq -r '.categories[0].id')
curl -s "http://localhost:8000/api/v1/items?category_id=$CATEGORY_ID" | jq '.items[].category_id' | sort -u
# Expected: All items have same category_id
```

#### 1d. Test: Period Filter

**Test**:
1. Clear category filter
2. Click "18th Century" period filter
3. Observe catalog updates

**Expected Outcome**:
- Only items with period="18th Century" displayed

#### 1e. Test: Combined Filters (Category AND Period)

**Test**:
1. Select category="Furniture" AND period="18th Century"
2. Observe results

**Expected Outcome**:
- Only items matching BOTH criteria displayed

#### 1f. Test: Item Detail Page

**Test**:
1. From filtered results, click an item
2. Navigate to `/browse/[itemId]`

**Expected Outcome**:
- Page loads in < 1.5 seconds
- Displays: title, description, images, category, period, dealer name, condition, asking price
- If dealer.inquiries_enabled=true, "Send Inquiry" button visible
- If dealer.inquiries_enabled=false, "Contact dealer directly" message shown

**Validation Command**:
```bash
ITEM_ID=$(curl -s "http://localhost:8000/api/v1/items?limit=1" | jq -r '.items[0].id')
curl -s "http://localhost:8000/api/v1/items/$ITEM_ID" | jq '.title, .description, .dealer_inquiries_enabled'
```

#### 1g. Test: Clear Filters

**Test**:
1. On browse page with filters applied, click "Clear Filters"

**Expected Outcome**:
- All items reappear
- Filter controls reset to no selection
- Catalog shows full inventory again

---

## Scenario 2: Register & Sign In (P2 — Authentication)

**User Story**: Visitors register with email/password and sign in.

**Acceptance Criteria** (from spec):
- Registration form displays
- Valid registration creates account and signs user in
- Invalid email format prevented
- Weak password prevented
- Duplicate email prevented
- Sign out works
- Sign in with valid credentials works

### Test Steps

#### 2a. Setup

No additional setup needed. API and frontend running.

#### 2b. Test: Registration Form

**Test**:
1. Navigate to `http://localhost:3000/auth/register`

**Expected Outcome**:
- Form displays with fields: email, password, name
- Password field shows complexity requirements (8+ chars, uppercase, lowercase, digit, special char)
- Submit button disabled until all fields valid

#### 2c. Test: Valid Registration

**Test**:
1. Enter: email=`testuser_001@example.com`, password=`SecurePass123!`, name=`Test User`
2. Click submit

**Expected Outcome**:
- User created in database
- User redirected to `/browse` (authenticated)
- JWT token stored locally
- User can now send inquiries

**Validation Command**:
```bash
curl -s -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser_001@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }' | jq '.token' | head -c 50
# Expected: JWT token (string starting with eyJ...)
```

#### 2d. Test: Invalid Email Format

**Test**:
1. Try to register with email=`invalid-email-format`

**Expected Outcome**:
- Form prevents submission (error message: "Invalid email format")
- No API call made

#### 2e. Test: Weak Password

**Test**:
1. Try to register with password=`weak`

**Expected Outcome**:
- Form prevents submission (error message listing missing requirements)
- No API call made

#### 2f. Test: Duplicate Email

**Test**:
1. Register first user (email=`unique@example.com`)
2. Try to register again with same email

**Expected Outcome**:
- API returns 400 error (Email already registered)
- Form displays error to user

**Validation Command**:
```bash
# First registration
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "duplicate@example.com", "password": "SecurePass123!", "name": "User 1"}'

# Second registration with same email (should fail)
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "duplicate@example.com", "password": "SecurePass123!", "name": "User 2"}' | jq '.detail'
# Expected: "Email already registered"
```

#### 2g. Test: Sign Out

**Test**:
1. Sign in (as testuser_001@example.com)
2. Click "Sign Out" button
3. Attempt to access `/inquiries` (protected page)

**Expected Outcome**:
- Token cleared from storage
- Redirected to sign-in page
- Cannot access protected routes

#### 2h. Test: Sign In with Valid Credentials

**Test**:
1. Navigate to `http://localhost:3000/auth/login`
2. Enter email and password
3. Click submit

**Expected Outcome**:
- JWT token issued
- User authenticated
- Redirected to marketplace
- Can now send inquiries

**Validation Command**:
```bash
curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser_001@example.com", "password": "SecurePass123!"}' | jq '.token' | head -c 50
```

#### 2i. Test: Sign In with Invalid Credentials

**Test**:
1. Enter valid email but wrong password

**Expected Outcome**:
- API returns 401 Unauthorized
- Form displays error: "Invalid email or password"

---

## Scenario 3: Send Dealer Inquiry (P3 — Transaction)

**User Story**: Authenticated user finds an item and sends an inquiry to the dealer.

**Acceptance Criteria** (from spec):
- Inquiry button visible on detail page (if dealer.inquiries_enabled=true)
- Inquiry form appears
- Empty message prevented
- Inquiry submitted, recorded, and confirmed
- Unauthenticated user prompted to sign in
- Dealer receives email notification

### Test Steps

#### 3a. Setup

```bash
# Ensure authenticated user from Scenario 2 is available
# Ensure at least one item with dealer.inquiries_enabled=true exists
curl -s "http://localhost:8000/api/v1/items?limit=1" | jq '.items[0].dealer_inquiries_enabled'
# Expected: true
```

#### 3b. Test: Inquiry Button Visibility

**Test**:
1. Authenticated user navigates to item detail page
2. Observe "Send Inquiry" button

**Expected Outcome**:
- "Send Inquiry" button visible (if dealer.inquiries_enabled=true)
- Button disabled if user is not authenticated
- "Contact dealer directly" message shown if dealer.inquiries_enabled=false

#### 3c. Test: Inquiry Form

**Test**:
1. Click "Send Inquiry" button
2. Observe form

**Expected Outcome**:
- Modal or page appears with form
- Form has text area for message
- Submit button initially disabled (until message entered)

#### 3d. Test: Empty Message Prevention

**Test**:
1. Leave message empty
2. Try to submit

**Expected Outcome**:
- Form prevents submission (error: "Message is required")
- No API call made

#### 3e. Test: Valid Inquiry Submission

**Test**:
1. Enter message: "I'm very interested in this item. Can you tell me more about its provenance?"
2. Click submit

**Expected Outcome**:
- Inquiry submitted to API
- User sees confirmation: "Inquiry sent! The dealer will contact you at [email]"
- Inquiry appears in user's inquiry history (/inquiries)

**Validation Command**:
```bash
# Get JWT token (from sign in)
TOKEN=$(curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser_001@example.com", "password": "SecurePass123!"}' | jq -r '.token')

# Get first item
ITEM_ID=$(curl -s "http://localhost:8000/api/v1/items?limit=1" | jq -r '.items[0].id')

# Submit inquiry
curl -s -X POST "http://localhost:8000/api/v1/inquiries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"item_id\": \"$ITEM_ID\", \"message\": \"I'm interested in this item.\"}" | jq '.status'
# Expected: "pending"
```

#### 3f. Test: Duplicate Inquiry Prevention

**Test**:
1. Submit inquiry for same item twice within 24 hours

**Expected Outcome**:
- Second submission returns 409 Conflict
- Error message: "You have already sent an inquiry for this item. Please wait before sending another."

#### 3g. Test: Unauthenticated User Inquiry Attempt

**Test**:
1. Sign out
2. Navigate to item detail page
3. Try to click "Send Inquiry"

**Expected Outcome**:
- Button disabled or click redirects to sign-in page
- Form does not appear for unauthenticated user

#### 3h. Test: Dealer Notification Email

**Test**:
1. Submit inquiry (from 3e)
2. Check dealer email inbox

**Expected Outcome**:
- Dealer receives email with subject: "[InCollect] New Inquiry for '[Item Title]'"
- Email contains:
  - Item details (title, category, period, condition, asking price)
  - Customer contact info (name, email)
  - Inquiry message
  - "Contact customer directly" instruction

**Validation Command** (if using MailHog):
```bash
# Check MailHog API for latest email
curl -s "http://localhost:1025/api/v2/messages?limit=1" | jq '.items[0].Raw.Data' | head -c 500
# Expected: Email containing item title and customer message
```

#### 3i. Test: Dealer with Inquiries Disabled

**Test**:
1. Admin disables inquiries for a dealer (PATCH /admin/dealers/:id with inquiries_enabled=false)
2. User navigates to item listed by that dealer
3. Attempts to send inquiry

**Expected Outcome**:
- Item detail page shows "Contact dealer directly" message
- No inquiry form appears
- API rejects POST /inquiries with 400: "Dealer has disabled inquiries"

---

## Scenario 4: Admin/Curator Interface (Support for All Scenarios)

**User Story**: Admin/curator can manage items, categories, dealers, and item status.

**Acceptance Criteria**:
- Admin can create items
- Admin can edit items
- Admin can manage dealer profiles
- Admin can manage categories and periods
- Admin can set dealer inquiries_enabled flag

### Test Steps

#### 4a. Setup

```bash
# Create admin user (set is_admin=true manually in DB or via admin endpoint)
# or use admin credentials if pre-created
```

#### 4b. Test: Create Item (Admin)

**Test**:
1. Admin navigates to `/admin/items`
2. Clicks "New Item"
3. Fills form with item details
4. Submits

**Expected Outcome**:
- Item created in database with status='available'
- Immediately visible in public marketplace
- Item appears in browse results

**Validation Command**:
```bash
# Admin token (assuming admin user exists)
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "AdminPass123!"}' | jq -r '.token')

# Create item
curl -s -X POST "http://localhost:8000/api/v1/admin/items" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Antique Mahogany Desk",
    "description": "Beautiful 19th-century desk",
    "category_id": "[uuid]",
    "period_id": "[uuid]",
    "dealer_id": "[uuid]",
    "image_urls": ["https://example.com/desk.jpg"],
    "condition": "Good",
    "asking_price": 2500.00,
    "status": "available"
  }' | jq '.id'
# Expected: UUID of created item
```

#### 4c. Test: Edit Item (Admin)

**Test**:
1. Admin navigates to item edit page
2. Changes status to 'sold'
3. Submits

**Expected Outcome**:
- Item status updated to 'sold'
- Item no longer appears in public browse (or marked as sold)
- No new inquiries can be sent for this item

#### 4d. Test: Disable Dealer Inquiries (Admin)

**Test**:
1. Admin navigates to `/admin/dealers`
2. Selects a dealer
3. Toggles `inquiries_enabled` to false
4. Saves

**Expected Outcome**:
- Dealer's `inquiries_enabled` flag set to false
- All items by this dealer show "Contact dealer directly"
- Users cannot send inquiries to this dealer's items

---

## Summary: Expected Outcomes

| Scenario | Expected Result | Validation |
|----------|-----------------|------------|
| P1: Browse & Filter | Items display, filters work, details load | 10+ items visible, filter updates results < 10s |
| P2: Auth | User registration/login works, tokens issued | JWT token issued, user authenticated, password validated |
| P3: Inquiry | Inquiry submitted, email sent, dealer notified | Inquiry recorded (status='pending'), email in inbox |
| Admin | Items created, status managed, dealer settings updated | CRUD operations on items/dealers work, inquiries_enabled toggles |

---

## Performance Validation

Run the following checks to validate success criteria:

```bash
# SC-001: Filters within 10 seconds
time curl -s "http://localhost:8000/api/v1/items?category_id=[uuid]&period_id=[uuid]" > /dev/null
# Expected: < 10 seconds

# SC-005: Item detail page < 1.5 seconds
time curl -s "http://localhost:8000/api/v1/items/[uuid]" > /dev/null
# Expected: < 1.5 seconds

# SC-006: Support 500+ items without degradation
curl -s "http://localhost:8000/api/v1/items?limit=100" | jq '.total'
# Expected: >= 500
```

---

## Notes

- All times are measured on reference hardware (2 CPU cores, 4GB RAM)
- Email testing assumes MailHog running on localhost:1025
- Admin user must have is_admin=True flag in database
- JWT tokens expire after configured time (typically 24 hours in dev)
- Each test is independent; can be run in any order
