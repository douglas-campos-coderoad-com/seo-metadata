# Data Model: Curated Catalog Discovery & Dealer Inquiry

**Date**: 2026-08-04 | **Phase**: 1 (Design) | **Technology**: SQLAlchemy 2.x + PostgreSQL

## Overview

Six core entities model the marketplace: **Item**, **Category**, **Period**, **User**, **Dealer**, and **Inquiry**. The data model supports browsing and filtering (P1), user authentication (P2), and dealer inquiry routing (P3).

## Entity Definitions

### 1. Category

Represents item type/category.

**Attributes**:
- `id` (UUID, Primary Key): Unique identifier
- `name` (String, 100 chars, Unique): "Furniture", "Fine Art", "Antiques", "Decorative Objects", "Jewelry"
- `description` (Text, optional): User-facing category description
- `created_at` (DateTime): Timestamp of creation
- `updated_at` (DateTime): Timestamp of last update

**Relationships**:
- One-to-Many: Has many Items

**Constraints**:
- `name` must be unique (prevents duplicate categories)
- `name` is immutable (soft immutability enforced in API)

**Notes**: Pre-populated by administrators; categories rarely change.

---

### 2. Period

Represents time period for antiques/art.

**Attributes**:
- `id` (UUID, Primary Key): Unique identifier
- `name` (String, 50 chars, Unique): "18th Century", "19th Century", "20th Century", "21st Century"
- `start_year` (Integer): Start year (e.g., 1700)
- `end_year` (Integer): End year (e.g., 1799)
- `created_at` (DateTime): Timestamp of creation
- `updated_at` (DateTime): Timestamp of last update

**Relationships**:
- One-to-Many: Has many Items

**Constraints**:
- `name` must be unique
- `start_year < end_year`

**Notes**: Pre-populated; represents historical eras.

---

### 3. Dealer

Represents a merchant/seller.

**Attributes**:
- `id` (UUID, Primary Key): Unique identifier
- `name` (String, 200 chars): Dealer business name
- `email` (String, 255 chars, Unique, Indexed): Contact email for inquiries
- `contact_info` (Text, optional): Phone, address, or additional contact details
- `inquiries_enabled` (Boolean, Default: True): Can receive inquiries
- `created_at` (DateTime): Timestamp of creation
- `updated_at` (DateTime): Timestamp of last update

**Relationships**:
- One-to-Many: Lists many Items
- One-to-Many: Receives many Inquiries

**Constraints**:
- `email` is unique and indexed (for inquiry routing)
- `email` follows RFC 5322 format

**State Transitions**:
- `inquiries_enabled`: True → False (admin action to disable inquiries)
- `inquiries_enabled`: False → True (admin action to re-enable)

**Notes**: Pre-registered by administrators. Email is authoritative contact for inquiry notifications.

---

### 4. Item

Represents a curated marketplace listing.

**Attributes**:
- `id` (UUID, Primary Key): Unique identifier
- `title` (String, 255 chars): Item name/title
- `description` (Text): Detailed item description
- `category_id` (UUID, Foreign Key → Category): Item category
- `period_id` (UUID, Foreign Key → Period): Time period
- `dealer_id` (UUID, Foreign Key → Dealer): Dealer listing the item
- `image_urls` (Text Array or JSON): URLs to item images (external hosting)
- `condition` (Enum: 'Excellent', 'Good', 'Fair', 'Poor', optional): Estimated item condition
- `asking_price` (Decimal, optional): Asking price or valuation
- `status` (Enum: 'available', 'sold', 'removed', Default: 'available'): Item availability status
- `created_at` (DateTime): Timestamp of creation
- `updated_at` (DateTime): Timestamp of last update

**Relationships**:
- Many-to-One: Belongs to one Category
- Many-to-One: Belongs to one Period
- Many-to-One: Listed by one Dealer
- One-to-Many: Subject of many Inquiries

**Constraints**:
- `title` and `description` are required, non-empty
- `category_id`, `period_id`, `dealer_id` are required (no null foreign keys)
- `image_urls` is at least one image (checked on create/update)
- `condition` values are constrained to predefined enum
- `status` values are constrained to predefined enum
- Soft delete: `status='removed'` instead of hard delete (preserves inquiry history)

**Indexes**:
- `(category_id, period_id)`: Optimize filtering by category + period
- `dealer_id`: Optimize queries by dealer
- `status`: Optimize filtering available items

**Lifecycle**:
1. Created by curator via admin interface (status='available')
2. Optionally updated (condition, asking_price, images)
3. Marked as sold or removed (status='sold'|'removed')
4. Inquiries remain associated even after status change

