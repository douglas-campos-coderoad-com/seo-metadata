"""View models for the exported PDF report.

Every model here is built per request and discarded — the report is composed on
demand and never persisted (spec Assumptions), so there is no table and no
migration behind any of this.

All fields tolerate absent or malformed input. The source is
``url_analyses.analysis``, a JSONB column written from LLM output: its shape is
specified by the analyser prompt but not guaranteed by anything at runtime, and
two known deviations already exist in stored data (plain-string findings from the
error path, and a NULL ``analysis`` on a completed row).
"""

from datetime import datetime

from pydantic import BaseModel, Field

from src.services.report_mappings import Severity


class ScoreDimension(BaseModel):
    """One row of a score breakdown (FR-004)."""

    key: str
    label: str
    score: int
    max_score: int

    @property
    def ratio(self) -> float:
        """Fraction of available points, clamped to 0..1 — drives the bar width.

        ``max_score`` comes from the fixed rubric, never from LLM output, but an
        unknown dimension key still has to avoid dividing by zero.
        """
        if self.max_score <= 0:
            return 0.0
        return max(0.0, min(1.0, self.score / self.max_score))

    @property
    def percent(self) -> int:
        return round(self.ratio * 100)


class HtmlChange(BaseModel):
    """The markup a recommendation asks for (FR-008)."""

    change_type: str = 'modify'
    change_type_label: str = 'Modify'
    location: str = 'Location not specified'
    current_markup: str | None = None
    suggested_markup: str | None = None
    #: True when the element does not exist yet, so the report labels it as an
    #: addition instead of printing an empty code block (spec Edge Cases).
    current_is_absent: bool = False
    current_truncated_chars: int = 0
    suggested_truncated_chars: int = 0

    @property
    def has_content(self) -> bool:
        return bool(self.current_markup or self.suggested_markup or self.current_is_absent)


class ReportRecommendation(BaseModel):
    """A recommendation as it appears in the document (FR-007)."""

    ref: str = ''
    resolves_ref: str | None = None
    action: str = ''
    rationale: str = ''
    priority: str = 'medium'
    priority_label: str = 'Medium'
    effort: str = 'medium'
    effort_label: str = 'Medium'
    html_change: HtmlChange | None = None


class ReportFinding(BaseModel):
    """A finding as it appears in the document (FR-006)."""

    ref: str = ''
    title: str = 'Finding'
    detail: str = ''
    category: str = 'content'
    severity: Severity = Severity.WARNING
    severity_label: str = 'Needs improvement'
    severity_color: str = ''
    severity_text_color: str = ''
    #: The recommendations that resolve this finding (FR-009). Usually one; can be
    #: empty for a low-impact finding, or more than one when genuinely separate
    #: fixes apply — never collapsed into a single entry.
    recommendations: list[ReportRecommendation] = Field(default_factory=list)


class FindingGroup(BaseModel):
    """Findings under one category heading (FR-012). Never emitted empty."""

    category: str
    label: str
    findings: list[ReportFinding] = Field(default_factory=list)


class OptimizerSection(BaseModel):
    """The optional optimizer output (FR-010).

    Present only for an optimization whose status is ``completed`` — a failed or
    pending one is treated exactly as if none existed.
    """

    optimized_html: str | None = None
    optimized_html_truncated_chars: int = 0
    optimized_json_ld: str | None = None
    optimized_json_ld_truncated_chars: int = 0
    score_before: dict[str, object] | None = None
    score_after: dict[str, object] | None = None

    @property
    def has_scores(self) -> bool:
        return bool(self.score_before or self.score_after)


class ReportDocument(BaseModel):
    """The complete input to the template — one per export."""

    url: str
    #: The analysis date, never the generation time: SC-007 requires a
    #: regenerated report to match one sent earlier.
    analysis_date: datetime

    seo_score: int | None = None
    geo_score: int | None = None
    overall_score: int | None = None

    seo_breakdown: list[ScoreDimension] = Field(default_factory=list)
    geo_breakdown: list[ScoreDimension] = Field(default_factory=list)
    geo_visibility: str = ''

    finding_groups: list[FindingGroup] = Field(default_factory=list)
    #: Recommendations resolving no known finding. Rendered rather than dropped —
    #: SC-002 makes any omission a defect.
    orphan_recommendations: list[ReportRecommendation] = Field(default_factory=list)

    optimizer: OptimizerSection | None = None

    @property
    def total_findings(self) -> int:
        return sum(len(group.findings) for group in self.finding_groups)

    @property
    def total_recommendations(self) -> int:
        joined = sum(
            len(finding.recommendations)
            for group in self.finding_groups
            for finding in group.findings
        )
        return joined + len(self.orphan_recommendations)

    @property
    def has_no_issues(self) -> bool:
        """Drives the explicit "no issues detected" statement — never a blank section."""
        return self.total_findings == 0 and not self.orphan_recommendations

    @property
    def analysis_date_display(self) -> str:
        return self.analysis_date.strftime('%m-%d-%Y')

    @property
    def seo_score_display(self) -> str:
        return 'Not scored' if self.seo_score is None else str(self.seo_score)

    @property
    def geo_score_display(self) -> str:
        return 'Not scored' if self.geo_score is None else str(self.geo_score)

    @property
    def overall_score_display(self) -> str:
        """A missing score and a zero score mean different things to a reader."""
        return 'Not scored' if self.overall_score is None else str(self.overall_score)
