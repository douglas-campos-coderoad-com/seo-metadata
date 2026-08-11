# Technical Plan: SEO/GEO/AEO Optimizer

## Overview

Implementar el agente optimizer que toma el resultado del análisis SEO/GEO/AEO (`url_analyses`) y el HTML original (`ingested_urls`), y genera HTML optimizado, JSON-LD enriquecido, contenido GEO/AEO reescrito, y snippets de código listos para copiar.

## Architecture

### Grafo LangGraph (4 nodos)

```
[read_analysis] → [plan_changes] → [apply_changes] → [compile_optimization]
```

| Nodo | Función | Usa LLM |
|------|---------|---------|
| **read_analysis** | Lee el análisis guardado y el HTML original desde BD | No |
| **plan_changes** | Gemini genera un plan de cambios priorizados (qué cambiar, por qué, código sugerido) | Sí |
| **apply_changes** | Gemini aplica los cambios: genera HTML optimizado completo, JSON-LD reparado, contenido GEO/AEO reescrito | Sí |
| **compile_optimization** | Consolida todo en el reporte final con comparativa antes/después | No |

### Serper API

Se usa Serper para búsqueda web que informa las decisiones de optimización:
- Buscar mejores prácticas de SEO para el tipo de página
- Buscar ejemplos de schema.org para el tipo de contenido
- Buscar keywords relevantes

### Flujo del servicio

```
POST /api/v1/optimize/{analysis_id}
        │
        ▼
1. Cargar análisis (url_analyses) + HTML original (ingested_urls)
        │
        ▼
2. Serper: buscar mejores prácticas SEO/GEO para el tipo de página
        │
        ▼
3. Gemini: planificar cambios priorizados
        │
        ▼
4. Gemini: aplicar cambios (HTML optimizado, JSON-LD, contenido)
        │
        ▼
5. Compilar reporte final con comparativa antes/después
        │
        ▼
6. Persistir en url_optimizations + devolver response
```

## Tech Stack Additions

| Librería | Versión | Propósito |
|----------|---------|-----------|
| `serper` | - | Búsqueda web (API HTTP directa, no requiere librería) |

## Components

### Backend

| Archivo | Propósito |
|---------|-----------|
| `backend/migrations/versions/004_url_optimizations.py` | Migración Alembic |
| `backend/src/models/url_optimization.py` | Modelo SQLAlchemy `UrlOptimization` |
| `backend/src/schemas/optimization.py` | Schemas Pydantic |
| `backend/src/services/optimizer_nodes.py` | Nodos del grafo optimizer |
| `backend/src/services/optimizer_service.py` | Orquestador del grafo |
| `backend/src/api/optimization.py` | Router con endpoints |
| `backend/tests/test_optimizer_service.py` | Tests del grafo |
| `backend/tests/test_optimizer_api.py` | Tests de API |

## Dependencies

- La fase 004 depende de la fase 003 (análisis SEO/GEO/AEO) y de la fase 002 (ingestión de URLs).
- Requiere `GEMINI_API_KEY` y `SERPER_API_KEY` en el entorno.

## Decisiones técnicas

1. **Serper API**: Se usa para búsqueda web que informa las decisiones de optimización. La key se configura via `SERPER_API_KEY`.
2. **Gemini**: Se usa para planificar y aplicar los cambios de optimización.
3. **HTML optimizado completo**: Se genera el HTML completo optimizado para copiar/pegar.
4. **Fragmentos de código**: Cada cambio se devuelve como snippet listo para copiar.
5. **Persistencia**: Los resultados se guardan en `url_optimizations` para consulta posterior.