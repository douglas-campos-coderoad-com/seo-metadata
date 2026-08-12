# Colección Postman - SEO Metadata Platform

Base URL: `http://localhost:8000`

---

## 1. Health Check

**GET** `/api/v1/health`

Sin body.

---

## 2. Ingest

### 2.1 Ingest URL

**POST** `/api/v1/ingest/url`

**Body (JSON):**
```json
{
  "url": "https://www.incollect.com/listing/873915"
}
```

**Respuesta 200:**
```json
{
  "id": 1,
  "url": "https://www.incollect.com/listing/873915",
  "status": "success",
  "html_size_bytes": 125000,
  "http_status": 200,
  "content_type": "text/html",
  "created_at": "2026-08-11T12:00:00Z"
}
```

### 2.2 Get Ingested URL

**GET** `/api/v1/ingest/url/{url_id}`

Sin body.

### 2.3 List Ingested URLs

**GET** `/api/v1/ingest/urls?skip=0&limit=100`

Sin body.

---

## 3. Analysis

### 3.1 Analyze URL

**POST** `/api/v1/analyze/{ingested_url_id}`

Sin body.

**Respuesta 200:**
```json
{
  "id": 1,
  "ingested_url_id": 1,
  "url": "https://www.incollect.com/listing/873915",
  "seo_score": 55,
  "geo_score": 30,
  "overall_score": 42,
  "status": "completed",
  "analysis": {
    "findings": [...],
    "recommendations": [...],
    "json_ld": {...}
  },
  "created_at": "2026-08-11T12:00:00Z"
}
```

### 3.2 Get Analysis

**GET** `/api/v1/analyze/{ingested_url_id}`

Sin body.

---

## 4. Optimization

### 4.1 Optimize Analysis

**POST** `/api/v1/optimize/{analysis_id}`

Sin body.

**Respuesta 200:**
```json
{
  "id": 1,
  "analysis_id": 1,
  "optimized_html": "<!DOCTYPE html>...",
  "optimized_json_ld": {...},
  "optimized_content": {...},
  "changes": [...],
  "score_before": {"seo": 55, "geo": 30, "overall": 42},
  "score_after_estimated": {"seo": 85, "geo": 80, "overall": 82},
  "status": "completed",
  "error": null,
  "created_at": "2026-08-11T12:00:00Z"
}
```

### 4.2 Get Optimization

**GET** `/api/v1/optimize/{analysis_id}`

Sin body.

---

## 5. GEO/AEO Motor (Nuevo)

### 5.1 GEO Optimize

**POST** `/api/v1/geo/optimize/{analysis_id}`

Sin body.

**Respuesta 200:**
```json
{
  "analysis_id": 1,
  "optimized_html": "<!DOCTYPE html>...",
  "optimized_json_ld": {...},
  "optimized_content": {
    "optimized_title": "...",
    "optimized_meta_description": "...",
    "geo_content": "...",
    "alt_texts": {...},
    "qa_pairs": [...],
    "fact_density_score": 75
  },
  "changes": [...],
  "score_before": {"seo": 55, "geo": 30, "overall": 42},
  "score_after_estimated": {"seo": 85, "geo": 80, "overall": 82},
  "status": "completed",
  "error": null
}
```

### 5.2 GEO Score (Calculadora de GEO Citation Score)

**POST** `/api/v1/geo/score/{analysis_id}`

Sin body.

**Respuesta 200:**
```json
{
  "total_score": 46,
  "dimensions": {
    "fact_density": {"score": 0, "weight": 0.25, "facts_found": 0},
    "aeo_structure": {"score": 25, "weight": 0.25, "qa_pairs": 0},
    "entity_coverage": {"score": 60, "weight": 0.25, "entities": 1},
    "json_ld_validity": {"score": 100, "weight": 0.25}
  },
  "summary": {
    "fact_density": 0,
    "aeo_structure": 25,
    "entity_coverage": 60,
    "json_ld_validity": 100
  },
  "has_optimization": true
}
```

### 5.3 GEO ROI (Calculadora de Impacto Financiero en IA)

**POST** `/api/v1/geo/roi`

**Body (JSON):**
```json
{
  "monthly_organic_traffic": 10000,
  "generative_search_share": 0.10,
  "current_geo_score": 30,
  "improved_geo_score": 80,
  "products_count": 100,
  "cost_per_product": 0.03,
  "conversion_rate": 0.02,
  "avg_order_value": 500.0
}
```

**Respuesta 200:**
```json
{
  "inputs": {
    "monthly_organic_traffic": 10000,
    "generative_search_share": 0.1,
    "current_geo_score": 30,
    "improved_geo_score": 80,
    "products_count": 100,
    "cost_per_product": 0.03,
    "conversion_rate": 0.02,
    "avg_order_value": 500.0
  },
  "ai_traffic": {
    "current": 300,
    "improved": 800,
    "incremental": 500
  },
  "revenue": {
    "current": 3000.0,
    "improved": 8000.0,
    "incremental": 5000.0
  },
  "costs": {
    "ai_api_cost": 3.0
  },
  "roi": {
    "net_savings": 4997.0,
    "roi_percentage": 166566.7
  }
}
```

### 5.4 GEO Simulate (Simulador de Citas LLM)

**POST** `/api/v1/geo/simulate/{analysis_id}`

**Body (JSON):**
```json
{
  "query": "Recomiéndame obras de arte contemporáneo"
}
```

**Respuesta 200:**
```json
{
  "cited": true,
  "confidence": 0.85,
  "quote": "Sax Berlin - Banksy On The Grave Yard Shift. Fixing the Acetate offered by White Court Art on InCollect",
  "response_snippet": "Si buscas obras de arte contemporáneo interesantes, te recomiendo \"Sax Berlin - Banksy On The Grave Yard Shift. Fixing the Acetate\", una pieza ofrecida por White Court Art disponible en InCollect.",
  "reason": "El contenido proporciona información suficiente y estructurada del producto...",
  "query": "Recomiéndame obras de arte contemporáneo"
}
```

---

## Flujo de uso recomendado

1. **Ingerir URL**: `POST /api/v1/ingest/url` → obtén `id`
2. **Analizar**: `POST /api/v1/analyze/{id}` → obtén `analysis_id`
3. **Optimizar**: `POST /api/v1/optimize/{analysis_id}` → obtén HTML optimizado
4. **GEO Optimize**: `POST /api/v1/geo/optimize/{analysis_id}` → obtén contenido GEO/AEO
5. **GEO Score**: `POST /api/v1/geo/score/{analysis_id}` → obtén el GEO Citation Score (0-100)
6. **ROI**: `POST /api/v1/geo/roi` → estima el impacto financiero en IA
7. **Simular**: `POST /api/v1/geo/simulate/{analysis_id}` → evalúa citabilidad LLM

---

## Notas

- Base URL: `http://localhost:8000`
- Headers: `Content-Type: application/json` cuando corresponda
- No requiere autenticación en este momento
- Los endpoints de GEO usan Gemini para generar resultados