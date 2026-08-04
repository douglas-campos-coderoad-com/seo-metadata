# Feature Specification: Curated Catalog Discovery & Dealer Inquiry

**Feature Branch**: `001-catalog-discovery`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "Curated Catalog Discovery & Dealer Inquiry: visitors browse a curated marketplace of high-end furniture, fine art, antiques, decorative objects, and jewelry (18th–21st century), filter by category and period, and open item detail pages; users register and sign in with email and password; signed-in users send an inquiry to an item's dealer. Commission-free — no on-platform checkout; the platform delivers a correctly attributed introduction to the dealer."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Curated Marketplace with Filters (Priority: P1)

Visitors arrive at the marketplace and browse a curated collection of high-end items (furniture, fine art, antiques, decorative objects, and jewelry spanning 18th–21st century). They filter items by category and period to discover items matching their interests, then open detailed item pages to learn more.

**Why this priority**: Browsing and discovery is the core value of the marketplace. Without this, no inquiry can happen. This is the critical path that attracts and engages visitors.

**Independent Test**: Can be fully tested by navigating to the marketplace, applying category and period filters, viewing search results, and opening an item detail page. Delivers discovery value independently.

**Acceptance Scenarios**:

1. **Given** a visitor opens the marketplace, **When** they view the default item listing, **Then** they see a curated catalog with at least items from multiple categories and periods
2. **Given** a visitor on the marketplace, **When** they apply a category filter (e.g., "Furniture"), **Then** the catalog updates to show only items in that category
3. **Given** a visitor on the marketplace, **When** they apply a period filter (e.g., "18th Century"), **Then** the catalog updates to show only items from that time period
4. **Given** a visitor, **When** they combine multiple filters (category AND period), **Then** the catalog shows only items matching both criteria
5. **Given** a visitor viewing filtered results, **When** they click an item, **Then** the item detail page loads showing full information (description, images, period, category, dealer attribution, estimated condition)
6. **Given** a visitor with active filters, **When** they clear filters, **Then** the full catalog reappears

---

### User Story 2 - User Registration & Sign In (Priority: P2)

Visitors can create an account with email and password, and existing users can sign in. Authentication is required to send inquiries to dealers.

**Why this priority**: Authentication unlocks the inquiry capability. This is foundational but secondary to discovery itself—users must first find items they care about before needing to authenticate.

**Independent Test**: Can be fully tested by completing registration (email + password), verifying account creation, signing out, and signing back in with credentials. Delivers authentication value independently.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** they initiate registration, **Then** they see a registration form requesting email and password
2. **Given** a visitor on the registration form, **When** they enter a valid email and password, **Then** their account is created and they are signed in
3. **Given** a visitor on the registration form, **When** they enter an invalid email format, **Then** validation feedback prevents form submission
4. **Given** a visitor on the registration form, **When** they enter a password below minimum complexity requirements, **Then** validation feedback prevents form submission
5. **Given** a visitor on the registration form, **When** they enter an email already in use, **Then** validation feedback indicates the email is taken
6. **Given** a signed-in user, **When** they sign out, **Then** they return to the unauthenticated state
7. **Given** a signed-out user, **When** they access the sign-in form and enter valid credentials, **Then** they are signed in

---

### User Story 3 - Send Dealer Inquiry (Priority: P3)

A signed-in user can send an inquiry about an item to its dealer. The inquiry creates a correctly attributed introduction, introducing the customer to the dealer without exposing either party's details unless they consent.

**Why this priority**: This monetizes discovery and authentication. Users finding items is most critical; the inquiry conversion follows only after they've found something interesting.

**Independent Test**: Can be fully tested by signing in, navigating to an item detail page, and submitting an inquiry form. The system must deliver a correctly attributed introduction to the dealer. Delivers transaction capability independently.

**Acceptance Scenarios**:

1. **Given** a signed-in user viewing an item detail page, **When** they view the page, **Then** they see an "Inquiry" button or call-to-action
2. **Given** a signed-in user on an item detail page, **When** they click "Inquiry", **Then** an inquiry form appears (possibly modal or dedicated page)
3. **Given** a user on the inquiry form, **When** they enter a message and submit, **Then** the inquiry is recorded and they receive confirmation
4. **Given** an inquiry submitted by a user, **When** the inquiry is processed, **Then** the dealer receives an email notification with a correctly attributed introduction containing the item details, user contact information (email/name), and inquiry message
5. **Given** an unsigned-in visitor viewing an item detail page, **When** they attempt to send an inquiry, **Then** they are prompted to sign in or register first
6. **Given** a dealer receiving an inquiry, **When** they receive the introduction, **Then** they see the item referenced, the customer's contact details, and the inquiry message

---

### Edge Cases

- What happens when a user tries to submit an inquiry with an empty message?
- How does the system handle a dealer who is not available or has disabled inquiries?
- What occurs if a user sends multiple inquiries for the same item within a short timeframe?
- How are inquiries handled if the item is removed or marked as sold?

## Clarifications *(from stakeholder review)*

### Session 2026-08-04

