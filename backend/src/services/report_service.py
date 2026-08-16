"""Compose the PDF report's view model from stored analysis data.

The centre of this module is ``build_report_document``: a **pure function** over
the stored JSON. It performs no I/O and touches no browser, which is what lets
every edge case in the spec be covered by fast unit tests instead of by expensive
Chromium renders.

Everything it reads is untrusted in shape. ``url_analyses.analysis`` is written
from LLM output, and two deviations from the documented shape already exist in
stored data: plain-string findings (the analyser's own error path writes
``[f'Error during analysis: {exc}']``) and a NULL ``analysis`` on a completed
row. Nothing here may raise on malformed input — a defensive fallback is always
preferable to a failed export.
"""

import json
import logging
import os
import re
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import IngestedUrl, UrlAnalysis, UrlOptimization
from src.schemas.report import (
    FindingGroup,
    HtmlChange,
    OptimizerSection,
    ReportDocument,
    ReportFinding,
    ReportRecommendation,
    ScoreDimension,
)
from src.services.report_mappings import (
    CATEGORY_ORDER,
    CHANGE_TYPE_LABELS,
    EFFORT_LABELS,
    GEO_RUBRIC,
    PRIORITY_LABELS,
    SEO_RUBRIC,
    SEVERITY_COLORS,
    SEVERITY_LABELS,
    SEVERITY_RANK,
    SEVERITY_TEXT_COLORS,
    category_label,
    collapse_severity,
    dimension_label,
    normalise_category,
    normalise_effort,
    normalise_priority,
)

logger = logging.getLogger(__name__)

EXPORTABLE_STATUS = 'completed'


def _max_code_chars() -> int:
    try:
        value = int(os.getenv('REPORT_MAX_CODE_CHARS', '20000'))
    except ValueError:
        value = 20000
    return max(500, value)


MAX_CODE_CHARS = _max_code_chars()


class AnalysisNotFoundError(Exception):
    """No analysis row with the requested id — maps to 404 (FR-016)."""


class AnalysisNotExportableError(Exception):
    """The analysis exists but is not completed — maps to 409 (FR-016).

    Deliberately distinct from not-found: FR-016 requires the message to
    distinguish "not found" from "not yet exportable".
    """

    def __init__(self, analysis_id: int, status: str) -> None:
        self.analysis_id = analysis_id
        self.status = status
        super().__init__(
            f"Analysis {analysis_id} is not exportable: status is '{status}'. "
            f'Only completed analyses can be exported.'
        )


# ---------------------------------------------------------------------------
# Normalisation helpers (FR-018)
# ---------------------------------------------------------------------------


def _as_dict(raw: Any, text_key: str) -> dict[str, Any]:
    """Coerce one stored record into a dict.

    A plain string becomes ``{text_key: <string>}``. This is not hypothetical:
    legacy rows and the analyser's error path both store bare strings.
    """
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        return {text_key: raw}
    return {}


def _text(value: Any) -> str:
    """Render a stored value as display text without leaking object syntax."""
    if value is None:
        return ''
    if isinstance(value, str):
        return value
    if isinstance(value, int | float | bool):
        return str(value)
    # A nested structure would otherwise print as Python repr in a client-facing
    # document; JSON is at least readable.
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(value)


def _truncate(value: Any) -> tuple[str | None, int]:
    """Bound one markup block, reporting how much was dropped.

    Never silent: the caller renders the omitted count, because SC-005 makes
    invisible truncation a defect (research.md section 10).
    """
    text = _text(value)
    if not text:
        return None, 0
    if len(text) <= MAX_CODE_CHARS:
        return text, 0
    return text[:MAX_CODE_CHARS], len(text) - MAX_CODE_CHARS


def _build_html_change(raw: Any) -> HtmlChange | None:
    """Build the markup block trio, or None when there is no change to show."""
    if not isinstance(raw, dict) or not raw:
        return None

    change_type = str(raw.get('change_type') or 'modify').strip().lower()
    current, current_dropped = _truncate(raw.get('current_html'))
    suggested, suggested_dropped = _truncate(raw.get('suggested_html'))

    # "add" with no current markup is how the analyser says the element does not
    # exist yet — label it rather than printing an empty code block.
    current_is_absent = change_type == 'add' and not current

    if current is None and suggested is None and not current_is_absent:
        return None

    return HtmlChange(
        change_type=change_type,
        change_type_label=CHANGE_TYPE_LABELS.get(change_type, 'Modify'),
        location=_text(raw.get('location')).strip() or 'Location not specified',
        current_markup=current,
        suggested_markup=suggested,
        current_is_absent=current_is_absent,
        current_truncated_chars=current_dropped,
        suggested_truncated_chars=suggested_dropped,
    )


