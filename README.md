# InCollect - Curated Catalog Discovery & Dealer Inquiry

A full-stack marketplace platform for discovering and inquiring about curated high-end items (furniture, fine art, antiques, decorative objects, and jewelry) from trusted dealers worldwide.

**Status**: MVP Complete ✅ - Browse functionality fully implemented and ready to test

---

## 📋 Project Overview

InCollect is a **commission-free marketplace** that connects visitors with curated dealers:

- **Browse**: Discover items across categories (Furniture, Art, Antiques, etc.) and periods (18th-21st century)
- **Filter**: Search by category, period, or browse all available items
- **Inquire**: Sign in and send inquiries to dealers about items you're interested in
- **Admin**: Manage items, dealers, categories, and periods (coming in Phase 6)

### Key Features (Phase 1-3)
✅ Browse curated marketplace with filtering  
✅ Responsive design (mobile, tablet, desktop)  
✅ RESTful API with PostgreSQL database  
✅ JWT authentication infrastructure  
🔄 User registration & login (Phase 4)  
🔄 Dealer inquiry system (Phase 5)  

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js + React | 15.x |
| **Frontend Language** | TypeScript | Strict mode |
| **Frontend Styling** | Tailwind CSS | Latest |
| **Backend** | FastAPI | 0.104+ |
| **Backend Language** | Python | 3.12+ |
| **Database** | PostgreSQL | 16+ |
| **ORM** | SQLAlchemy | 2.x async |
| **Migrations** | Alembic | 1.12+ |
| **Auth** | JWT (python-jose) | Stateless |
| **Testing** | pytest (backend), Vitest (frontend) | Latest |
| **Containerization** | Docker & Docker Compose | Latest |

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
│                  (Next.js Frontend)                         │
│              http://localhost:3000                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/REST
                     │ JSON + JWT
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend                           │
│               http://localhost:8000                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ API Routes                                           │   │
│  │ - GET /api/v1/items (browse & filter)             │   │
│  │ - GET /api/v1/items/{id} (detail)                 │   │
│  │ - GET /api/v1/categories (filter options)         │   │
│  │ - GET /api/v1/periods (filter options)            │   │
│  │ - POST /api/v1/auth/register (Phase 4)            │   │
│  │ - POST /api/v1/auth/login (Phase 4)               │   │
│  │ - POST /api/v1/inquiries (Phase 5)                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Middleware                                           │   │
│  │ - JWT Authentication                               │   │
│  │ - CORS Configuration                               │   │
│  │ - Error Handling                                    │   │
│  │ - Request Logging (JSON format)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ SQL
                     │ Async Queries
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                            │
│          localhost:5432 (docker-compose)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Tables                                               │   │
│  │ - categories (5 sample records)                     │   │
│  │ - periods (4 sample records)                        │   │
│  │ - dealers (3 sample records)                        │   │
│  │ - items (10 sample records)                         │   │
│  │ - users (Phase 4)                                   │   │
│  │ - inquiries (Phase 5)                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema (MVP)

```
Categories (5)
├─ id, name, description, timestamps

Periods (4)
├─ id, name, start_year, end_year, timestamps

Dealers (3)
├─ id, name, email, description, inquiries_enabled, timestamps

Items (10)
├─ id, title, description, category_id, period_id, dealer_id
├─ image_urls[], condition, asking_price, status, timestamps
├─ FK: category_id → categories
├─ FK: period_id → periods
└─ FK: dealer_id → dealers
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and **npm/pnpm**
- **Python** 3.12+
- **Docker** & **Docker Compose** (recommended for database)
- **Git**

### Installation

1. **Clone the repository** (or your project structure is already set up)

```bash
cd /path/to/seo-metadata
```

2. **Install backend dependencies**

```bash
pip install -r backend/requirements.txt
```

3. **Install frontend dependencies**

```bash
cd frontend
npm install
cd ..
```

### Running the Application

#### Option A: Using Docker Compose (Recommended)

Start all services (PostgreSQL, backend, frontend):

```bash
docker-compose up -d
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Database: localhost:5432 (postgres/postgres)

To stop:
```bash
docker-compose down
```

#### Option B: Local Development (Manual Setup)

**1. Start PostgreSQL**

```bash
docker-compose up -d postgres mailhog
```

**2. Setup database**

```bash
cd backend
alembic upgrade head  # Run migrations
python -m src.db.seed_data  # Load sample data
cd ..
```

**3. Start backend API** (in `backend/` directory)

```bash
cd backend
uvicorn src.main:app --reload
```

Backend runs at http://localhost:8000

**4. Start frontend** (in `frontend/` directory)

```bash
cd frontend
npm run dev
```

Frontend runs at http://localhost:3000

### Useful Commands

