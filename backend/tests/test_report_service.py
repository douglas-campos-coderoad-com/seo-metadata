"""Unit tests for the report view-model builder.

``build_report_document`` is deliberately pure — no browser, no I/O — which is
what lets every edge case in the spec be covered here in milliseconds instead of
inside an expensive Chromium render (research.md section 8).
"""

from datetime import datetime

import pytest

from src.schemas.report import ReportDocument
from src.services.report_mappings import Severity
from src.services.report_service import (
    MAX_CODE_CHARS,
    build_report_document,
    report_filename,
)


class _Row:
    """Minimal stand-in for a SQLAlchemy row; the builder only reads attributes."""

    def __init__(self, **kwargs: object) -> None:
        for key, value in kwargs.items():
            setattr(self, key, value)


def _analysis(analysis: object = None, **overrides: object) -> _Row:
    defaults: dict[str, object] = {
        'id': 1,
        'seo_score': 70,
        'geo_score': 60,
        'overall_score': 65,
        'analysis': analysis,
        'status': 'completed',
        'created_at': datetime(2026, 8, 16, 10, 30),
    }
    defaults.update(overrides)
    return _Row(**defaults)


def _url(url: str = 'https://example.com/products/chair') -> _Row:
    return _Row(id=1, url=url)


FULL_ANALYSIS: dict[str, object] = {
    'geo_visibility': 'The page is moderately citable by generative engines.',
    'seo_breakdown': {'title': 10, 'meta_description': 0, 'json_ld': 15},
    'geo_breakdown': {'question_answering': 12, 'llm_citability': 5},
    'findings': [
        {
            'id': 'F1',
            'category': 'metadata',
            'severity': 'critical',
            'status': 'fail',
            'title': 'Meta description missing',
            'detail': 'No meta description element is present.',
        },
        {
            'id': 'F2',
            'category': 'structured_data',
            'severity': 'low',
            'status': 'warning',
            'title': 'JSON-LD lacks an offers block',
            'detail': 'Product schema present but incomplete.',
        },
    ],
    'recommendations': [
        {
            'id': 'R1',
            'finding_id': 'F1',
            'category': 'metadata',
            'priority': 'high',
            'effort': 'low',
            'action': 'Add a meta description.',
            'rationale': 'Improves click-through and LLM citability.',
            'html_change': {
                'change_type': 'add',
                'location': 'inside <head>',
                'current_html': '',
                'suggested_html': '<meta name="description" content="A chair.">',
            },
        },
        {
            'id': 'R2',
            'finding_id': 'F2',
            'category': 'structured_data',
            'priority': 'medium',
            'effort': 'medium',
            'action': 'Add an offers block.',
            'rationale': 'Enables rich results.',
            'html_change': {
                'change_type': 'modify',
                'location': 'the JSON-LD script',
                'current_html': '{"@type":"Product"}',
                'suggested_html': '{"@type":"Product","offers":{}}',
            },
        },
    ],
}


# ---------------------------------------------------------------------------
# T014 - core view-model construction
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_scores_and_metadata_are_carried_through() -> None:
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url())

    assert isinstance(doc, ReportDocument)
    assert doc.url == 'https://example.com/products/chair'
    assert doc.analysis_date_display == '2026-08-16'
    assert (doc.seo_score, doc.geo_score, doc.overall_score) == (70, 60, 65)
    assert doc.geo_visibility.startswith('The page is moderately citable')


@pytest.mark.unit
def test_breakdowns_carry_rubric_maximums_not_llm_values() -> None:
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url())

    seo = {d.key: d for d in doc.seo_breakdown}
    assert seo['title'].max_score == 15
    assert seo['title'].score == 10
    assert seo['meta_description'].score == 0
    assert seo['json_ld'].ratio == 1.0
    assert seo['title'].label == 'Title'

    geo = {d.key: d for d in doc.geo_breakdown}
    assert geo['question_answering'].max_score == 20


