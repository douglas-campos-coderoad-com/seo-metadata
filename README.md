# Visora — AI Search Visibility

Paste a product listing URL. Visora scrapes it, scores it for both classic search
engines and generative AI engines, tells you exactly what is costing you visibility,
generates the fixed markup for you, proves the fix works by re-asking an LLM the same
question — and exports the whole thing as a client-ready PDF.

- **SEO** — Search Engine Optimization: metadata, headings, images, crawlability.
- **GEO** — Generative Engine Optimization: will an LLM surface this page?
- **AEO** — Answer Engine Optimization: is the content citable as an answer?

---

## 📋 What it does

| Step | Feature | Result |
| --- | --- | --- |
| 1. Ingest | Provider-agnostic scraping (`httpx`, with a Playwright fallback for JS-rendered pages) | Raw HTML stored per URL |
| 2. Analyze | LangGraph pipeline over an LLM: `parse_html → analyze_seo_geo → generate_json_ld → compile_report` | SEO / GEO / overall scores, categorised findings, recommendations, generated JSON-LD |
| 3. Optimize | Optimizer agents rewrite the page's weak points | Optimized HTML, enriched schema.org JSON-LD, GEO/AEO-rewritten copy, copy-paste snippets |
| 4. Prove | AEO Live Test + GEO Citation Score + ROI model | Before/after LLM answers for a real query, a 0–100 citability score, projected financial impact |
| 5. Export | Jinja2 report printed to PDF by the Playwright Chromium already in the backend image | One self-contained hand-off document per analysis |

Findings are grouped by category — `metadata`, `content`, `headings`, `images`,
`structured_data`, `social`, `crawlability`, `performance`, `geo_aeo` — and colour-coded
by severity consistently across the UI and the PDF.

### Frontend concepts

- **Analyze** — submit a URL, watch the run status live, read findings, copy snippets, export the PDF.
- **Projects** — group URLs so issues repeating across pages surface as *shared issues*.
- **Targets / Runs** — per-URL history and a snapshot view of any past run.

Projects and history live in a **session-scoped in-memory store** on the
client (Zustand); the analyses and reports they point at are persisted by the backend.
A full page reload clears the client-side grouping.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js 15 App Router · TypeScript strict · Tailwind        │
│  http://localhost:3000                                       │
│  app/{analyze,projects,targets,runs}                          │
│  features/{analysis,projects,history,landing}                │
│  shared/{store,realtime,components}                          │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST + JSON
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  FastAPI · Python 3.12 · Pydantic v2                         │
│  http://localhost:8000  (docs at /docs)                      │
│                                                              │
│  api/       ingest · analysis · optimization · geo · report  │
│  services/  ingest · analysis (LangGraph) · optimizer ·      │
│             geo_score · report · pdf_renderer                │
│  agents/    entity · geo_content · llm_simulator             │
│  llm/       provider-agnostic repository (gemini|anthropic)  │
│  templates/report/  Jinja2 + CSS printed to PDF              │
└───────────────────────────┬──────────────────────────────────┘
                            │ SQLAlchemy 2.x async
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  PostgreSQL 16                                               │
│  ingested_urls · url_analyses · url_optimizations            │
└──────────────────────────────────────────────────────────────┘
```

### Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router) + React + TypeScript (strict) |
| Styling | Tailwind CSS + shadcn-style UI primitives |
| Backend | FastAPI + Python 3.12+ + Pydantic v2 |
| Database | PostgreSQL 16, SQLAlchemy 2.x async, Alembic |
| AI orchestration | LangGraph + LangChain |
| LLM providers | Google Gemini (default) or Anthropic Claude — swappable by config |
| Web search | Serper (optional) |
| Scraping | httpx + BeautifulSoup4, Playwright fallback |
| PDF | Jinja2 template printed via Playwright Chromium |
| Testing | pytest + httpx (backend), Vitest + React Testing Library + Playwright (frontend) |
| Infra | Docker Compose, GitHub Actions, GCP VM + Artifact Registry |

### Data model

```
IngestedUrls
├─ id, url (unique), html, status, http_status, content_type, error, timestamps

UrlAnalyses
├─ id, ingested_url_id (FK → ingested_urls, CASCADE DELETE)
├─ seo_score, geo_score, overall_score
├─ analysis (JSONB: findings, recommendations, breakdowns, geo_visibility)
├─ json_ld (JSONB), status, error, timestamps

UrlOptimizations
├─ id, analysis_id (FK → url_analyses)
├─ optimized_html, optimized_json_ld (JSONB), optimized_content (JSONB)
├─ changes (JSONB), score_before, score_after_estimated, status, error, timestamps
```

---

## 🚀 Quick start

### Prerequisites

- **Docker** & **Docker Compose** (the shortest path — everything runs in containers)
- For manual setup instead: **Node.js** 20+, **Python** 3.12+, **PostgreSQL** 16
- An LLM API key: `GEMINI_API_KEY` **or** `ANTHROPIC_API_KEY`

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env
# set GEMINI_API_KEY (or LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY)

make dev            # or: docker-compose up -d
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 (`incollect` / `incollect`) |
| MailHog UI | http://localhost:8025 |

The `api` container runs `alembic upgrade head` on start, so the schema is ready
without a separate step. Both `api` and `web` mount `src/` for hot reload.

```bash
docker-compose down       # stop
docker-compose down -v    # stop and wipe the database volume
```

### Option B — Local development

```bash
# 1. database only
docker-compose up -d postgres

