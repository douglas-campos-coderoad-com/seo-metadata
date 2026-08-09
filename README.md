# InCollect - Curated Catalog Discovery & Dealer Inquiry

A full-stack marketplace platform for discovering and inquiring about curated high-end items (furniture, fine art, antiques, decorative objects, and jewelry) from trusted dealers worldwide.

**Status**: MVP Complete ✅ - Browse functionality fully implemented and ready to test

---

## 📋 Project Overview

InCollect is a **commission-free marketplace** that connects visitors with curated dealers:

- **Browse**: Discover items across categories (Furniture, Art, Antiques, etc.) and periods (18th-21st century)
- **Filter**: Search by category, period, or browse all available items
- **Ingest**: Scrape and store HTML from any e-commerce URL (Shopify, Magento, InCollect, etc.)
- **Analyze**: AI-powered SEO/GEO/AEO analysis with LangGraph + Gemini
- **Inquire**: Sign in and send inquiries to dealers about items you're interested in
- **Admin**: Manage items, dealers, categories, and periods (coming in Phase 6)

### Key Features (Phase 1-3)
✅ Browse curated marketplace with filtering  
✅ Responsive design (mobile, tablet, desktop)  
✅ RESTful API with PostgreSQL database  
✅ JWT authentication infrastructure  
✅ URL ingestion with agnostic web scraping (httpx + Playwright fallback)  
✅ AI-powered SEO/GEO/AEO analysis with LangGraph + Gemini  
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
| **AI/LLM** | LangGraph + LangChain + Gemini | Latest |
| **Web Scraping** | httpx + BeautifulSoup4 + Playwright | Latest |
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
│  │ - POST /api/v1/ingest/url (scrape + store HTML)   │   │
│  │ - GET /api/v1/ingest/url/{id} (retrieve HTML)     │   │
│  │ - GET /api/v1/ingest/urls (list ingested URLs)    │   │
│  │ - POST /api/v1/analyze/{id} (SEO/GEO analysis)    │   │
│  │ - GET /api/v1/analyze/{id} (get analysis)         │   │
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
│  │ - ingested_urls (scraped HTML)                      │   │
│  │ - url_analyses (SEO/GEO analysis results)           │   │
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

IngestedUrls (N)
├─ id, url (unique), html, status, http_status, content_type, error, timestamps

UrlAnalyses (N)
├─ id, ingested_url_id (FK), seo_score, geo_score, overall_score
├─ analysis (JSONB), json_ld (JSONB), status, error, timestamps
└─ FK: ingested_url_id → ingested_urls (CASCADE DELETE)
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
cd backend
pip install -r requirements.txt
cd ..
```

3. **Install frontend dependencies**

```bash
cd frontend
npm install
cd ..
```

4. **Configure environment variables**

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY if you want to use the analysis feature
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
- Database: localhost:5432 (incollect/incollect)
- MailHog: http://localhost:8025

To stop:
```bash
docker-compose down
```

To stop and remove volumes (clean slate):
```bash
docker-compose down -v
```

#### Option B: Local Development (Manual Setup)

**1. Start PostgreSQL**

```bash
docker-compose up -d postgres
```

**2. Setup database**

```bash
cd backend
alembic upgrade head  # Run migrations
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

### URL Ingestion (Public)

```bash
# Ingest a URL (scrape and store HTML)
POST /api/v1/ingest/url
{
  "url": "https://example.com/product"
}

# Get ingested URL details (including HTML)
GET /api/v1/ingest/url/{id}

# List all ingested URLs
GET /api/v1/ingest/urls?skip=0&limit=100
```

### SEO/GEO Analysis (Public)

```bash
# Run AI analysis on ingested URL
POST /api/v1/analyze/{ingested_url_id}

# Get latest analysis results
GET /api/v1/analyze/{ingested_url_id}
```

**Response example:**
```json
{
  "id": 1,
  "ingested_url_id": 2,
  "seo_score": 55,
  "geo_score": 30,
  "overall_score": 42,
  "analysis": {
    "findings": ["Falta de marcado JSON-LD", "14 imágenes sin alt text"],
    "recommendations": ["Implementar Schema.org", "Completar alt text"],
    "geo_visibility": "La visibilidad para motores de IA generativa es baja..."
  },
  "json_ld": { "@context": "https://schema.org", "@type": "Product", ... },
  "status": "completed"
}
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
- `GEMINI_API_KEY` - Google Gemini API key for SEO/GEO analysis
- `GEMINI_MODEL` - Gemini model to use (default: gemini-3.5-flash-lite)
- `SMTP_*` - Email configuration (Phase 5)

---

## 📊 Implementation Progress

### Completed ✅
- [x] Phase 1: Project Setup
- [x] Phase 2: Foundational Infrastructure
- [x] Phase 3: Browse Feature (MVP)
- [x] Phase 2.5: URL Ingestion (agnostic web scraping)
- [x] Phase 2.6: SEO/GEO/AEO Analysis with LangGraph + Gemini

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
pytest tests/test_ingest_service.py

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

### URL Ingestion Feature
- **[Spec](specs/002-url-ingestion/spec.md)** - URL ingestion requirements
- **[Plan](specs/002-url-ingestion/plan.md)** - Technical architecture
- **[Data Model](specs/002-url-ingestion/data-model.md)** - IngestedUrl entity
- **[API Contract](specs/002-url-ingestion/contracts/api.md)** - Endpoint specifications

### SEO/GEO Analysis Feature
- **[Spec](specs/003-seo-analyzer/spec.md)** - Analysis requirements
- **[Plan](specs/003-seo-analyzer/plan.md)** - LangGraph architecture
- **[Data Model](specs/003-seo-analyzer/data-model.md)** - UrlAnalysis entity
- **[API Contract](specs/003-seo-analyzer/contracts/api.md)** - Endpoint specifications

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