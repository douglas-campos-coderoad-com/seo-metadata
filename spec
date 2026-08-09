# API Contract: Agnostic URL Ingestion

## Endpoint: `POST /api/v1/ingest/url`

Recibe una URL y realiza scraping agnóstico para extraer y almacenar el HTML.

### Request

**Method**: `POST`
**Path**: `/api/v1/ingest/url`
**Auth**: Ninguna (público)

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

#### 422 Unprocessable Entity

URL inválida (formato incorrecto o no es http/https) o el scraping falló.

```json
{
  "error": "validation_error",
  "detail": "Invalid request",
  "errors": [...]
}
```

---

## Endpoint: `GET /api/v1/ingest/url/{url_id}`

Obtiene el detalle de un registro ingerido, incluyendo el HTML almacenado.

### Request

**Method**: `GET`
**Path**: `/api/v1/ingest/url/{url_id}`
**Auth**: Ninguna (público)

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `url_id` | integer | Sí | ID del registro |

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
  "created_at": "2026-08-08T21:00:00Z",
  "updated_at": "2026-08-08T21:00:00Z",
  "html": "<!DOCTYPE html>...",
  "error": null
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | ID del registro |
| `url` | string | URL procesada |
| `status` | string | `success` / `failed` |
| `html_size_bytes` | integer | Tamaño del HTML en bytes |
| `http_status` | integer | Código HTTP de la respuesta del sitio |
| `content_type` | string | Content-Type del sitio |
| `created_at` | string (ISO8601) | Timestamp de creación |
| `updated_at` | string (ISO8601) | Timestamp de última actualización |
| `html` | string | HTML almacenado (limpiado de scripts/styles) |
| `error` | string/null | Mensaje de error si falló |

#### 404 Not Found

```json
{
  "detail": "Ingested URL with id {url_id} not found"
}
```

---

## Endpoint: `GET /api/v1/ingest/urls`

Lista los registros ingeridos con paginación.

### Request

**Method**: `GET`
**Path**: `/api/v1/ingest/urls`
**Auth**: Ninguna (público)

**Query Parameters**:

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `skip` | integer | No | 0 | Número de registros a saltar |
| `limit` | integer | No | 100 | Máximo de registros a devolver (1-500) |

### Responses

#### 200 OK

```json
{
  "items": [
    {
      "id": 1,
      "url": "https://ejemplo.com/producto",
      "status": "success",
      "html_size_bytes": 45231,
      "http_status": 200,
      "content_type": "text/html; charset=utf-8",
      "created_at": "2026-08-08T21:00:00Z"
    }
  ],
  "total": 1
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `items` | array | Lista de registros (sin HTML) |
| `total` | integer | Total de registros en BD |

#### 400 Bad Request

`skip` negativo o `limit` fuera de rango (1-500).

```json
{
  "detail": "limit must be between 1 and 500"
}
```

---

### Ejemplos con curl

```bash
# Ingestir una URL
curl -X POST http://localhost:8000/api/v1/ingest/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ejemplo.com/producto"}'

# Obtener detalle con HTML
curl http://localhost:8000/api/v1/ingest/url/1

# Listar registros
curl "http://localhost:8000/api/v1/ingest/urls?skip=0&limit=100"