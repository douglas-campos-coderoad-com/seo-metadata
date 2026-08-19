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

**Body opcional (JSON):** métricas de negocio para la proyección de ROI. Si no se envían, se usan los valores por defecto.
```json
{
  "metrics": {
    "monthly_organic_traffic": 10000,
    "generative_search_share": 0.20,
    "conversion_rate": 0.015,
    "avg_order_value": 150.0,
    "cost_per_product": 1.0
  }
}
```

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
  "roi_projection": {
    "metrics_used": {
      "monthly_organic_traffic": 10000,
      "generative_search_share": 0.2,
      "conversion_rate": 0.015,
      "avg_order_value": 150.0,
      "cost_per_product": 1.0
    },
    "incremental_traffic_monthly": {
      "seo_traditional": 376,
      "geo_ai": 110,
      "total": 486
    },
    "financial_impact_annual": {
      "incremental_revenue": 13122.0,
      "optimization_cost": 1.0,
      "net_profit": 13121.0,
      "roi_percentage": 1312100.0
    }
  },
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

### 5.1 GEO Score (Calculadora de GEO Citation Score)

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

### 5.2 GEO AEO Live Test (Simulador de Recomendación de IA)

**POST** `/api/v1/geo/aeo-test/{analysis_id}`

**Body (JSON):**
```json
{
  "query": "Recommend a premium dining chair for my living room."
}
```

**Respuesta 200:**
```json
{
  "query": "Recommend a premium dining chair for my living room.",
  "has_optimization": true,
  "before": {
    "response": "Here are some general options for dining chairs...",
    "cited": false,
    "quote": null,
    "reason": "The original content lacks product specifics.",
    "query": "Recommend a premium dining chair for my living room."
  },
  "after": {
    "response": "I recommend the 'Sax Berlin - Banksy On The Grave Yard Shift' walnut chair, 45x45x80 cm, priced at $1,200 USD.",
    "cited": true,
    "quote": "A premium walnut dining chair measuring 45x45x80 cm...",
    "reason": "The optimized content provides fact-dense, structured product details.",
    "query": "Recommend a premium dining chair for my living room."
  }
}
```

### 5.3 GEO Simulate (Simulador de Citas LLM)

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
3. **Optimizar**: `POST /api/v1/optimize/{analysis_id}` → obtén HTML optimizado + `roi_projection`
4. **GEO Score**: `POST /api/v1/geo/score/{analysis_id}` → obtén el GEO Citation Score (0-100)
5. **Simular**: `POST /api/v1/geo/simulate/{analysis_id}` → evalúa citabilidad LLM

---

## Notas

- Base URL: `http://localhost:8000`
- Headers: `Content-Type: application/json` cuando corresponda
- No requiere autenticación en este momento
- Los endpoints de GEO usan Gemini para generar resultados