# 2. backend
cd backend
pip install -r requirements.txt
playwright install chromium        # needed for JS-rendered pages and PDF export
alembic upgrade head
uvicorn src.main:app --reload      # → http://localhost:8000

# 3. frontend (new shell)
cd frontend
npm install
npm run dev                        # → http://localhost:3000
```

### Useful commands

```bash
make help            # list every target

make dev             # start all services (Docker Compose)
make install         # install backend + frontend dependencies

make db-migrate      # alembic upgrade head
make db-rollback     # alembic downgrade -1

make lint            # mypy + ruff + black --check, and next lint
make format          # black + ruff --fix, and prettier

make test            # backend + frontend
make test-backend    # pytest --cov=src
make test-frontend   # vitest
make test-e2e        # playwright

make build           # build both sides
make clean           # drop caches and build artifacts
```

---

## 🔌 API

Base prefix: `/api/v1`. Full interactive reference: http://localhost:8000/docs.

### Ingestion

```http
POST /api/v1/ingest/url          { "url": "https://example.com/product" }
GET  /api/v1/ingest/url/{id}     # detail, including stored HTML
GET  /api/v1/ingest/urls         # ?skip=0&limit=100
```

### Analysis

```http
POST /api/v1/analyze/{ingested_url_id}    # run the LangGraph pipeline
GET  /api/v1/analyze/{ingested_url_id}    # latest analysis
```

Response shape:

```json
{
  "id": 1,
  "ingested_url_id": 2,
  "seo_score": 55,
  "geo_score": 30,
  "overall_score": 42,
  "analysis": {
    "findings": [
      {
        "id": "structured-data-missing",
        "category": "structured_data",
        "severity": "critical",
        "title": "No JSON-LD markup on the page",
        "detail": "..."
      }
    ],
    "recommendations": [
      { "title": "Add Product schema", "current_html": "...", "suggested_html": "..." }
    ],
    "geo_visibility": "Visibility for generative engines is low because ..."
  },
  "json_ld": { "@context": "https://schema.org", "@type": "Product" },
  "status": "completed"
}
```

### Optimizer

```http
POST /api/v1/optimize/{analysis_id}    # generate optimized HTML, JSON-LD, content + roi_projection
GET  /api/v1/optimize/{analysis_id}    # latest optimization
```

The `POST` accepts an optional JSON body with business metrics used to project ROI
(`metrics.monthly_organic_traffic`, `generative_search_share`, `conversion_rate`,
`avg_order_value`, `cost_per_product`). When omitted, sensible defaults are used.

### GEO / AEO

```http
POST /api/v1/geo/aeo-test/{analysis_id}   { "query": "..." }  → before/after LLM answers
POST /api/v1/geo/simulate/{analysis_id}   { "query": "..." }  → cited?, confidence, quote
POST /api/v1/geo/score/{analysis_id}      # 0–100 GEO citation score
```

### PDF report

```http
GET /api/v1/report/{analysis_id}/pdf
```

Returns `application/pdf` as an attachment, filename derived from the analysed URL and
date. `404` if the analysis does not exist, **`409`** if it exists but is not
`completed` — the caller can tell "missing" from "not exportable yet". The report
includes the optimizer sections only when a completed optimization exists.

### Health

```http
GET /api/v1/health
```

> `/items`, `/categories`, `/periods` are legacy routes left over from the repository's
> earlier catalog project and are not part of the analyzer flow.

---

## ⚙️ Configuration

Copy `.env.example` to `.env`. The variables that matter:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL async connection string |
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL used by the browser |
| `FRONTEND_URL` | Allowed CORS origin |
| `LLM_PROVIDER` | `gemini` (default) or `anthropic` |
| `LLM_MODEL`, `LLM_MODEL_FALLBACK` | Provider-neutral overrides; win over the provider-specific values |
| `LLM_TEMPERATURE`, `LLM_MAX_RETRIES` | Generation behaviour |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK` | Gemini credentials and models |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_FALLBACK` | Used when `LLM_PROVIDER=anthropic` |
| `SERPER_API_KEY` | Optional web search for the optimizer agents |
| `REPORT_RENDER_CONCURRENCY` | Parallel PDF renders allowed (default `2`) |
| `REPORT_MAX_CODE_CHARS` | Cap on a single code block in the PDF (default `20000`) |
| `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRATION_HOURS` | Auth scaffolding |
| `LOG_LEVEL`, `LOG_FORMAT` | Structured JSON logging |

### Swapping the LLM provider

Every LLM call goes through the repository in [`backend/src/llm/`](backend/src/llm/), which
normalises responses identically for every provider (code-fence stripping, JSON parsing,
primary-model-then-fallback retry). Switching providers is configuration only — the graph
nodes and agents keep receiving the same output:

```bash
# Gemini (default)
LLM_PROVIDER=gemini GEMINI_API_KEY=... make dev

