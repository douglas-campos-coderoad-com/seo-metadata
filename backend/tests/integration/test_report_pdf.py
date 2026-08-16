"""Integration tests: the real Chromium render.

These are the expensive tests, so they stay few and assert the things that only a
real render can prove — that the text is genuinely text, that the page furniture
appears, and that two renders agree. Every data-shape edge case lives in
tests/test_report_service.py, where it runs without a browser.
"""

import io

import pytest
import pytest_asyncio
from pypdf import PdfReader

from src.models import IngestedUrl, UrlAnalysis, UrlOptimization

ANALYSIS_JSON = {
    'geo_visibility': 'The page is moderately citable by generative engines.',
    'seo_breakdown': {'title': 10, 'meta_description': 0, 'json_ld': 15},
    'geo_breakdown': {'question_answering': 12, 'llm_citability': 5},
    'findings': [
        {
            'id': 'F1',
            'category': 'metadata',
            'severity': 'critical',
            'title': 'Meta description missing',
            'detail': 'No meta description element is present.',
        },
        {
            'id': 'F2',
            'category': 'structured_data',
            'severity': 'low',
            'title': 'JSON-LD lacks an offers block',
            'detail': 'Product schema present but incomplete.',
        },
        {
            'id': 'F3',
            'category': 'images',
            'severity': 'medium',
            'title': 'Images missing alt text',
            'detail': 'Four images have no alt attribute.',
        },
    ],
    'recommendations': [
        {
            'id': 'R1',
            'finding_id': 'F1',
            'priority': 'high',
            'effort': 'low',
            'action': 'Add a meta description.',
            'rationale': 'Improves click-through and LLM citability.',
            'html_change': {
                'change_type': 'add',
                'location': 'inside <head>',
                'current_html': '',
                'suggested_html': '<meta name="description" content="Handmade oak chair.">',
            },
        },
        {
            'id': 'R2',
            'finding_id': 'F2',
            'priority': 'medium',
            'effort': 'medium',
            'action': 'Add an offers block to the product schema.',
            'rationale': 'Enables rich results.',
            'html_change': {
                'change_type': 'modify',
                'location': 'the JSON-LD script',
                'current_html': '{"@type":"Product"}',
                'suggested_html': '{"@type":"Product","offers":{"@type":"Offer"}}',
            },
        },
    ],
}

URL = 'https://example.com/products/oak-chair'


def extract_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return '\n'.join(page.extract_text() or '' for page in reader.pages)


def squash(value: str) -> str:
    """Strip all whitespace for comparison.

    Chromium emits per-glyph kerning offsets, and pypdf turns a large enough
    offset into a space — so a correctly rendered "Structured data" extracts as
    "Structur ed data". The text in the PDF is right and copies correctly in a
    viewer; only the extraction heuristic inserts the break. Comparing without
    whitespace still proves the content is present *as real text*, which is what
    these assertions are actually about.
    """
    return ''.join(value.split())


def contains(haystack: str, needle: str) -> bool:
    """Whitespace-insensitive containment — see squash()."""
    return squash(needle) in squash(haystack)


def page_count(pdf_bytes: bytes) -> int:
    return len(PdfReader(io.BytesIO(pdf_bytes)).pages)


async def _seed(session_factory, *, analysis_json=ANALYSIS_JSON, optimization_status=None):
    async with session_factory() as session:
        url = IngestedUrl(url=URL, html='<html></html>')
        session.add(url)
        await session.commit()
        await session.refresh(url)

        analysis = UrlAnalysis(
            ingested_url_id=url.id,
            seo_score=72,
            geo_score=58,
            overall_score=65,
            analysis=analysis_json,
            status='completed',
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)

        if optimization_status is not None:
            session.add(
                UrlOptimization(
                    analysis_id=analysis.id,
                    optimized_html='<html><head><title>Handmade oak chair</title></head></html>',
                    optimized_json_ld={'@type': 'Product', 'name': 'Oak chair'},
                    score_before={'seo': 72, 'geo': 58},
                    score_after_estimated={'seo': 91, 'geo': 84},
                    status=optimization_status,
                )
            )
            await session.commit()

        return analysis.id


@pytest_asyncio.fixture
async def analysis_id(db_session_factory):
    return await _seed(db_session_factory)