**Notes**: Images hosted externally; only URLs stored in database.

---

### 5. User

Represents a registered user account.

**Attributes**:
- `id` (UUID, Primary Key): Unique identifier
- `email` (String, 255 chars, Unique, Indexed): User email address
- `password_hash` (String, 255 chars): Hashed password (bcrypt)
- `name` (String, 200 chars): User full name
- `created_at` (DateTime): Timestamp of account creation
- `last_sign_in` (DateTime, optional): Last login timestamp
- `is_admin` (Boolean, Default: False): Admin/curator privilege flag

**Relationships**:
- One-to-Many: Created many Inquiries

**Constraints**:
- `email` is unique and indexed (for login)
- `email` follows RFC 5322 format
- `password_hash` never null, must be bcrypt hashed (minimum 12 rounds)
- `name` is required, non-empty
- `is_admin` is Boolean; curators have this flag set to True

**Password Requirements** (enforced in API):
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character (!@#$%^&*)

**Lifecycle**:
1. User registers (email + password) → User created with is_admin=False
2. User signs in → last_sign_in updated
3. User signs out → no database change
4. Admin can set is_admin=True for curator accounts

**Notes**: is_admin flag gates access to curator dashboard and admin API endpoints.

---

### 6. Inquiry

Represents a customer inquiry about an item.

**Attributes**:
- `id` (UUID, Primary Key): Unique identifier
- `user_id` (UUID, Foreign Key → User): User who sent the inquiry
- `item_id` (UUID, Foreign Key → Item): Item being inquired about
- `dealer_id` (UUID, Foreign Key → Dealer): Dealer receiving the inquiry (denormalized for clarity)
- `message` (Text): Customer's inquiry message
- `status` (Enum: 'pending', 'responded', 'resolved', Default: 'pending'): Inquiry status
- `email_sent` (Boolean, Default: False): Track if notification email was sent
- `email_sent_at` (DateTime, optional): Timestamp of email send
- `created_at` (DateTime): Timestamp of inquiry submission
- `updated_at` (DateTime): Timestamp of last update

**Relationships**:
- Many-to-One: Created by one User
- Many-to-One: About one Item
- Many-to-One: Routed to one Dealer

**Constraints**:
- `message` is required, non-empty, min 5 characters, max 5000 characters
- `user_id`, `item_id`, `dealer_id` are required
- `email_sent` defaults to False; set to True after successful email delivery
- `status` is constrained to enum values

**Indexes**:
- `dealer_id`: Query inquiries for a dealer
- `user_id`: Query user's sent inquiries
- `(item_id, user_id)`: Check for duplicate inquiries

**Lifecycle**:
1. User submits inquiry form → Inquiry created with status='pending', email_sent=False
2. System sends dealer email → email_sent=True, email_sent_at updated
3. Dealer responds (off-platform) → status may be manually updated by dealer or admin
4. Inquiry marked resolved → status='resolved'

**Duplication Prevention**:
- Check on submit: Prevent multiple pending inquiries from same user for same item within 24 hours (business rule, enforced in service layer)

**Retention**:
- Inquiries are never deleted, even if item is removed or user unregisters (preserves history for dealers)

**Email Content** (format specification):
```
Subject: [InCollect] New Inquiry for "[Item Title]"

Hello [Dealer Name],

[Customer Name] has sent you an inquiry about the following item:

Item: [Item Title]
Category: [Category Name]
Period: [Period Name]
Condition: [Condition, if available]
Asking Price: [Price, if available]

Customer's Message:
---
[Inquiry Message]
---

Customer Contact:
Email: [Customer Email]
Name: [Customer Name]

To respond, please contact the customer directly at the email address above.
This is a dealer inquiry platform; InCollect does not facilitate transactions.

Best regards,
InCollect Team
```

---

## Validation Rules

### Email Validation
- Backend: Pydantic EmailStr validator
- Frontend: HTML5 email input + Pydantic validation rules mirror (email format regex)

### Password Validation
- Backend: Custom validator in Pydantic model
- Frontend: Real-time validation with feedback (must meet all 5 requirements)

### Item Fields
- `title`: Non-empty, max 255 chars
- `description`: Non-empty, max 5000 chars
- `condition`: Enum, optional
- `asking_price`: Non-negative decimal, optional
- `image_urls`: At least one valid URL

### Inquiry Message
- Non-empty, min 5 chars, max 5000 chars

---

## State Transitions & Workflows

### User Registration & Sign-In
```
Unauthenticated User
  → Fill registration form (email, password, name)
  → System validates (email format, password strength, email uniqueness)
  → User created with is_admin=False
  → JWT token issued
  → User is now Authenticated
```

### Item Discovery
```
Unauthenticated or Authenticated User
  → View marketplace (GET /items)
  → Apply filters: category_id, period_id (GET /items?category_id=...&period_id=...)
  → View item detail (GET /items/:id)
  → (If authenticated and dealer.inquiries_enabled) → See "Send Inquiry" button
```

### Inquiry Submission
```
Authenticated User viewing Item with inquiries_enabled=True
  → Click "Send Inquiry"
  → Fill inquiry form (message)
  → System validates (message length, user auth, item exists, dealer.inquiries_enabled)
  → Inquiry created (status='pending', email_sent=False)
  → System sends email to dealer (email_sent=True, email_sent_at=now)
  → User sees confirmation message
```

### Admin/Curator Dashboard
```
User with is_admin=True
  → Access admin panel (/admin)
  → View, create, edit items (CRUD)
  → Manage categories and periods
  → Manage dealer profiles (set inquiries_enabled)
  → View inquiries received by dealers
```

---

## ER Diagram (Text Representation)

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Category  │       │    Period    │       │   Dealer    │
├─────────────┤       ├──────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)      │       │ id (PK)     │
│ name        │       │ name         │       │ name        │
│ description │       │ start_year   │       │ email       │
│             │       │ end_year     │       │ contact_info│
│             │       │              │       │ inquiries_en│
└─────────────┘       └──────────────┘       └─────────────┘
      ▲                     ▲                        ▲
      │                     │                        │
      │ 1                   │ 1                      │ 1
      │                     │                        │
      │ N                   │ N                      │ N
      │                     │                        │
   ┌──┴────────────────────┴────────────────────────┴──┐
   │               Item                                │
   ├───────────────────────────────────────────────────┤
   │ id (PK)                                           │
   │ title                                             │
   │ description                                       │
   │ category_id (FK)                                  │
   │ period_id (FK)                                    │
   │ dealer_id (FK)                                    │
   │ image_urls                                        │
   │ condition                                         │
   │ asking_price                                      │
   │ status (available|sold|removed)                   │
   │ created_at                                        │
   └───────────────────────────────────────────────────┘
      ▲
      │ 1
      │
      │ N
      │
   ┌──┴─────────────┐
   │   Inquiry      │
   ├────────────────┤
   │ id (PK)        │
   │ user_id (FK)   │ ──────┐
   │ item_id (FK)   │       │
   │ dealer_id (FK)─┼─┐     │
   │ message        │ │     │
   │ status         │ │     │
   │ email_sent     │ │     │
   │ created_at     │ │     │
   └────────────────┘ │     │
                      │     │
                   Dealer   User
                      │     │
                      └─┬───┘
                        │
                   ┌────┴────┐
                   │ (1..N)   │
                   └──────────┘
