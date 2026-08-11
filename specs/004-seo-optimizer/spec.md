# Feature Specification: SEO/GEO/AEO Optimizer

**Feature Branch**: `004-seo-optimizer`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "continuemos con la siguiente tarea el optimizador en base a la recomendacion para mejorar en seo, geo y aeo, agrega el spec. 1 usemos serper si lo ves conveniente, 2 si me parece bien tu recomendacion para que sea facil pegar y pegar"

## Overview

El agente optimizer toma el resultado del análisis SEO/GEO/AEO (`url_analyses`) y el HTML original (`ingested_urls`), y genera:

1. **HTML optimizado** — meta tags corregidos (title, description, OG, Twitter), heading hierarchy arreglada, alt texts completados, atributos `lang`/`canonical`.
2. **JSON-LD enriquecido** — Reparar/expandir el Knowledge Graph generado en el análisis para que sea completamente válido y rico semánticamente (Creator, Material, Dimensions COM/COL, Estilo, Offers, Brand).
3. **Contenido optimizado para GEO/AEO** — Reescritura de descripciones/textos para responder preguntas conversacionales y ser citable por LLMs (Perplexity, ChatGPT, SearchGPT, AI Overviews).
4. **Snippets de código listos para copiar** — Cada cambio propuesto con su fragmento de código final.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Optimize a URL based on analysis (Priority: P1)

Un usuario ejecuta el análisis de una URL, obtiene los scores y recomendaciones, y luego ejecuta el optimizer para generar el HTML optimizado, JSON-LD reparado, y contenido GEO/AEO reescrito. El resultado incluye fragmentos de código listos para copiar/pegar.

**Why this priority**: La optimización es el siguiente paso lógico después del análisis. Sin ella, el análisis solo informa pero no actúa.

**Independent Test**: Puede ser probado ejecutando el análisis de una URL, luego el optimizer, y verificando que el HTML optimizado contiene los cambios recomendados (meta tags corregidos, JSON-LD válido, alt texts completados).

**Acceptance Scenarios**:

1. **Given** un análisis completado, **When** se ejecuta el optimizer, **Then** se genera un HTML optimizado con los cambios recomendados aplicados.
2. **Given** un análisis con JSON-LD faltante o incompleto, **When** se ejecuta el optimizer, **Then** se genera un JSON-LD válido y enriquecido con schema.org.
3. **Given** un análisis con recomendaciones de contenido GEO/AEO, **When** se ejecuta el optimizer, **Then** se reescribe el contenido para ser citable por LLMs.
4. **Given** un análisis completado, **When** se ejecuta el optimizer, **Then** se devuelven fragmentos de código listos para copiar/pegar.
5. **Given** un análisis que no existe, **When** se ejecuta el optimizer, **Then** se devuelve un error claro (404).

### User Story 2 - Retrieve optimization results (Priority: P2)

Un usuario puede recuperar la última optimización de un análisis para revisar los cambios aplicados.

**Why this priority**: Permite revisar y reutilizar los resultados de la optimización.

**Independent Test**: Puede ser probado ejecutando el optimizer y luego recuperando el resultado con GET.

**Acceptance Scenarios**:

1. **Given** una optimización completada, **When** se consulta con GET, **Then** se devuelve el reporte completo con HTML optimizado, JSON-LD, cambios y scores.
2. **Given** un análisis sin optimización, **When** se consulta con GET, **Then** se devuelve un error claro (404).

---

### Edge Cases

- ¿Qué pasa si el análisis no tiene recomendaciones? El optimizer debe manejar el caso y devolver un mensaje claro.
- ¿Qué pasa si el HTML original es muy grande? El optimizer debe truncar el HTML para el prompt de Gemini.
- ¿Qué pasa si Gemini falla? El optimizer debe manejar el error y devolver un estado `failed`.
- ¿Qué pasa si el análisis está en estado `failed`? El optimizer no debe ejecutarse sobre un análisis fallido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to trigger optimization for a completed analysis via `POST /api/v1/optimize/{analysis_id}`.
- **FR-002**: System MUST generate an optimized HTML with the recommended changes applied (meta tags, headings, alt texts, lang, canonical).
- **FR-003**: System MUST generate a valid, enriched JSON-LD Knowledge Graph using schema.org.
- **FR-004**: System MUST rewrite content for GEO/AEO citability (conversational, question-answering, complete).
- **FR-005**: System MUST provide ready-to-copy code snippets for each change.
- **FR-006**: System MUST persist the optimization result in the database.
- **FR-007**: System MUST allow retrieval of the latest optimization via `GET /api/v1/optimize/{analysis_id}`.
- **FR-008**: System MUST use Serper API for web search to inform optimization decisions (best practices, schema.org examples).
- **FR-009**: System MUST handle errors gracefully (analysis not found, Gemini failure, Serper failure).

### Key Entities

- **UrlOptimization**: Result of the optimization process. Attributes: analysis reference, optimized HTML, optimized JSON-LD, optimized content, changes list, score before/after, status, error.

## Success Criteria *(mandatory)*

- **SC-001**: A user can go from analysis to optimized HTML in one API call.
- **SC-002**: The optimized HTML includes all recommended changes from the analysis.
- **SC-003**: The JSON-LD is valid and passes schema.org validation.
- **SC-004**: The optimized content is citable by LLMs (GEO/AEO).
- **SC-005**: All changes are provided as copy-ready code snippets.
- **SC-006**: Errors are handled gracefully with clear messages.

## Assumptions

- **Serper API key** will be provided via environment variable `SERPER_API_KEY`.
- **Gemini** is used for content generation and optimization.
- The optimizer is **agnostic** — works for any type of page (e-commerce, blog, landing, etc.).
- The optimizer uses the analysis results (`url_analyses`) and the original HTML (`ingested_urls`).