# ---------------------------------------------------------------------------
# T016 (US1)
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_render_produces_a_valid_multipage_pdf(client, analysis_id):
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')

    assert response.status_code == 200
    assert response.content.startswith(b'%PDF')
    # Cover page plus at least one content page.
    assert page_count(response.content) >= 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_every_finding_and_recommendation_appears(client, analysis_id):
    """SC-002 — an automated comparison must find no omissions."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    text = extract_text(response.content)

    for finding in ANALYSIS_JSON['findings']:
        assert contains(text, finding['title']), f'finding missing from PDF: {finding["title"]}'
    for rec in ANALYSIS_JSON['recommendations']:
        assert contains(text, rec['action']), f'recommendation missing from PDF: {rec["action"]}'


@pytest.mark.integration
@pytest.mark.asyncio
async def test_text_is_selectable_not_rasterised(client, analysis_id):
    """C3 — the report's whole value is copy-paste-able markup."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    text = extract_text(response.content)

    assert len(text.strip()) > 400, 'little or no extractable text: the render rasterised'
    assert contains(text, 'meta name="description"'), 'suggested markup must be real, copyable text'


@pytest.mark.integration
@pytest.mark.asyncio
async def test_both_markup_blocks_are_present_and_distinct(client, analysis_id):
    """FR-008."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    text = extract_text(response.content)

    assert contains(text, '{"@type":"Product"}'), 'current markup missing'
    assert contains(text, '"offers"'), 'suggested markup missing'
    assert contains(text, 'the JSON-LD script'), 'change location missing'
    # The addition case is labelled rather than shown as an empty block.
    assert contains(text, 'does not exist yet')


@pytest.mark.integration
@pytest.mark.asyncio
async def test_scores_and_breakdowns_appear(client, analysis_id):
    """FR-003, FR-004."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    text = extract_text(response.content)

    assert '72' in text and '58' in text and '65' in text
    assert contains(text, 'Meta description')
    assert contains(text, 'Question answering')
    assert contains(text, 'moderately citable')  # FR-005


@pytest.mark.integration
@pytest.mark.asyncio
async def test_two_renders_produce_identical_text(client, analysis_id):
    """SC-007 — content equivalence, not byte equality: Chromium stamps a
    creation date into every PDF, so the bytes legitimately differ."""
    first = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    second = await client.get(f'/api/v1/report/{analysis_id}/pdf')

    assert extract_text(first.content) == extract_text(second.content)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_no_internal_identifiers_leak_into_the_document(client, analysis_id):
    """SC-005 — the report must be sendable to a client unedited."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    text = extract_text(response.content).lower()

    for leak in ['traceback', 'sqlalchemy', 'ingested_url_id', 'analysis_id', 'none']:
        assert leak not in text, f'internal detail leaked into the report: {leak}'


@pytest.mark.integration
@pytest.mark.asyncio
async def test_empty_analysis_states_no_issues_rather_than_blank(client, db_session_factory):
    """Spec Edge Cases — never a blank section."""
    empty_id = await _seed(
        db_session_factory, analysis_json={'findings': [], 'recommendations': []}
    )
    response = await client.get(f'/api/v1/report/{empty_id}/pdf')
    text = extract_text(response.content)

    assert response.status_code == 200
    assert contains(text, 'No issues were detected')


@pytest.mark.integration
@pytest.mark.asyncio
async def test_legacy_plain_string_findings_render_as_text(client, db_session_factory):
    """FR-018 — the analyser's own error path stores exactly this."""
    legacy_id = await _seed(
        db_session_factory,
        analysis_json={'findings': ['Error during analysis: boom'], 'recommendations': []},
    )
    response = await client.get(f'/api/v1/report/{legacy_id}/pdf')
    text = extract_text(response.content)

    assert response.status_code == 200
    assert contains(text, 'Error during analysis: boom')
    assert "{'" not in text, 'raw object syntax must never reach the document'


@pytest.mark.integration
@pytest.mark.asyncio
async def test_non_latin_and_emoji_render_without_tofu(client, db_session_factory):
    """Spec Edge Cases — requires the Noto fonts added to the image."""
    unicode_id = await _seed(
        db_session_factory,
        analysis_json={
            'findings': [
                {
                    'id': 'F1',
                    'category': 'content',
                    'severity': 'high',
                    'title': '标题过短',
                    'detail': 'Заголовок слишком короткий',
                }
            ],
            'recommendations': [],
        },
    )
    response = await client.get(f'/api/v1/report/{unicode_id}/pdf')
    text = extract_text(response.content)

    assert response.status_code == 200
    assert contains(text, '标题过短'), 'CJK glyphs missing — are fonts-noto-core installed?'
    assert contains(text, 'Заголовок')