@pytest.mark.unit
def test_every_finding_and_recommendation_survives() -> None:
    """SC-002 makes any omission a defect."""
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url())

    assert doc.total_findings == 2
    assert doc.total_recommendations == 2
    titles = {f.title for group in doc.finding_groups for f in group.findings}
    assert titles == {'Meta description missing', 'JSON-LD lacks an offers block'}


@pytest.mark.unit
def test_recommendations_are_joined_to_their_finding() -> None:
    """FR-009: a reader must see which problem each fix addresses."""
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url())
    by_ref = {f.ref: f for group in doc.finding_groups for f in group.findings}

    assert len(by_ref['F1'].recommendations) == 1
    assert by_ref['F1'].recommendations[0].ref == 'R1'
    assert by_ref['F1'].recommendations[0].resolves_ref == 'F1'
    assert len(by_ref['F2'].recommendations) == 1
    assert by_ref['F2'].recommendations[0].action == 'Add an offers block.'
    assert doc.orphan_recommendations == []


@pytest.mark.unit
def test_multiple_recommendations_for_one_finding_all_survive() -> None:
    """Two genuinely separate fixes for the same finding must both attach — neither
    the backend's old "first wins" nor the frontend's old "last wins" behavior."""
    analysis = {
        'findings': [
            {'id': 'F1', 'category': 'metadata', 'severity': 'critical', 'title': 'Missing meta description'},
        ],
        'recommendations': [
            {'id': 'R1', 'finding_id': 'F1', 'action': 'Add a meta description tag.'},
            {'id': 'R2', 'finding_id': 'F1', 'action': 'Also add an og:description tag.'},
        ],
    }
    doc = build_report_document(_analysis(analysis), _url())
    by_ref = {f.ref: f for group in doc.finding_groups for f in group.findings}

    assert len(by_ref['F1'].recommendations) == 2
    assert {r.action for r in by_ref['F1'].recommendations} == {
        'Add a meta description tag.',
        'Also add an og:description tag.',
    }
    assert doc.orphan_recommendations == []
    assert doc.total_recommendations == 2


@pytest.mark.unit
def test_findings_are_grouped_by_category_in_fixed_order() -> None:
    """FR-012, and SC-007: order must not depend on LLM output ordering."""
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url())

    assert [g.category for g in doc.finding_groups] == ['metadata', 'structured_data']
    assert [g.label for g in doc.finding_groups] == ['Metadata', 'Structured data']
    assert all(g.findings for g in doc.finding_groups), 'empty groups must not be emitted'


@pytest.mark.unit
def test_severity_is_collapsed_and_coloured() -> None:
    """FR-013 - critical stays critical, low becomes warning."""
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url())
    by_ref = {f.ref: f for group in doc.finding_groups for f in group.findings}

    assert by_ref['F1'].severity is Severity.CRITICAL
    assert by_ref['F1'].severity_color == 'hsl(0 60% 48%)'
    assert by_ref['F1'].severity_label == 'Critical'
    assert by_ref['F2'].severity is Severity.WARNING


@pytest.mark.unit
def test_html_change_splits_current_and_suggested() -> None:
    """FR-008 - both markup blocks must be distinct and present."""
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url())
    by_ref = {f.ref: f for group in doc.finding_groups for f in group.findings}

    change = by_ref['F2'].recommendations[0].html_change
    assert change.location == 'the JSON-LD script'
    assert change.current_markup == '{"@type":"Product"}'
    assert change.suggested_markup == '{"@type":"Product","offers":{}}'
    assert change.current_is_absent is False


@pytest.mark.unit
def test_filename_derives_from_url_and_analysis_date() -> None:
    """FR-017."""
    name = report_filename('https://example.com/products/chair?ref=x', datetime(2026, 8, 16))
    assert name == 'seo-report_example-com-products-chair_2026-08-16.pdf'


@pytest.mark.unit
def test_filename_is_bounded_and_safe_for_odd_urls() -> None:
    name = report_filename('https://例え.jp/' + 'a' * 300, datetime(2026, 1, 2))
    assert name.endswith('_2026-01-02.pdf')
    assert len(name) < 130
    assert '/' not in name and ' ' not in name


