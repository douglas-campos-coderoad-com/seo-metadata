# Feature Specification: Agnostic URL Ingestion

**Feature Branch**: `002-url-ingestion`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "Entrada: URL rígida de InCollect. Entrada Agnóstica: Cualquier URL o carga de JSON de productos (Shopify, Magento, InCollect, etc.). Crear endpoint POST /api/v1/ingest/url (extrae metadatos básicos de cualquier URL mediante scraping agnóstico). Debemos extraer el html del link y después almacenarlo en base de datos. Ese resultado será utilizado para después analizar el contenido y ver si podemos mejorarlo para geo. Por ahora no implementaremos esa tarea, solo obtener el contenido html del link recibido."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingest URL via Agnostic Scraping (Priority: P1)

Un usuario (admin/curator) envía una URL de cualquier plataforma de e-commerce (Shopify, Magento, InCollect, etc.) al endpoint `POST /api/v1/ingest/url`. El sistema realiza un scraping agnóstico de la URL, extrae el contenido HTML, y lo almacena en la base de datos para su posterior análisis y optimización (tarea de geo no implementada en esta fase).

**Why this priority**: La ingestión de contenido es la base para cualquier análisis posterior de SEO/geo. Sin el HTML almacenado no se puede analizar ni mejorar el contenido.

**Independent Test**: Puede ser probado enviando una URL real (por ejemplo, un producto de Shopify o Magento) al endpoint, y verificando que el HTML se almacena correctamente en la base de datos y se devuelve un resumen de la operación.

**Acceptance Scenarios**:

1. **Given** un usuario con una URL válida de una plataforma (Shopify, Magento, InCollect, etc.), **When** envía la URL a `POST /api/v1/ingest/url`, **Then** el sistema realiza el scraping, extrae el HTML y lo almacena en la BD, devolviendo un resumen con `id`, `url`, `status`, `http_status`, `content_type` y `html_size_bytes`.
2. **Given** un usuario envía una URL existente que ya fue procesada, **When** se procesa nuevamente, **Then** el sistema puede actualizar el registro existente (o crear uno nuevo según política).
3. **Given** un usuario envía una URL de una página que renderiza contenido con JavaScript (SPA), **When** el scraping base no obtiene contenido útil, **Then** el sistema usa el fallback con Playwright para obtener el HTML renderizado.
4. **Given** un usuario envía una URL inválida o inaccesible, **When** se procesa, **Then** el sistema devuelve un error claro (400/422) y registra el fallo en la BD.
5. **Given** un usuario envía una URL que no devuelve contenido HTML (p.ej. un PDF o imagen), **When** se procesa, **Then** el sistema maneja el error de forma controlada.

---

### Edge Cases

- ¿Qué pasa si la URL no es válida (formato incorrecto)?
- ¿Qué ocurre si el sitio no responde o devuelve un timeout?
- ¿Cómo se maneja una URL que devuelve un error HTTP (404, 403, 500)?
- ¿Qué sucede si el contenido es muy grande?
- ¿Cómo se maneja una página que requiere JavaScript para renderizar el contenido?

## Clarifications *(from stakeholder review)*

### Session 2026-08-08

**Pregunta**: ¿Qué tecnología de scraping debemos usar?
**Respuesta**: Utilizar `httpx` + `BeautifulSoup4` como motor principal (rápido y ligero) con `Playwright` como fallback para páginas que renderizan contenido con JavaScript. Esto maximiza la compatibilidad agnóstica con cualquier plataforma.

**Pregunta**: ¿Debemos implementar el análisis/optimización de contenido (geo) ahora?
**Respuesta**: No. En esta fase solo se obtiene y almacena el HTML. El análisis y mejora de contenido para geo se implementará en una fase posterior.

**Pregunta**: ¿El HTML se almacena completo o se procesa?
**Respuesta**: Se almacena el HTML completo extraído (después de una limpieza básica con BeautifulSoup) para que pueda ser analizado posteriormente.

## Content Requirements

### Data Model

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | Integer PK | Identificador |
| `url` | String(2048) único | URL procesada |
| `html` | Text | Contenido HTML extraído |
| `status` | String(50) | `success` / `failed` |
| `http_status` | Integer | Código HTTP de respuesta |
| `content_type` | String(255) | Tipo de contenido |
| `error` | Text | Mensaje de error (si falla) |
| `created_at` / `updated_at` | DateTime | Timestamps |

### API Contract

```
POST /api/v1/ingest/url
Body: { "url": "https://ejemplo.com/producto" }

Response 200:
{
  "id": 1,
  "url": "https://ejemplo.com/producto",
  "status": "success",
  "html_size_bytes": 45231,
  "http_status": 200,
  "content_type": "text/html; charset=utf-8",
  "created_at": "2026-08-08T..."
}

Response 400: URL inválida
Response 422: URL inaccesible / error de scraping
```

## Success Criteria

| ID | Criterio | Cómo se valida |
|----|----------|----------------|
| SCI-001 | URL de cualquier plataforma es procesada | Test con URL real de Shopify/Magento |
| SCI-002 | HTML almacenado en BD | Verificar registro en `ingested_urls` |
| SCI-003 | Fallback con Playwright funciona | Test con página SPA |
| SCI-004 | Errores manejados correctamente | Test con URL inválida/inaccesible |
| SCI-005 | Endpoint devuelve resumen correcto | Contract test del response |