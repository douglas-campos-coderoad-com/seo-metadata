# Backend

FastAPI service for Visora. Runs via Docker Compose from the repository root:

```bash
docker compose up -d          # postgres + api
docker compose logs -f api
```

API docs: <http://localhost:8000/docs> — OpenAPI schema: <http://localhost:8000/openapi.json>

## Running tests

`src` must be importable, so set `PYTHONPATH`:

```bash
docker compose exec -e PYTHONPATH=/app api pytest -q
docker compose exec -e PYTHONPATH=/app api pytest --cov=src --cov-report=term-missing
```

A handful of tests in `tests/test_report_mappings.py` assert that the backend's
severity/colour tables still match the frontend's. They are **skipped inside the
container**, which mounts `backend/` only. Run them where the whole checkout is
visible:

```bash
cd backend && PYTHONPATH=$PWD python -m pytest tests/test_report_mappings.py --noconftest -q
```

## PDF report export

`GET /api/v1/report/{analysis_id}/pdf` returns a self-contained PDF for one
completed analysis. See [`specs/005-pdf-report-export/`](../specs/005-pdf-report-export/)
for the spec, plan, and contract.

Notes worth knowing before changing it:

- **Rendering uses the Playwright Chromium already in the image** (installed for
  the ingestion path), so there is no separate PDF dependency. The image also
  installs `fonts-noto-core` and `fonts-noto-color-emoji`; **rebuild the image**
  after touching the Dockerfile or non-Latin text renders as `□□□`.
- **The render context is locked down**: JavaScript disabled, every outbound
  request aborted, content loaded via `set_content`. The report embeds markup
  from third-party pages and from an LLM, and it is displayed as escaped text —
  never executed. No report template may use Jinja's `|safe` filter.
- **Severity colours are shared with the frontend.** They live in
  `src/services/report_mappings.py` and are enforced against
  `frontend/src/styles/globals.css` and `AnalysisApiService.mapSeverity` by the
  parity test above. Change one side and that test fails — which is the point.
- **The endpoint has no auth dependency**, matching `GET /api/v1/analyze/{id}`
  and `GET /api/v1/optimize/{id}`. This is a recorded deviation from the
  constitution's "every endpoint is authenticated" principle; when repo-wide auth
  lands, this route must adopt it in the same change.

| Variable | Default | Purpose |
|---|---|---|
| `REPORT_RENDER_CONCURRENCY` | `2` | Max simultaneous Chromium renders. Renders are memory-heavy; requests queue above this bound instead of exhausting the container. |
| `REPORT_MAX_CODE_CHARS` | `20000` | Per-markup-block truncation threshold. A longer block is truncated and the report states visibly how many characters were omitted. |

See [`backend/.env.example`](.env.example) for the full environment.
