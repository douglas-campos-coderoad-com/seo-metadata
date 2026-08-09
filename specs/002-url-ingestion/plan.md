# Technical Plan: Agnostic URL Ingestion

## Overview

Implementar el endpoint `POST /api/v1/ingest/url` que recibe una URL de cualquier plataforma de e-commerce, realiza scraping agnóstico para extraer el HTML, y lo almacena en PostgreSQL. El HTML almacenado será la base para futuros análisis de contenido SEO/geo (fuera de alcance de esta fase).

## Architecture

### Estrategia de scraping híbrida

1. **Motor principal (rápido y ligero)**: `httpx` + `BeautifulSoup4`
   - Cliente HTTP async (consistente con el stack FastAPI)
   - Timeouts y headers configurables (User-Agent realista)
   - Funciona para la mayoría de sitios (Shopify, Magento, InCollect sirven HTML estático con JSON-LD / meta tags)

2. **Fallback con JavaScript**: `Playwright`
   - Para URLs que renderizan contenido dinámicamente (SPAs)
   - Se usa solo cuando el motor base no obtiene contenido útil
   - Configurable vía variable de entorno para no requerir navegador siempre

### Flujo del servicio

```
POST /api/v1/ingest/url { url }
        │
        ▼
1. Validar URL (formato http/https) ──error──► 400
        │
        ▼
2. GET con httpx (user-agent, timeout, follow_redirects)
        │
        ├── éxito con HTML útil ──────────────► guardar en BD (status=success)
        │
        └── sin contenido útil / JS requerido ─► fallback Playwright
                                                 │
                                                 ├── éxito ──► guardar en BD
                                                 └── error ──► guardar en BD (status=failed) + 422
```

## Tech Stack Additions

| Librería | Versión | Propósito |
|----------|---------|-----------|
| `httpx` | 0.25.2 (ya instalada) | Cliente HTTP async para scraping |
| `beautifulsoup4` | 4.12+ | Parseo y limpieza de HTML |
| `playwright` | Opcional | Fallback para páginas con JS |

## Components

### Backend

| Archivo | Propósito |
|---------|-----------|
| `backend/src/models/ingested_url.py` | Modelo SQLAlchemy `IngestedUrl` |
| `backend/src/schemas/ingest.py` | Schemas Pydantic (`IngestUrlRequest`, `IngestUrlResponse`) |
| `backend/src/services/ingest_service.py` | Lógica de scraping + persistencia |
| `backend/src/api/ingest.py` | Router con `POST /api/v1/ingest/url` |
| `backend/migrations/versions/002_ingested_urls.py` | Migración Alembic |

## Dependencies

- La fase 002 depende de la Fase 2 (Foundational) del catálogo 001 (sesión de BD, models base, main.py).
- No depende de autenticación (fase 4) — el endpoint es público por ahora, aunque se puede proteger posteriormente.

## Decisiones técnicas

1. **httpx + BeautifulSoup4 como principal**: Rápido, ligero, sin necesidad de navegador. Cubre la mayoría de plataformas que sirven HTML estático.
2. **Playwright como fallback**: Solo se invoca si el HTML base no tiene contenido útil. Evita el overhead de un navegador en cada request.
3. **Almacenamiento del HTML completo**: Se guarda el HTML (tras limpieza básica) para análisis posterior. No se procesa contenido en esta fase.
4. **Tabla `ingested_urls`**: Almacena el HTML junto con metadatos (status, http_status, content_type, error) para trazabilidad.