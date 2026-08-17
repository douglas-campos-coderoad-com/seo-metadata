"""Contract tests for GET /api/v1/report/{analysis_id}/pdf.

These assert the endpoint's observable contract — status codes, headers,
filename, and the rule that an error is never mistakable for a document.
See specs/005-pdf-report-export/contracts/report-api.md.
"""

import re

import pytest
import pytest_asyncio

from src.models import IngestedUrl, UrlAnalysis

ANALYSIS_JSON = {
    'geo_visibility': 'Reasonably citable.',
    'seo_breakdown': {'title': 10, 'json_ld': 15},
    'geo_breakdown': {'question_answering': 12},
    'findings': [
        {
            'id': 'F1',
            'category': 'metadata',
            'severity': 'critical',
            'title': 'Meta description missing',
            'detail': 'No meta description element is present.',
        }
    ],
    'recommendations': [
        {
            'id': 'R1',
            'finding_id': 'F1',
            'priority': 'high',
            'effort': 'low',
            'action': 'Add a meta description.',
            'rationale': 'Improves click-through.',
            'html_change': {
                'change_type': 'add',
                'location': 'inside <head>',
                'current_html': '',
                'suggested_html': '<meta name="description" content="A chair.">',
            },
        }
    ],
}


@pytest_asyncio.fixture
async def seeded(db_session_factory):
    """Insert one completed analysis and one failed one."""
    async with db_session_factory() as session:
        url = IngestedUrl(url='https://example.com/products/chair', html='<html></html>')
        session.add(url)
        await session.commit()
        await session.refresh(url)

        completed = UrlAnalysis(
            ingested_url_id=url.id,
            seo_score=70,
            geo_score=60,
            overall_score=65,
            analysis=ANALYSIS_JSON,
            status='completed',
        )
        failed = UrlAnalysis(
            ingested_url_id=url.id,
            status='failed',
            error='boom',
        )
        session.add_all([completed, failed])
        await session.commit()
        await session.refresh(completed)
        await session.refresh(failed)

        return {'url': url.url, 'completed_id': completed.id, 'failed_id': failed.id}


@pytest.mark.contract
@pytest.mark.asyncio
async def test_returns_a_pdf_for_a_completed_analysis(client, seeded):
    response = await client.get(f'/api/v1/report/{seeded["completed_id"]}/pdf')

    assert response.status_code == 200
    assert response.headers['content-type'] == 'application/pdf'
    assert response.content.startswith(b'%PDF'), 'body must be a real PDF'
    assert int(response.headers['content-length']) == len(response.content)


@pytest.mark.contract
@pytest.mark.asyncio
async def test_filename_derives_from_url_and_date(client, seeded):
    """FR-017 — multiple exports stay distinguishable on disk."""
    response = await client.get(f'/api/v1/report/{seeded["completed_id"]}/pdf')

    disposition = response.headers['content-disposition']
    assert disposition.startswith('attachment;')
    match = re.search(r'filename="([^"]+)"', disposition)
    assert match, disposition
    filename = match.group(1)
    assert filename.startswith('seo-report_example-com-products-chair_')
    assert re.search(r'_\d{4}-\d{2}-\d{2}\.pdf$', filename)
    # RFC 5987 form is also sent so non-Latin URLs survive the round trip.
    assert "filename*=UTF-8''" in disposition


@pytest.mark.contract
@pytest.mark.asyncio
async def test_unknown_analysis_is_404_with_json(client, seeded):
    """US1 scenario 5."""
    response = await client.get('/api/v1/report/999999/pdf')

    assert response.status_code == 404
    assert 'application/json' in response.headers['content-type']
    assert not response.content.startswith(b'%PDF')
    assert 'No analysis found' in response.json()['detail']


@pytest.mark.contract
@pytest.mark.asyncio
async def test_non_completed_analysis_is_409_with_json(client, seeded):
    """US1 scenario 6 — and FR-016's requirement that 'not found' and
    'not yet exportable' be distinguishable."""
    response = await client.get(f'/api/v1/report/{seeded["failed_id"]}/pdf')

    assert response.status_code == 409
    assert 'application/json' in response.headers['content-type']
    assert not response.content.startswith(b'%PDF')

    detail = response.json()['detail']
    assert 'not exportable' in detail
    assert 'failed' in detail


@pytest.mark.contract
@pytest.mark.asyncio
async def test_the_two_error_messages_differ(client, seeded):
    """A single shared message would violate FR-016."""
    not_found = (await client.get('/api/v1/report/999999/pdf')).json()['detail']
    not_ready = (
        await client.get(f'/api/v1/report/{seeded["failed_id"]}/pdf')
    ).json()['detail']

    assert not_found != not_ready


@pytest.mark.contract
@pytest.mark.asyncio
async def test_openapi_documents_the_binary_response(client, seeded):
    """Principle I: the schema is the contract, so it must not claim JSON."""
    schema = (await client.get('/openapi.json')).json()
    operation = schema['paths']['/api/v1/report/{analysis_id}/pdf']['get']

    assert 'application/pdf' in operation['responses']['200']['content']
    assert '404' in operation['responses']
    assert '409' in operation['responses']
