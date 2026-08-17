"""Vocabulary and presentation tables for the exported PDF report.

The analyser and the web UI do not speak the same dialect:

* The analyser prompt (``graph_nodes.py``) emits severity as
  ``critical | high | medium | low`` and nine categories.
* The UI knows only ``good | warning | critical | medium`` and collapses the
  analyser's values at the boundary (``AnalysisApiService.mapSeverity``).

FR-013 requires the report to agree with the *application*, so this module holds
the same collapse and the same colours. FR-012 groups by the *analyser's* nine
categories, which carry more information than the UI's four-way collapse — a
hand-off document should keep that detail.

Parity with the frontend is enforced by ``tests/test_report_mappings.py``.
Change a value here only together with its TypeScript counterpart:

* collapse: ``frontend/src/shared/realtime/AnalysisApiService.ts``
* colours:  ``frontend/src/styles/globals.css``
* labels:   ``frontend/src/shared/lib/severity.ts``
"""

from enum import Enum


class Severity(str, Enum):
    """The four severities the application displays."""

    CRITICAL = 'critical'
    MEDIUM = 'medium'
    WARNING = 'warning'
    GOOD = 'good'


#: Raw analyser severity -> displayed severity. Mirrors ``mapSeverity``.
SEVERITY_COLLAPSE: dict[str, Severity] = {
    'critical': Severity.CRITICAL,
    'high': Severity.CRITICAL,
    'medium': Severity.MEDIUM,
    'low': Severity.WARNING,
    'warning': Severity.WARNING,
    'pass': Severity.GOOD,
    'good': Severity.GOOD,
}

#: Fallback for a missing or unrecognised severity. The analysis JSON is
#: LLM-produced, so an unexpected value must degrade, never raise.
DEFAULT_SEVERITY = Severity.WARNING

#: Background colour per severity, as authored in ``globals.css``.
SEVERITY_COLORS: dict[Severity, str] = {
    Severity.CRITICAL: 'hsl(0 60% 48%)',
    Severity.MEDIUM: 'hsl(22 78% 50%)',
    Severity.WARNING: 'hsl(38 75% 48%)',
    Severity.GOOD: 'hsl(158 45% 38%)',
}

#: Foreground colour that keeps each badge legible on its background.
SEVERITY_TEXT_COLORS: dict[Severity, str] = {
    Severity.CRITICAL: 'hsl(0 0% 100%)',
    Severity.MEDIUM: 'hsl(0 0% 100%)',
    Severity.WARNING: 'hsl(205 70% 9%)',
    Severity.GOOD: 'hsl(0 0% 100%)',
}

#: Human labels, matching ``SEVERITY_LABELS`` in ``severity.ts``.
SEVERITY_LABELS: dict[Severity, str] = {
    Severity.CRITICAL: 'Critical',
    Severity.MEDIUM: 'Medium',
    Severity.WARNING: 'Needs improvement',
    Severity.GOOD: 'Good',
}

#: Worst-first ordering, used to sort findings inside a category group.
SEVERITY_RANK: dict[Severity, int] = {
    Severity.CRITICAL: 0,
    Severity.MEDIUM: 1,
    Severity.WARNING: 2,
    Severity.GOOD: 3,
}

#: The analyser's nine categories and their report headings (FR-012).
CATEGORY_LABELS: dict[str, str] = {
    'metadata': 'Metadata',
    'content': 'Content',
    'headings': 'Headings',
    'structured_data': 'Structured data',
    'geo_aeo': 'Generative and answer engines',
    'images': 'Images',
    'social': 'Social sharing',
    'crawlability': 'Crawlability',
    'performance': 'Performance',
}

DEFAULT_CATEGORY = 'content'

#: Fixed group order, most consequential first. Deliberately not dict iteration
#: order of whatever the LLM happened to emit — SC-007 requires two renders of an
#: unchanged analysis to match, so section order must not depend on input order.
CATEGORY_ORDER: tuple[str, ...] = (
    'metadata',
    'content',
    'headings',
    'structured_data',
    'geo_aeo',
    'images',
    'social',
    'crawlability',
    'performance',
)

#: Maximum points per SEO dimension, from the rubric in ``graph_nodes.py``.
SEO_RUBRIC: dict[str, int] = {
    'title': 15,
    'meta_description': 15,
    'headings': 10,
    'images_alt': 10,
    'opengraph': 10,
    'json_ld': 15,
    'canonical': 5,
    'robots': 5,
    'performance': 5,
    'content': 10,
}

#: Maximum points per GEO dimension, from the same rubric.
GEO_RUBRIC: dict[str, int] = {
    'question_answering': 20,
    'natural_language': 15,
    'completeness': 20,
    'structured_data': 20,
    'llm_citability': 15,
    'featured_snippet': 10,
}

#: Readable names for the breakdown rows (FR-004).
DIMENSION_LABELS: dict[str, str] = {
    'title': 'Title',
    'meta_description': 'Meta description',
    'headings': 'Headings',
    'images_alt': 'Image alt text',
    'opengraph': 'Open Graph and Twitter cards',
    'json_ld': 'JSON-LD structured data',
    'canonical': 'Canonical URL',
    'robots': 'Robots directives',
    'performance': 'Performance signals',
    'content': 'Content quality',
    'question_answering': 'Question answering',
    'natural_language': 'Natural language',
    'completeness': 'Completeness',
    'structured_data': 'Structured data',
    'llm_citability': 'LLM citability',
    'featured_snippet': 'Featured snippet readiness',
}

PRIORITY_LABELS: dict[str, str] = {
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low',
}
DEFAULT_PRIORITY = 'medium'

EFFORT_LABELS: dict[str, str] = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
}
DEFAULT_EFFORT = 'medium'

CHANGE_TYPE_LABELS: dict[str, str] = {
    'add': 'Add',
    'modify': 'Modify',
    'remove': 'Remove',
}


def collapse_severity(raw: str | None) -> Severity:
    """Map an analyser severity onto the severity the application displays."""
    if not raw:
        return DEFAULT_SEVERITY
    return SEVERITY_COLLAPSE.get(raw.strip().lower(), DEFAULT_SEVERITY)


def normalise_category(raw: str | None) -> str:
    """Map an analyser category onto a known category, falling back to content."""
    if not raw:
        return DEFAULT_CATEGORY
    key = raw.strip().lower()
    return key if key in CATEGORY_LABELS else DEFAULT_CATEGORY


def category_label(category: str) -> str:
    """Heading text for a category group."""
    return CATEGORY_LABELS.get(category, CATEGORY_LABELS[DEFAULT_CATEGORY])


def dimension_label(key: str) -> str:
    """Readable name for a score-breakdown row, falling back to the raw key."""
    return DIMENSION_LABELS.get(key, key.replace('_', ' ').capitalize())


def normalise_priority(raw: str | None) -> str:
    if not raw:
        return DEFAULT_PRIORITY
    key = raw.strip().lower()
    return key if key in PRIORITY_LABELS else DEFAULT_PRIORITY


def normalise_effort(raw: str | None) -> str:
    if not raw:
        return DEFAULT_EFFORT
    key = raw.strip().lower()
    return key if key in EFFORT_LABELS else DEFAULT_EFFORT
