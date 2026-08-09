# Data Model: Agnostic URL Ingestion

## Entity: `IngestedUrl`

Representa una URL que ha sido procesada a través del endpoint de ingestión. Almacena el HTML extraído junto con metadatos de la operación para trazabilidad y análisis posterior.

### Table: `ingested_urls`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | Integer | PK, autoincrement | Identificador único |
| `url` | String(2048) | UNIQUE, NOT NULL | URL procesada |
| `html` | Text | nullable | Contenido HTML extraído (limpiado) |
| `status` | String(50) | NOT NULL, default='success' | Estado del procesamiento: `success` / `failed` |
| `http_status` | Integer | nullable | Código HTTP de la respuesta |
| `content_type` | String(255) | nullable | Tipo de contenido (Content-Type header) |
| `error` | Text | nullable | Mensaje de error (si el procesamiento falló) |
| `created_at` | DateTime(timezone) | NOT NULL, server_default=now() | Fecha de creación |
| `updated_at` | DateTime(timezone) | NOT NULL, server_default=now() | Fecha de última actualización |

### Indexes

- `ix_ingested_urls_url` — índice único sobre `url` (búsqueda rápida por URL, evita duplicados)

### SQL DDL

```sql
CREATE TABLE ingested_urls (
    id SERIAL PRIMARY KEY,
    url VARCHAR(2048) NOT NULL UNIQUE,
    html TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    http_status INTEGER,
    content_type VARCHAR(255),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_ingested_urls_url ON ingested_urls (url);