# ---------------------------------------------------------------------------
# T015 - edge cases (FR-018, SC-008, spec Edge Cases)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_analysis_with_no_findings_still_produces_a_report() -> None:
    doc = build_report_document(_analysis({'findings': [], 'recommendations': []}), _url())

    assert doc.has_no_issues is True
    assert doc.finding_groups == []
    assert doc.total_findings == 0


@pytest.mark.unit
def test_null_analysis_column_on_a_completed_row() -> None:
    doc = build_report_document(_analysis(None), _url())

    assert doc.has_no_issues is True
    assert doc.overall_score == 65


@pytest.mark.unit
def test_plain_string_findings_render_as_text() -> None:
    """FR-018 - the analyser's own error path writes exactly this shape."""
    doc = build_report_document(
        _analysis({'findings': ['Error during analysis: boom'], 'recommendations': []}),
        _url(),
    )

    findings = [f for group in doc.finding_groups for f in group.findings]
    assert len(findings) == 1
    assert 'Error during analysis: boom' in (findings[0].detail or findings[0].title)
    assert '{' not in findings[0].title, 'must not leak raw object syntax'


@pytest.mark.unit
def test_plain_string_recommendations_render_as_text() -> None:
    doc = build_report_document(
        _analysis({'findings': [], 'recommendations': ['Add a meta description']}),
        _url(),
    )

    assert len(doc.orphan_recommendations) == 1
    assert doc.orphan_recommendations[0].action == 'Add a meta description'


@pytest.mark.unit
def test_recommendation_with_unknown_finding_id_is_kept() -> None:
    """SC-002 - never dropped, even when the join fails."""
    doc = build_report_document(
        _analysis(
            {
                'findings': [{'id': 'F1', 'category': 'content', 'title': 'A'}],
                'recommendations': [{'id': 'R9', 'finding_id': 'F404', 'action': 'Do a thing'}],
            }
        ),
        _url(),
    )

    assert [r.ref for r in doc.orphan_recommendations] == ['R9']
    assert doc.total_recommendations == 1


@pytest.mark.unit
def test_recommendation_without_html_change_renders_no_code_block() -> None:
    doc = build_report_document(
        _analysis(
            {
                'findings': [{'id': 'F1', 'category': 'content', 'title': 'A'}],
                'recommendations': [{'id': 'R1', 'finding_id': 'F1', 'action': 'Do a thing'}],
            }
        ),
        _url(),
    )
    finding = doc.finding_groups[0].findings[0]

    assert len(finding.recommendations) == 1
    assert finding.recommendations[0].html_change is None


@pytest.mark.unit
def test_absent_element_is_labelled_not_rendered_as_an_empty_block() -> None:
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url())
    by_ref = {f.ref: f for group in doc.finding_groups for f in group.findings}
    change = by_ref['F1'].recommendations[0].html_change

    assert change.current_markup is None
    assert change.current_is_absent is True
    assert change.suggested_markup is not None


@pytest.mark.unit
def test_unknown_severity_and_category_fall_back() -> None:
    doc = build_report_document(
        _analysis(
            {
                'findings': [
                    {'id': 'F1', 'category': 'quantum', 'severity': 'apocalyptic', 'title': 'A'}
                ],
                'recommendations': [],
            }
        ),
        _url(),
    )
    finding = doc.finding_groups[0].findings[0]

    assert finding.category == 'content'
    assert finding.severity is Severity.WARNING


