# API Contract: Agnostic URL Ingestion

## Endpoint: `POST /api/v1/ingest/url`

Recibe una URL y realiza scraping agnóstico para extraer y almacenar el HTML.

### Request

**Method**: `POST`
**Path**: `/api/v1/ingest/url`
**Auth**: Ninguna (público por ahora)

**Body** (application/json):
```json
{
  "url": "https://ejemplo.com/producto"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `url` | string | Sí | URL válida (http/https) a procesar |

### Responses

#### 200 OK

```json
{
  "id": 1,
  "url": "https://ejemplo.com/producto",
  "status": "success",
  "html_size_bytes": 45231,
  "http_status": 200,
  "content_type": "text/html; charset=utf-8",
  "created_at": "2026-08-08T21:00:00Z"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | ID del registro almacenado |
| `url` | string | URL procesada |
| `status` | string | `success` / `failed` |
| `html_size_bytes` | integer | Tamaño del HTML en bytes |
| `http_status` | integer | Código HTTP de la respuesta del sitio |
| `content_type` | string | Content-Type del sitio |
| `created_at` | string (ISO8601) | Timestamp de creación |

#### 400 Bad Request

URL inválida (formato incorrecto o no es http/https).

```json
{
  "detail": "Invalid URL format. Must be a valid http/https URL."
}
```

#### 422 Unprocessable Entity

El scraping falló (URL inaccesible, timeout, error HTTP, o contenido no extraíble).

```json
{
  "detail": "Failed to ingest URL: <motivo del error>"
}
```

### Ejemplo con curl

```bash
curl -X POST http://localhost:8000/api/v1/ingest/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ejemplo.com/producto"}'