```bash
# View all available commands
make help

# Development - start all services
make dev

# Database migrations
make db-migrate      # Create new migration
make db-rollback     # Rollback last migration

# Code quality
make lint            # Run linters
make format          # Format code (black, prettier)
make type-check      # TypeScript type checking

# Testing
make test            # Run all tests
make test-backend    # Backend tests only
make test-frontend   # Frontend tests only

# Building
make build           # Build Docker images

# API Client generation (Phase 7)
make gen-client      # Generate TypeScript client from OpenAPI
```

---

## 📁 Project Structure

```
seo-metadata/
├── backend/                          # FastAPI Python backend
│   ├── src/
│   │   ├── main.py                   # FastAPI app factory
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   │   ├── category.py
│   │   │   ├── period.py
│   │   │   ├── dealer.py
│   │   │   └── item.py
│   │   ├── schemas/                  # Pydantic request/response models
│   │   │   ├── categories.py
│   │   │   ├── periods.py
│   │   │   ├── items.py
│   │   │   └── users.py              # (Phase 4)
│   │   ├── api/                      # API route handlers
│   │   │   ├── health.py
│   │   │   ├── items.py
│   │   │   ├── categories.py
│   │   │   ├── periods.py
│   │   │   ├── auth.py               # (Phase 4)
│   │   │   └── inquiries.py           # (Phase 5)
│   │   ├── services/                 # Business logic
│   │   │   ├── item_service.py
│   │   │   ├── category_service.py
│   │   │   ├── period_service.py
│   │   │   ├── auth_service.py        # (Phase 4)
│   │   │   └── user_service.py        # (Phase 4)
│   │   ├── middleware/               # ASGI middleware
│   │   │   ├── auth.py               # JWT token validation
│   │   │   ├── errors.py             # Exception handling
│   │   │   └── logging.py            # Request logging
│   │   └── db/                       # Database layer
│   │       ├── session.py            # SQLAlchemy async session
│   │       ├── init_db.py            # DB initialization
│   │       └── seed_data.py          # Sample data
│   ├── migrations/                   # Alembic migrations
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_initial_schema.py # Initial tables
│   ├── tests/                        # pytest test suite
│   │   ├── contract/                 # API contract tests
│   │   ├── integration/              # Integration tests
│   │   └── unit/                     # Unit tests
│   ├── requirements.txt              # Python dependencies
│   ├── pyproject.toml               # mypy, ruff, black, pytest config
│   ├── alembic.ini                  # Alembic configuration
│   ├── Dockerfile                   # Container image
│   └── .gitignore
│
├── frontend/                         # Next.js React frontend
│   ├── src/
│   │   ├── app/                      # Next.js App Router pages
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── page.tsx              # Home page (/)
│   │   │   ├── browse/
│   │   │   │   ├── page.tsx          # Browse page (/browse)
│   │   │   │   └── [itemId]/
│   │   │   │       └── page.tsx      # Item detail (/browse/:id)
│   │   │   └── auth/                 # Auth pages (Phase 4)
│   │   │       ├── register/page.tsx
│   │   │       └── login/page.tsx
│   │   ├── components/               # React components
│   │   │   ├── ItemCard.tsx
│   │   │   ├── ItemFilters.tsx
│   │   │   ├── BrowseGallery.tsx
│   │   │   ├── ItemDetail.tsx
│   │   │   └── AuthForm.tsx          # (Phase 4)
│   │   ├── lib/                      # Utilities & hooks
│   │   │   ├── auth.ts               # useAuth hook
│   │   │   ├── api-client.ts         # API client
│   │   │   └── hooks/
│   │   │       ├── useItems.ts
│   │   │       ├── useCategories.ts
│   │   │       └── usePeriods.ts
│   │   ├── styles/
│   │   │   └── globals.css           # Tailwind + custom styles
│   │   └── types/                    # TypeScript types
│   ├── tests/                        # Vitest + Playwright tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── package.json                 # Node.js dependencies
│   ├── tsconfig.json                # TypeScript config (strict mode)
│   ├── next.config.js               # Next.js configuration
│   ├── tailwind.config.js           # Tailwind CSS config
│   ├── postcss.config.js
│   ├── Dockerfile                   # Container image
│   └── .gitignore
│
├── infra/                           # Infrastructure configuration
│   ├── postgres/
│   │   └── init.sql                 # PostgreSQL init script
│   └── env/
│
├── packages/                        # Shared packages
│   └── api-client/                  # (Phase 7) Auto-generated TypeScript client
│
├── specs/001-catalog-discovery/     # Feature specification & planning
│   ├── spec.md                      # Feature requirements
│   ├── plan.md                      # Technical architecture
│   ├── data-model.md                # Entity definitions
│   ├── research.md                  # Technology decisions
│   ├── contracts/
│   │   └── api.md                   # API specification
│   ├── checklists/
│   │   └── requirements.md          # Quality checklist
│   ├── quickstart.md                # Validation scenarios
│   └── tasks.md                     # Breakdown of 164 tasks
│
├── docker-compose.yml               # Docker Compose configuration
├── Makefile                         # Development commands
├── alembic.ini                      # Alembic configuration (root)
├── .env.example                     # Environment variables template
├── .gitignore                       # Git ignore patterns
├── IMPLEMENTATION_STATUS.md         # Implementation progress
├── CLAUDE.md                        # Agent context & instructions
└── README.md                        # This file
```