- Q: How should dealers receive inquiries? → A: Email only. Dealers receive a formatted email with all inquiry details, sent directly from the application.
- Q: Should an admin/curator interface for managing items, categories, dealers, and periods be included in v1? → A: Yes, in scope. v1 includes an admin dashboard where curators can upload items, manage categories, manage dealers, and control item status.
- Q: Should the system track dealer availability/status and allow dealers to disable inquiries? → A: Dealers can set an `inquiries_enabled` flag. Items from dealers with this flag disabled show a "Contact dealer directly" message instead of an inquiry button.
- Q: Should the backend use session-based authentication or token-based? → A: Token-based (JWT). Stateless backend with JWT tokens for API authentication.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a curated marketplace catalog visible to all visitors (authenticated or not)
- **FR-002**: System MUST allow filtering the catalog by item category (Furniture, Fine Art, Antiques, Decorative Objects, Jewelry)
- **FR-003**: System MUST allow filtering the catalog by time period (18th, 19th, 20th, 21st Century)
- **FR-004**: System MUST allow combining multiple filters (category AND period) simultaneously
- **FR-005**: System MUST display item detail pages showing: title, description, images, category, time period, dealer name, estimated condition, and asking price/valuation if available
- **FR-006**: System MUST provide user registration with email and password
- **FR-007**: System MUST validate email format and enforce password complexity requirements during registration
- **FR-008**: System MUST prevent duplicate email registration (return appropriate error)
- **FR-009**: System MUST provide user sign-in with email and password
- **FR-010**: System MUST maintain user session after successful sign-in
- **FR-011**: System MUST provide user sign-out capability
- **FR-012**: System MUST allow signed-in users to initiate an inquiry on item detail pages
- **FR-013**: System MUST collect user inquiry message and route it to the correct dealer
- **FR-014**: System MUST create a correctly attributed introduction that includes: item details, user contact information (name, email), inquiry message, and dealer attribution
- **FR-015**: System MUST prevent unsigned-in users from submitting inquiries (redirect to sign-in/registration)
- **FR-016**: System MUST not charge commission or facilitate on-platform checkout; the platform is inquiry-only, with transactions occurring offline between user and dealer
- **FR-017**: System MUST allow dealers to set an `inquiries_enabled` flag in their profile; items from dealers with inquiries disabled MUST display "Contact dealer directly" instead of an "Inquiry" button
- **FR-018**: System MUST send an email to the dealer when an inquiry is submitted, containing: item details, user contact information (name, email), inquiry message, and timestamp
- **FR-019**: System MUST provide a curator/admin interface where administrators can: upload and create items, manage categories and periods, manage dealer profiles, and control item status (available, sold, removed)
- **FR-020**: System MUST use JWT tokens for authentication; users receive a token upon sign-in and must include it with each API request; the backend does not maintain server-side sessions

### Key Entities

- **Item**: Represents a curated marketplace listing. Attributes include: title, description, images, category (Furniture, Fine Art, Antiques, Decorative Objects, Jewelry), time period (18th–21st century), dealer attribution, asking price/valuation, condition, and status (available, sold, removed). Relationships: belongs to one Category, belongs to one Period, listed by one Dealer.
- **Category**: Represents item types. Attributes: name (Furniture, Fine Art, Antiques, Decorative Objects, Jewelry), description.
- **Period**: Represents time period. Attributes: name (18th Century, 19th Century, 20th Century, 21st Century), start year, end year.
- **User**: Represents a registered account. Attributes: email (unique), password (hashed), name, created date, last sign-in. Relationships: created many Inquiries.
- **Dealer**: Represents the merchant/seller. Attributes: name, email, contact information, inquiries_enabled (boolean, default true), items listed. Relationships: listed many Items, received many Inquiries.
- **Inquiry**: Represents a customer inquiry about an item. Attributes: user (who sent), item (what is being inquired about), dealer (who receives), message, timestamp, status (pending, responded, resolved), email_sent (boolean, tracks if notification email was sent). The inquiry triggers a correctly attributed introduction email sent to the dealer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Visitors can apply filters and find items matching their criteria within 10 seconds of applying a filter
- **SC-002**: Users can complete registration in under 2 minutes
- **SC-003**: Signed-in users can find and send an inquiry for an item in under 3 minutes from visiting the marketplace
- **SC-004**: 95% of inquiries are delivered to the correct dealer with complete user attribution (no missing name or email)
- **SC-005**: Item detail pages load in under 1.5 seconds
- **SC-006**: The marketplace supports browsing and filtering with at least 500 items without performance degradation
- **SC-007**: Registration validation prevents submission of invalid emails and weak passwords with 100% accuracy

## Assumptions

- Target users are collectors and designers browsing high-end items; dealers are established merchants with contact information on file
- Email/password authentication is sufficient for v1; multi-factor authentication and social sign-in are out of scope
- Items are curated and managed by administrators; user-submitted items are out of scope for v1
- Dealers are pre-registered in the system by administrators; dealer registration is out of scope for v1
- The platform is not responsible for verifying or facilitating transactions; inquiries are informational only
- Mobile responsiveness is required; native mobile apps are out of scope for v1
- The marketplace catalog is small enough initially that basic filtering and pagination are sufficient; advanced search and faceted navigation are out of scope for v1
- Payment processing, escrow, and transaction management are explicitly out of scope
- Admin/curator interface is in scope for v1; curators have privileged access to create, edit, and manage items, categories, dealers, and item status
- JWT token expiration, refresh token strategy, and token management details will be finalized during the planning phase
- Dealer email notifications are the primary notification channel; in-app notifications, SMS, or push notifications are out of scope for v1