# Anthropic
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... make dev
```

Adding a third provider means one subclass plus one `register_provider()` call — no call
site changes:

```python
from src.llm import LLMRepository, register_provider

class MyProviderRepository(LLMRepository):
    provider = 'my-provider'

    def _generate(self, model, messages) -> str:
        ...  # return the assistant's raw text

register_provider('my-provider', lambda settings: MyProviderRepository(
    model=settings.model, fallback_model=settings.fallback_model, api_key=settings.api_key,
))
```

---

## 🧪 Testing

```bash
# Backend
cd backend
pytest                                # everything
pytest --cov=src                      # with coverage
pytest tests/test_report_service.py   # one file
pytest tests/contract tests/integration

# Frontend
cd frontend
npm run test        # Vitest unit + integration
npm run test:ui     # Vitest UI
npm run e2e         # Playwright golden path
```

Backend suites cover ingestion, analysis, the optimizer, the GEO agents and scoring, the
LLM repository (including provider fallback), and report mapping/rendering. Frontend
tests cover the shared-issue detection, severity mapping, the export
button, and the submit-analysis / create-project flows.

---

## 🚢 Deployment (CI/CD)

Pushing to `main` runs the tests, builds the Docker images, pushes them to Artifact
Registry (`REGION-docker.pkg.dev/PROJECT/REPO/{api,web}`), and rolls the stack forward on
a single GCP VM.

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | pull requests, `main` | `pytest` (backend) and lint / type-check / vitest / `next build` (frontend) |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | push to `main`, manual | Builds and pushes the selected images, migrates, restarts the VM stack |

**Deploy one side or both.** Actions → *Deploy to GCP VM* → *Run workflow* → pick `both`
(the default, and what a push to `main` does), `backend`, or `frontend`. Each component
carries its own image tag, so deploying one leaves the other on the image it is already
running; migrations only run when the backend ships.

GitHub authenticates to GCP with Workload Identity Federation (no service-account key)
and reaches the VM through an IAP tunnel (no SSH key secret). The VM runs
[`docker-compose.prod.yml`](docker-compose.prod.yml), which only pulls images — it never
builds.

Full setup — APIs, the Artifact Registry repository, service accounts, WIF pool, VM,
firewall, and the exact list of GitHub secrets and variables — is in
**[`infra/gcp/README.md`](infra/gcp/README.md)**.

To roll back, run the **Deploy to GCP VM** workflow manually with an earlier commit SHA
as `image_tag`.

---

## 📁 Repository layout

```
backend/
├── src/
│   ├── api/            FastAPI routers
│   ├── services/       ingest, analysis graph, optimizer, geo scoring, report, pdf
│   ├── agents/         entity, geo_content, llm_simulator
│   ├── llm/            provider-agnostic LLM repository
│   ├── models/         SQLAlchemy models
│   ├── schemas/        Pydantic schemas
│   ├── templates/      Jinja2 report template + CSS
│   └── middleware/     auth, errors, request logging (CORS is wired in main.py)
├── migrations/         Alembic versions
└── tests/              unit, contract, integration

frontend/
├── src/app/            App Router pages
├── src/features/       analysis, projects, history, landing
├── src/shared/         store, realtime services, UI primitives, helpers
├── src/lib/            API client, auth
└── tests/              unit, integration, e2e

infra/
├── gcp/                VM startup, remote deploy script, setup guide
└── postgres/           init.sql

specs/                  feature specifications and implementation plans
```

---

## 📝 Documentation

| Feature | Spec | Plan |
| --- | --- | --- |
| URL ingestion | [spec](specs/002-url-ingestion/spec.md) | [plan](specs/002-url-ingestion/plan.md) · [data model](specs/002-url-ingestion/data-model.md) |
| SEO analyzer frontend | [spec](specs/003-seo-analyzer-frontend/spec.md) | [plan](specs/003-seo-analyzer-frontend/plan.md) · [tasks](specs/003-seo-analyzer-frontend/tasks.md) |
| SEO/GEO/AEO optimizer | [spec](specs/004-seo-optimizer/spec.md) | [plan](specs/004-seo-optimizer/plan.md) |
| PDF report export | [spec](specs/005-pdf-report-export/spec.md) | [plan](specs/005-pdf-report-export/plan.md) · [tasks](specs/005-pdf-report-export/tasks.md) |

Also useful: [`constitution.md`](constitution.md) (engineering principles),
[`POSTMAN_COLLECTION.md`](POSTMAN_COLLECTION.md) (API walkthrough),
[`specs/001-catalog-discovery/`](specs/001-catalog-discovery/) (the repository's original
catalog project, kept for history).

---

## 🤝 Contributing

```bash
git checkout -b feature/your-feature-name
# backend → backend/src/ · frontend → frontend/src/
make format
make lint
make test
git commit -m "feat: description of changes"
git push origin feature/your-feature-name
```

Follow the existing code style, add tests for new behaviour, keep the relevant spec in
`specs/` in sync, and open a pull request with a clear description.

---

## 📄 License

Internal project — Visora.