```

---

## Database Initialization & Seeding

### Migrations (Alembic)
- Initial migration: Create all tables with constraints and indexes
- Seed migration: Pre-populate Categories (5) and Periods (4)

### Seeding
```sql
-- Categories (pre-populated)
INSERT INTO categories (id, name, description) VALUES
  ('cat-furniture', 'Furniture', 'Furniture from various periods'),
  ('cat-fine-art', 'Fine Art', 'Paintings, sculptures, and fine art'),
  ('cat-antiques', 'Antiques', 'Antique objects and collectibles'),
  ('cat-decorative', 'Decorative Objects', 'Decorative and functional objects'),
  ('cat-jewelry', 'Jewelry', 'Jewelry and personal adornments');

-- Periods (pre-populated)
INSERT INTO periods (id, name, start_year, end_year) VALUES
  ('per-18', '18th Century', 1700, 1799),
  ('per-19', '19th Century', 1800, 1899),
  ('per-20', '20th Century', 1900, 1999),
  ('per-21', '21st Century', 2000, 2099);
```

---

## Notes & Assumptions

- **Soft Deletes**: Items use `status='removed'` instead of hard delete to preserve inquiry history
- **Immutable Created_At**: `created_at` is set once and never updated
- **Dealer Email as Contact**: Dealer email is the authoritative contact; phone/address optional
- **Image Hosting**: External URLs only; no file uploads in v1
- **Inquiry Durability**: Inquiries are never deleted, even if item/user is removed
- **Password Hashing**: bcrypt with cost=12 (minimum)
- **Session State**: Stateless (JWT); no server-side session storage
- **Concurrent Users**: PostgreSQL handles concurrent access; no special locking needed for this MVP
