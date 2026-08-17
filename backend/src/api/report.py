"""PDF report export endpoint.

One read-only route. The export creates no server state and persists nothing, so
it is a GET: linkable, retryable, and usable directly as a browser download
target.

Authorization note: this endpoint carries no auth dependency, matching
``GET /api/v1/analyze/{id}`` and ``GET /api/v1/optimize/{id}``. FR-022 requires
the export be subject to "the same authorization as viewing the analysis itself",
and it exposes no data those endpoints do not already return — only a different
format for it. This is a recorded deviation from Constitution Principle V
(see the plan's Complexity Tracking); when repo-wide authentication lands, this
route must adopt the same dependency as its siblings in the same change.
"""

import logging
import time
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_session
from src.services.pdf_renderer import pdf_renderer
from src.services.report_service import (
    AnalysisNotExportableError,
    AnalysisNotFoundError,
    ReportService,
    report_filename,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/v1', tags=['report'])

TEMPLATE_NAME = 'report.html.j2'
STYLESHEET_NAME = 'report.css'


def _content_disposition(filename: str) -> str:
    """Send both the ASCII and the RFC 5987 form so non-Latin URLs survive."""
    return f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}"


@router.get(
    '/report/{analysis_id}/pdf',
    response_class=Response,
    responses={
        200: {
            'content': {'application/pdf': {}},
            'description': 'The generated PDF report.',
        },
        404: {'description': 'No analysis exists with this id.'},
        409: {'description': 'The analysis exists but is not in a completed state.'},
        500: {'description': 'Report generation failed.'},
    },
)
async def export_report_pdf(
    analysis_id: int,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Generate and return the PDF report for one completed analysis."""
    started = time.perf_counter()
    service = ReportService(session)

    try:
        document = await service.load_document(analysis_id)
    except AnalysisNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AnalysisNotExportableError as exc:
        # Deliberately 409, not 404: FR-016 requires the caller to be able to
        # tell "not found" from "not yet exportable".
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    try:
        html = pdf_renderer.render_html(
            TEMPLATE_NAME,
            {
                'doc': document,
                'stylesheet': pdf_renderer.read_asset(STYLESHEET_NAME),
            },
        )
        # Buffered in full before responding: FR-021 forbids surfacing a partial
        # or corrupt file, so a failure must raise here rather than stream.
        pdf_bytes = await pdf_renderer.render_pdf(html, footer_text=document.url)
    except Exception as exc:
        logger.exception(
            'Report generation failed for analysis %s: %s', analysis_id, exc
        )
        # The underlying error is logged with the request id but never echoed to
        # the client (SC-005: no internal detail in a client-facing surface).
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Report generation failed',
        ) from exc

    filename = report_filename(document.url, document.analysis_date)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    logger.info(
        'Report exported',
        extra={
            'analysis_id': analysis_id,
            'findings': document.total_findings,
            'recommendations': document.total_recommendations,
            'has_optimizer': document.optimizer is not None,
            'bytes': len(pdf_bytes),
            'duration_ms': elapsed_ms,
        },
    )

    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={
            'Content-Disposition': _content_disposition(filename),
            'Content-Length': str(len(pdf_bytes)),
        },
    )