def _build_recommendation(raw: Any) -> ReportRecommendation | None:
    rec = _as_dict(raw, 'action')
    if not rec:
        return None

    action = _text(rec.get('action')).strip()
    rationale = _text(rec.get('rationale')).strip()
    if not action and not rationale and not rec.get('html_change'):
        return None

    priority = normalise_priority(rec.get('priority'))
    effort = normalise_effort(rec.get('effort'))

    return ReportRecommendation(
        ref=_text(rec.get('id')).strip(),
        resolves_ref=_text(rec.get('finding_id')).strip() or None,
        action=action,
        rationale=rationale,
        priority=priority,
        priority_label=PRIORITY_LABELS[priority],
        effort=effort,
        effort_label=EFFORT_LABELS[effort],
        html_change=_build_html_change(rec.get('html_change')),
    )


def _build_finding(raw: Any) -> ReportFinding:
    finding = _as_dict(raw, 'detail')

    detail = _text(finding.get('detail')).strip()
    title = _text(finding.get('title')).strip() or _text(finding.get('type')).strip()
    if not title:
        # Fall back to the detail so a bare string still reads as a finding.
        title = detail or 'Finding'

    severity = collapse_severity(_text(finding.get('severity')) or None)

    return ReportFinding(
        ref=_text(finding.get('id')).strip(),
        title=title,
        detail=detail,
        category=normalise_category(_text(finding.get('category')) or None),
        severity=severity,
        severity_label=SEVERITY_LABELS[severity],
        severity_color=SEVERITY_COLORS[severity],
        severity_text_color=SEVERITY_TEXT_COLORS[severity],
    )


def _build_breakdown(raw: Any, rubric: dict[str, int]) -> list[ScoreDimension]:
    """Zip a stored breakdown against the fixed rubric (FR-004).

    Rubric order is used, not the stored dict's order, so two renders of one
    analysis always lay out identically (SC-007).
    """
    values = raw if isinstance(raw, dict) else {}
    dimensions: list[ScoreDimension] = []

    for key, max_score in rubric.items():
        if key not in values:
            continue
        try:
            score = int(values[key])
        except (TypeError, ValueError):
            continue
        dimensions.append(
            ScoreDimension(
                key=key,
                label=dimension_label(key),
                score=score,
                max_score=max_score,
            )
        )

    # A dimension the analyser invented still gets shown rather than dropped.
    for key, value in values.items():
        if key in rubric:
            continue
        try:
            score = int(value)
        except (TypeError, ValueError):
            continue
        dimensions.append(
            ScoreDimension(key=key, label=dimension_label(key), score=score, max_score=score or 1)
        )

    return dimensions


# ---------------------------------------------------------------------------
# The builder (pure)
# ---------------------------------------------------------------------------


def build_report_document(
    analysis: Any,
    ingested_url: Any,
    optimization: Any = None,
) -> ReportDocument:
    """Compose the complete view model for one export.

    Pure: takes already-loaded rows, returns a value, performs no I/O.
    """
    raw = analysis.analysis if isinstance(analysis.analysis, dict) else {}

    raw_findings = raw.get('findings') or []
    raw_recommendations = raw.get('recommendations') or []
    if not isinstance(raw_findings, list):
        raw_findings = []
    if not isinstance(raw_recommendations, list):
        raw_recommendations = []

    # Index recommendations by the finding they resolve.
    by_finding: dict[str, ReportRecommendation] = {}
    orphans: list[ReportRecommendation] = []
    for entry in raw_recommendations:
        recommendation = _build_recommendation(entry)
        if recommendation is None:
            continue
        key = recommendation.resolves_ref
        if key and key not in by_finding:
            by_finding[key] = recommendation
        else:
            orphans.append(recommendation)

    # Build findings and attach their recommendation (FR-009).
    findings: list[ReportFinding] = []
    for entry in raw_findings:
        finding = _build_finding(entry)
        if finding.ref and finding.ref in by_finding:
            finding.recommendation = by_finding.pop(finding.ref)
        findings.append(finding)

    # Anything still unclaimed resolved a finding that does not exist. It is
    # rendered anyway — SC-002 makes dropping a recommendation a defect.
    orphans.extend(by_finding.values())

    # Group by category in fixed order, worst severity first within a group.
    grouped: dict[str, list[ReportFinding]] = {}
    for finding in findings:
        grouped.setdefault(finding.category, []).append(finding)

    groups: list[FindingGroup] = []
    for category in CATEGORY_ORDER:
        bucket = grouped.get(category)
        if not bucket:
            continue
        bucket.sort(key=lambda f: SEVERITY_RANK[f.severity])
        groups.append(
            FindingGroup(category=category, label=category_label(category), findings=bucket)
        )

    return ReportDocument(
        url=_text(getattr(ingested_url, 'url', '')) or 'Unknown URL',
        analysis_date=analysis.created_at or datetime.utcnow(),
        seo_score=analysis.seo_score,
        geo_score=analysis.geo_score,
        overall_score=analysis.overall_score,
        seo_breakdown=_build_breakdown(raw.get('seo_breakdown'), SEO_RUBRIC),
        geo_breakdown=_build_breakdown(raw.get('geo_breakdown'), GEO_RUBRIC),
        geo_visibility=_text(raw.get('geo_visibility')).strip(),
        finding_groups=groups,
        orphan_recommendations=orphans,
        optimizer=_build_optimizer_section(optimization),
    )