---

## 🔌 API Endpoints

### Browse (Public - No Auth Required)

```bash
# List items with optional filters
GET /api/v1/items?category_id=1&period_id=2&skip=0&limit=20

# Get item details
GET /api/v1/items/{item_id}

# Get all categories
GET /api/v1/categories

# Get all periods
GET /api/v1/periods

# Health check
GET /api/v1/health
```

### Authentication (Coming Phase 4)

```bash
# Register new user
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}

# Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Inquiries (Coming Phase 5)

```bash
# Send inquiry to dealer
POST /api/v1/inquiries
Authorization: Bearer {jwt_token}
{
  "item_id": 1,
  "message": "I'm interested in this item"
}

# Get user's inquiries
GET /api/v1/inquiries
Authorization: Bearer {jwt_token}
```

### Admin (Coming Phase 6)

```bash
# Create item
POST /api/v1/admin/items
Authorization: Bearer {jwt_token}

# Update item
PATCH /api/v1/admin/items/{item_id}
Authorization: Bearer {jwt_token}

# etc.
```

**Full API documentation**: http://localhost:8000/docs (Swagger UI)

---

## 🗄️ Sample Data

The application comes pre-loaded with realistic sample data:

**Categories** (5):
- Furniture
- Fine Art
- Antiques
- Decorative Objects
- Jewelry

**Periods** (4):
- 18th Century (1700-1799)
- 19th Century (1800-1899)
- Early 20th Century (1900-1950)
- Contemporary (2000-2025)

**Dealers** (3):
- Antique Emporium (contact@antique-emporium.com)
- Modern Gallery (hello@modern-gallery.com)
- Jewelry House (info@jewelry-house.com)

**Items** (10):
- Victorian Oak Desk
- Abstract Expressionist Canvas
- Porcelain Vase
- Diamond Solitaire Ring
- Art Deco Sideboard
- Still Life Oil Painting
- Persian Carpet Fragment
- Tiffany Lamp
- Emerald Bracelet
- Ming Dynasty Bowl

---

## 🛠️ Development Workflow

### Making Changes

1. **Create a feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make changes**
- Backend: Edit files in `backend/src/`
- Frontend: Edit files in `frontend/src/`

3. **Format and lint**
```bash
make format    # auto-format code
make lint      # check for issues
```

4. **Test locally**
```bash
make test      # run all tests
```

5. **Commit and push**
```bash
git add .
git commit -m "feat: description of changes"
git push origin feature/your-feature-name
```

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens (change in production!)
- `FRONTEND_URL` - Frontend URL for CORS
- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL (public)
- `SMTP_*` - Email configuration (Phase 5)

---

## 📊 Implementation Progress

### Completed ✅
- [x] Phase 1: Project Setup
- [x] Phase 2: Foundational Infrastructure
- [x] Phase 3: Browse Feature (MVP)

### In Progress 🔄
- [ ] Phase 4: User Authentication
- [ ] Phase 5: Inquiry System
- [ ] Phase 6: Admin Interface
- [ ] Phase 7: API Client Generation
- [ ] Phase 8: Testing & Polish

**Detailed Progress**: See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)

---

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run specific test file
pytest tests/contract/test_items_list.py

# Run with coverage
pytest --cov=src

# Run tests in watch mode
pytest-watch
```

### Frontend Tests

```bash
cd frontend

# Run unit tests
npm run test

# Run E2E tests
npm run e2e

# View test UI
npm run test:ui
```

---

## 📝 Documentation

- **[Specification](specs/001-catalog-discovery/spec.md)** - Feature requirements and acceptance criteria
- **[Technical Plan](specs/001-catalog-discovery/plan.md)** - Architecture and decisions
- **[Data Model](specs/001-catalog-discovery/data-model.md)** - Entity definitions and relationships
- **[API Contracts](specs/001-catalog-discovery/contracts/api.md)** - Detailed endpoint specifications
- **[Task Breakdown](specs/001-catalog-discovery/tasks.md)** - 164 tasks across 8 phases

---

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Create a pull request with a clear description

---

## 📞 Support

For issues or questions:

1. Check [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for current status
2. Review specification in `specs/001-catalog-discovery/`
3. Check existing code in `backend/src/` and `frontend/src/`

---

## 📄 License

Internal project - InCollect