@pytest.mark.integration
@pytest.mark.asyncio
async def test_oversized_markup_is_truncated_visibly(client, db_session_factory):
    """research.md section 10 — bounded, but never silently."""
    from src.services.report_service import MAX_CODE_CHARS

    big_id = await _seed(
        db_session_factory,
        analysis_json={
            'findings': [{'id': 'F1', 'category': 'content', 'title': 'Huge markup'}],
            'recommendations': [
                {
                    'id': 'R1',
                    'finding_id': 'F1',
                    'action': 'Replace the body',
                    'html_change': {
                        'change_type': 'modify',
                        'location': 'body',
                        'current_html': 'small',
                        'suggested_html': 'x' * (MAX_CODE_CHARS + 1234),
                    },
                }
            ],
        },
    )
    response = await client.get(f'/api/v1/report/{big_id}/pdf')
    text = extract_text(response.content)

    assert response.status_code == 200
    assert contains(text, '1234 characters omitted')


@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_exports_do_not_interleave(client, analysis_id):
    """Spec Edge Cases, C6 — each render gets its own browser context."""
    import asyncio

    responses = await asyncio.gather(
        *[client.get(f'/api/v1/report/{analysis_id}/pdf') for _ in range(4)]
    )

    assert all(r.status_code == 200 for r in responses)
    texts = [extract_text(r.content) for r in responses]
    assert all(t == texts[0] for t in texts), 'concurrent renders diverged'


# ---------------------------------------------------------------------------
# T033 (US2) — optimizer sections
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_optimizer_output_is_included_when_completed(client, db_session_factory):
    """FR-010."""
    opt_id = await _seed(db_session_factory, optimization_status='completed')
    response = await client.get(f'/api/v1/report/{opt_id}/pdf')
    text = extract_text(response.content)

    assert contains(text, 'Optimized version')
    assert contains(text, 'Handmade oak chair')
    assert contains(text, '"@type": "Product"')
    assert '91' in text and '84' in text  # after-scores


@pytest.mark.integration
@pytest.mark.asyncio
async def test_report_without_optimization_shows_no_trace_of_it(client, analysis_id):
    """SC-006 — no evidence that a section is missing."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    text = extract_text(response.content).lower()

    assert 'optimiz' not in squash(text).lower()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_failed_optimization_is_indistinguishable_from_none(client, db_session_factory):
    """US2 scenario 3."""
    failed_id = await _seed(db_session_factory, optimization_status='failed')
    response = await client.get(f'/api/v1/report/{failed_id}/pdf')
    text = extract_text(response.content).lower()

    assert response.status_code == 200
    assert 'optimiz' not in squash(text).lower()


# ---------------------------------------------------------------------------
# T038 (US3) — presentation
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_cover_page_carries_url_date_and_overall_score(client, analysis_id):
    """FR-011."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    reader = PdfReader(io.BytesIO(response.content))
    cover = reader.pages[0].extract_text() or ''

    assert contains(cover, URL)
    assert '65' in cover
    assert contains(cover, 'Analysed on')
    assert '20' in cover  # the date


@pytest.mark.integration
@pytest.mark.asyncio
async def test_pages_after_the_cover_carry_page_number_and_url(client, analysis_id):
    """FR-015 — printed pages must stay attributable."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    reader = PdfReader(io.BytesIO(response.content))

    assert len(reader.pages) >= 2
    for index, page in enumerate(reader.pages[1:], start=2):
        content = page.extract_text() or ''
        assert contains(content, URL), f'page {index} does not carry the analysed URL'
        assert contains(content, f'{index} /'), f'page {index} does not carry its page number'


@pytest.mark.integration
@pytest.mark.asyncio
async def test_findings_are_grouped_under_category_headings(client, analysis_id):
    """FR-012."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    text = extract_text(response.content)

    for heading in ['Metadata', 'Structured data', 'Images']:
        assert contains(text, heading), f'category heading missing: {heading}'


@pytest.mark.integration
@pytest.mark.asyncio
async def test_severity_labels_from_the_shared_table_are_rendered(client, analysis_id):
    """FR-013 — the colours are asserted at the source in
    tests/test_report_mappings.py; here we prove the labels reach the page."""
    response = await client.get(f'/api/v1/report/{analysis_id}/pdf')
    text = extract_text(response.content)

    assert contains(text.upper(), 'CRITICAL')
    assert contains(text.upper(), 'MEDIUM')