def _build_optimizer_section(optimization: Any) -> OptimizerSection | None:
    """Build the optimizer section, or None (FR-010).

    A failed or pending optimization yields None — US2 scenario 3 requires it to
    be indistinguishable from no optimization at all.
    """
    if optimization is None:
        return None
    if getattr(optimization, 'status', None) != EXPORTABLE_STATUS:
        return None

    html_text, html_dropped = _truncate(getattr(optimization, 'optimized_html', None))

    json_ld_raw = getattr(optimization, 'optimized_json_ld', None)
    json_ld_text: str | None = None
    json_ld_dropped = 0
    if json_ld_raw:
        try:
            pretty = json.dumps(json_ld_raw, indent=2, ensure_ascii=False)
        except (TypeError, ValueError):
            pretty = _text(json_ld_raw)
        json_ld_text, json_ld_dropped = _truncate(pretty)

    score_before = getattr(optimization, 'score_before', None)
    score_after = getattr(optimization, 'score_after_estimated', None)

    if not any([html_text, json_ld_text, score_before, score_after]):
        return None

    return OptimizerSection(
        optimized_html=html_text,
        optimized_html_truncated_chars=html_dropped,
        optimized_json_ld=json_ld_text,
        optimized_json_ld_truncated_chars=json_ld_dropped,
        score_before=score_before if isinstance(score_before, dict) else None,
        score_after=score_after if isinstance(score_after, dict) else None,
    )


# ---------------------------------------------------------------------------
# Filename (FR-017)
# ---------------------------------------------------------------------------

_SLUG_STRIP = re.compile(r'[^a-z0-9]+')


def report_filename(url: str, analysis_date: datetime) -> str:
    """Name the download after the analysed URL and the analysis date.

    The *analysis* date, not the generation date, so repeated exports of one
    analysis keep the same name (SC-007).
    """
    parsed = urlparse(url or '')
    raw = f'{parsed.netloc}{parsed.path}' if parsed.netloc else (url or 'report')
    slug = _SLUG_STRIP.sub('-', raw.lower()).strip('-')[:80].strip('-')
    if not slug:
        slug = 'report'
    return f'seo-report_{slug}_{analysis_date.strftime("%Y-%m-%d")}.pdf'


# ---------------------------------------------------------------------------
# Loading (the only I/O in this module)
# ---------------------------------------------------------------------------


class ReportService:
    """Loads the rows an export needs and gates on analysis status."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def load_document(self, analysis_id: int) -> ReportDocument:
        """Read the analysis, its URL, and any optimization; build the view model.

        Raises ``AnalysisNotFoundError`` or ``AnalysisNotExportableError`` so the
        router can map them onto distinct status codes (FR-016).
        """
        analysis = await self.session.get(UrlAnalysis, analysis_id)
        if analysis is None:
            raise AnalysisNotFoundError(f'No analysis found with id {analysis_id}')

        if analysis.status != EXPORTABLE_STATUS:
            raise AnalysisNotExportableError(analysis_id, str(analysis.status))

        ingested_url = await self.session.get(IngestedUrl, analysis.ingested_url_id)

        result = await self.session.execute(
            select(UrlOptimization)
            .where(UrlOptimization.analysis_id == analysis_id)
            .order_by(UrlOptimization.created_at.desc(), UrlOptimization.id.desc())
            .limit(1)
        )
        optimization = result.scalar_one_or_none()

        return build_report_document(analysis, ingested_url, optimization)