@pytest.mark.unit
def test_oversized_markup_is_truncated_and_says_so() -> None:
    """research.md section 10 - never silently, always with a visible count."""
    huge = 'x' * (MAX_CODE_CHARS + 500)
    doc = build_report_document(
        _analysis(
            {
                'findings': [{'id': 'F1', 'category': 'content', 'title': 'A'}],
                'recommendations': [
                    {
                        'id': 'R1',
                        'finding_id': 'F1',
                        'action': 'Replace',
                        'html_change': {
                            'change_type': 'modify',
                            'location': 'body',
                            'current_html': 'small',
                            'suggested_html': huge,
                        },
                    }
                ],
            }
        ),
        _url(),
    )
    change = doc.finding_groups[0].findings[0].recommendations[0].html_change

    assert change.suggested_markup is not None
    assert len(change.suggested_markup) == MAX_CODE_CHARS
    assert change.suggested_truncated_chars == 500
    assert change.current_truncated_chars == 0


@pytest.mark.unit
def test_findings_and_recommendations_are_never_dropped_at_scale() -> None:
    """A very large analysis must stay complete (spec Edge Cases, SC-002)."""
    findings = [
        {'id': f'F{i}', 'category': 'content', 'severity': 'high', 'title': f'Finding {i}'}
        for i in range(250)
    ]
    recs = [
        {'id': f'R{i}', 'finding_id': f'F{i}', 'action': f'Fix {i}'} for i in range(250)
    ]
    doc = build_report_document(
        _analysis({'findings': findings, 'recommendations': recs}), _url()
    )

    assert doc.total_findings == 250
    assert doc.total_recommendations == 250


@pytest.mark.unit
def test_non_latin_and_emoji_survive_unchanged() -> None:
    doc = build_report_document(
        _analysis(
            {
                'findings': [
                    {'id': 'F1', 'category': 'content', 'title': '标题过短 🚀', 'detail': 'مرحبا'}
                ],
                'recommendations': [],
            }
        ),
        _url('https://例え.jp/商品'),
    )
    finding = doc.finding_groups[0].findings[0]

    assert finding.title == '标题过短 🚀'
    assert finding.detail == 'مرحبا'


@pytest.mark.unit
def test_building_twice_gives_identical_content() -> None:
    """SC-007 - regenerating an unchanged analysis must reproduce the report."""
    first = build_report_document(_analysis(FULL_ANALYSIS), _url())
    second = build_report_document(_analysis(FULL_ANALYSIS), _url())

    assert first.model_dump() == second.model_dump()


# ---------------------------------------------------------------------------
# T032 (US2) - optimizer section
# ---------------------------------------------------------------------------


def _optimization(status: str = 'completed') -> _Row:
    return _Row(
        id=1,
        analysis_id=1,
        optimized_html='<html><head><title>Better</title></head></html>',
        optimized_json_ld={'@type': 'Product', 'name': 'Chair'},
        score_before={'seo': 70, 'geo': 60},
        score_after_estimated={'seo': 88, 'geo': 82},
        status=status,
    )


@pytest.mark.unit
def test_completed_optimization_becomes_a_section() -> None:
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url(), _optimization())

    assert doc.optimizer is not None
    assert doc.optimizer.optimized_html is not None
    assert '"@type": "Product"' in (doc.optimizer.optimized_json_ld or '')
    assert doc.optimizer.score_before == {'seo': 70, 'geo': 60}
    assert doc.optimizer.score_after == {'seo': 88, 'geo': 82}
    assert doc.optimizer.has_scores is True


@pytest.mark.unit
@pytest.mark.parametrize('status', ['failed', 'pending', 'running'])
def test_non_completed_optimization_is_treated_as_absent(status: str) -> None:
    """US2 scenario 3 - a failed optimization must be indistinguishable from none."""
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url(), _optimization(status))

    assert doc.optimizer is None


@pytest.mark.unit
def test_absent_optimization_leaves_the_report_complete() -> None:
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url(), None)

    assert doc.optimizer is None
    assert doc.total_findings == 2


@pytest.mark.unit
def test_optimizer_html_is_truncated_like_any_other_markup() -> None:
    optimization = _optimization()
    optimization.optimized_html = 'y' * (MAX_CODE_CHARS + 42)
    doc = build_report_document(_analysis(FULL_ANALYSIS), _url(), optimization)

    assert doc.optimizer is not None
    assert doc.optimizer.optimized_html_truncated_chars == 42
