"""Parity tests for the report's severity / category vocabulary tables.

FR-013 requires the exported PDF to colour-code severity "using the same severity
meanings the application uses, so a reader moving between the two is never misled".

The application's mapping lives in TypeScript, but the report is rendered
server-side (FR-002), so the table has to be duplicated in Python. This test is
what keeps the two copies honest: without it they diverge silently on the next
frontend change and FR-013 breaks with nothing failing.

Two layers:
  1. Assertions against literal expected values — these ALWAYS run, so the Python
     table can never drift on its own.
  2. Assertions that the TypeScript sources still contain those same values —
     skipped when the frontend tree is not reachable (e.g. inside the API
     container, which only mounts backend/). This is the layer that catches a
     one-sided edit.
"""

import re
from pathlib import Path

import pytest

from src.services.report_mappings import (
    CATEGORY_LABELS,
    DEFAULT_CATEGORY,
    DEFAULT_SEVERITY,
    GEO_RUBRIC,
    SEO_RUBRIC,
    SEVERITY_COLORS,
    SEVERITY_LABELS,
    Severity,
    collapse_severity,
    normalise_category,
)

# --------------------------------------------------------------------------
# Layer 1: the Python table, asserted against literals
# --------------------------------------------------------------------------

# Mirrors mapFindingSeverity (frontend/src/shared/lib/findingMappers.ts).
EXPECTED_COLLAPSE = {
    'critical': Severity.CRITICAL,
    'high': Severity.CRITICAL,
    'medium': Severity.MEDIUM,
    'low': Severity.WARNING,
    'warning': Severity.WARNING,
    'pass': Severity.GOOD,
    'good': Severity.GOOD,
}

# Mirrors the CSS custom properties in frontend/src/styles/globals.css that
# SEVERITY_CLASSES (frontend/src/shared/lib/severity.ts) binds each severity to.
EXPECTED_COLORS = {
    Severity.CRITICAL: '0 60% 48%',   # --destructive
    Severity.MEDIUM: '22 78% 50%',    # --medium
    Severity.WARNING: '38 75% 48%',   # --warning
    Severity.GOOD: '158 45% 38%',     # --success
}

# Mirrors SEVERITY_LABELS in frontend/src/shared/lib/severity.ts.
EXPECTED_LABELS = {
    Severity.CRITICAL: 'Critical',
    Severity.MEDIUM: 'Medium',
    Severity.WARNING: 'Needs improvement',
    Severity.GOOD: 'Good',
}

# The nine categories the analyser prompt is allowed to emit (graph_nodes.py).
EXPECTED_CATEGORIES = {
    'metadata',
    'content',
    'headings',
    'images',
    'structured_data',
    'social',
    'crawlability',
    'performance',
    'geo_aeo',
}


@pytest.mark.unit
@pytest.mark.parametrize('raw,expected', sorted(EXPECTED_COLLAPSE.items()))
def test_severity_collapse_matches_the_application(raw: str, expected: Severity) -> None:
    assert collapse_severity(raw) is expected


@pytest.mark.unit
def test_severity_collapse_is_case_insensitive() -> None:
    assert collapse_severity('CRITICAL') is Severity.CRITICAL
    assert collapse_severity('High') is Severity.CRITICAL


@pytest.mark.unit
@pytest.mark.parametrize('raw', [None, '', 'nonsense', 'blocker'])
def test_unknown_severity_falls_back_rather_than_raising(raw: str | None) -> None:
    """The analysis JSON is LLM-produced; an unexpected value must not break the export.

    Matches the `default:` branch of mapFindingSeverity.
    """
    assert collapse_severity(raw) is DEFAULT_SEVERITY
    assert DEFAULT_SEVERITY is Severity.WARNING


@pytest.mark.unit
def test_every_severity_has_a_colour_and_a_label() -> None:
    for severity in Severity:
        assert severity in SEVERITY_COLORS
        assert severity in SEVERITY_LABELS


@pytest.mark.unit
@pytest.mark.parametrize('severity,triple', sorted(EXPECTED_COLORS.items()))
def test_severity_colours_match_the_application(severity: Severity, triple: str) -> None:
    assert SEVERITY_COLORS[severity] == f'hsl({triple})'


@pytest.mark.unit
@pytest.mark.parametrize('severity,label', sorted(EXPECTED_LABELS.items()))
def test_severity_labels_match_the_application(severity: Severity, label: str) -> None:
    assert SEVERITY_LABELS[severity] == label


@pytest.mark.unit
def test_all_nine_analyser_categories_have_labels() -> None:
    """The report groups by the analyser's own nine categories (FR-012)."""
    assert set(CATEGORY_LABELS) == EXPECTED_CATEGORIES
    for label in CATEGORY_LABELS.values():
        assert label and label[0].isupper()


@pytest.mark.unit
@pytest.mark.parametrize('raw', [None, '', 'unheard-of'])
def test_unknown_category_falls_back(raw: str | None) -> None:
    assert normalise_category(raw) == DEFAULT_CATEGORY
    assert DEFAULT_CATEGORY == 'content'


@pytest.mark.unit
def test_rubric_totals_match_the_analyser_prompt() -> None:
    """Both rubrics are scored out of 100 in graph_nodes.py; a drift here would
    silently render every breakdown bar at the wrong proportion (FR-004, FR-014)."""
    assert sum(SEO_RUBRIC.values()) == 100
    assert sum(GEO_RUBRIC.values()) == 100


# --------------------------------------------------------------------------
# Layer 2: the TypeScript sources still agree with those literals
# --------------------------------------------------------------------------

_FRONTEND = Path(__file__).resolve().parents[2] / 'frontend' / 'src'
_GLOBALS_CSS = _FRONTEND / 'styles' / 'globals.css'
_SEVERITY_TS = _FRONTEND / 'shared' / 'lib' / 'severity.ts'
# mapSeverity moved out of AnalysisApiService.ts into its own module
# (specs/008-project-centric-analysis research.md §6) so both AnalysisApiService and
# the new project-shared-issues grouping (sharedIssues.ts) use the same mapping.
_FINDING_MAPPERS_TS = _FRONTEND / 'shared' / 'lib' / 'findingMappers.ts'

_needs_frontend = pytest.mark.skipif(
    not _GLOBALS_CSS.exists(),
    reason='frontend sources not reachable (expected inside the API container, which mounts backend/ only)',
)

_CSS_TOKEN = {
    Severity.CRITICAL: 'destructive',
    Severity.MEDIUM: 'medium',
    Severity.WARNING: 'warning',
    Severity.GOOD: 'success',
}


@pytest.mark.unit
@_needs_frontend
@pytest.mark.parametrize('severity,triple', sorted(EXPECTED_COLORS.items()))
def test_css_custom_property_still_holds_the_expected_colour(
    severity: Severity, triple: str
) -> None:
    css = _GLOBALS_CSS.read_text(encoding='utf-8')
    match = re.search(rf'--{_CSS_TOKEN[severity]}:\s*([^;]+);', css)
    assert match, f'--{_CSS_TOKEN[severity]} missing from globals.css'
    assert match.group(1).strip() == triple, (
        f'globals.css changed --{_CSS_TOKEN[severity]} to '
        f'{match.group(1).strip()!r}; update SEVERITY_COLORS to match (FR-013)'
    )


@pytest.mark.unit
@_needs_frontend
@pytest.mark.parametrize('severity,label', sorted(EXPECTED_LABELS.items()))
def test_frontend_severity_label_unchanged(severity: Severity, label: str) -> None:
    ts = _SEVERITY_TS.read_text(encoding='utf-8')
    assert f"{severity.value}: '{label}'" in ts, (
        f'severity.ts no longer labels {severity.value!r} as {label!r}; '
        f'update SEVERITY_LABELS to match (FR-013)'
    )


@pytest.mark.unit
@_needs_frontend
def test_frontend_map_severity_cases_are_all_covered() -> None:
    """Every `case '<x>':` inside mapFindingSeverity must exist in our collapse table.

    A new case added on the frontend with no Python counterpart is exactly the
    silent divergence this suite exists to catch.
    """
    ts = _FINDING_MAPPERS_TS.read_text(encoding='utf-8')
    body = ts.split('export function mapFindingSeverity(', 1)
    assert len(body) == 2, 'mapFindingSeverity not found in findingMappers.ts'
    cases = set(re.findall(r"case '([a-z]+)':", body[1].split('\n}', 1)[0]))
    unknown = cases - set(EXPECTED_COLLAPSE)
    assert not unknown, (
        f'findingMappers.mapFindingSeverity handles {sorted(unknown)} but '
        f'report_mappings.SEVERITY_COLLAPSE does not (FR-013)'
    )
