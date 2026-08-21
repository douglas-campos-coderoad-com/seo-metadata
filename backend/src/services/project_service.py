from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.agents.competitor_agent import CompetitorAgent
from src.models import Competitor, Project, UrlAnalysis
from src.schemas.project import ProjectCreate, ProjectUpdate, SmartSearchSuggestion


class ProjectService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: ProjectCreate) -> Project:
        project = Project(
            title=data.title,
            url=data.url,
            description=data.description,
            category=data.category,
            country=data.country,
            region=data.region,
        )
        self.session.add(project)
        await self.session.flush()  # assigns project.id before adding its competitors

        for competitor in data.competitors:
            self.session.add(
                Competitor(
                    project_id=project.id,
                    url=competitor.url,
                    description=competitor.description,
                )
            )

        await self.session.commit()
        return await self.get(project.id)

    async def list(self) -> List[Project]:
        result = await self.session.execute(
            select(Project).options(selectinload(Project.competitors)).order_by(Project.created_at)
        )
        return list(result.scalars().all())

    async def get(self, project_id: int) -> Project:
        result = await self.session.execute(
            select(Project)
            .options(selectinload(Project.competitors))
            .where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise ValueError(f'Project with id {project_id} not found')
        return project

    async def attach_analysis(self, project_id: int, analysis_id: int) -> UrlAnalysis:
        """Attaches an unattached analysis, or reassigns one already belonging to
        another project — from the DB's perspective both are just setting the FK."""
        await self.get(project_id)  # raises ValueError if the project doesn't exist

        result = await self.session.execute(
            select(UrlAnalysis).where(UrlAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if analysis is None:
            raise ValueError(f'Analysis with id {analysis_id} not found')

        analysis.project_id = project_id
        await self.session.commit()
        return await self._get_analysis_with_relations(analysis_id)

    async def _get_analysis_with_relations(self, analysis_id: int) -> UrlAnalysis:
        result = await self.session.execute(
            select(UrlAnalysis)
            .options(
                selectinload(UrlAnalysis.ingested_url),
                selectinload(UrlAnalysis.optimizations),
            )
            .where(UrlAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if analysis is None:
            raise ValueError(f'Analysis with id {analysis_id} not found')
        return analysis

    async def get_analysis(self, project_id: int, analysis_id: int) -> UrlAnalysis:
        """Single-item, ownership-checked read of one of a project's analyses
        (contracts/single-analysis-endpoint.md). "Not found" and "belongs to a
        different project" deliberately raise the identical message so this can't be
        used to probe whether an analysis id exists under a project the caller
        doesn't otherwise know about."""
        await self.get(project_id)  # raises ValueError "Project with id {id} not found" if missing

        try:
            analysis = await self._get_analysis_with_relations(analysis_id)
        except ValueError:
            raise ValueError(f'Analysis with id {analysis_id} not found in project {project_id}')

        if analysis.project_id != project_id:
            raise ValueError(f'Analysis with id {analysis_id} not found in project {project_id}')

        return analysis

    async def list_analyses(self, project_id: int) -> List[UrlAnalysis]:
        """A project's analysis history, chronological, each with its `ingested_url`
        and optional `optimizations` eager-loaded for FR-004's before/after rendering."""
        await self.get(project_id)  # raises ValueError if the project doesn't exist

        result = await self.session.execute(
            select(UrlAnalysis)
            .options(
                selectinload(UrlAnalysis.ingested_url),
                selectinload(UrlAnalysis.optimizations),
            )
            .where(UrlAnalysis.project_id == project_id)
            .order_by(UrlAnalysis.created_at)
        )
        return list(result.scalars().all())

    async def update(self, project_id: int, data: ProjectUpdate) -> Project:
        project = await self.get(project_id)  # raises ValueError if not found

        # model_fields_set distinguishes "field omitted" from "field explicitly set to
        # null" — region legitimately can be cleared to null, so a plain `is not None`
        # check would make that impossible.
        fields_set = data.model_fields_set
        if 'title' in fields_set:
            project.title = data.title
        if 'url' in fields_set:
            project.url = data.url
        if 'description' in fields_set:
            project.description = data.description
        if 'category' in fields_set:
            project.category = data.category
        if 'country' in fields_set:
            project.country = data.country
        if 'region' in fields_set:
            project.region = data.region

        if 'competitors' in fields_set and data.competitors is not None:
            # Whole-list-replace, not a merge (research.md §4).
            await self.session.execute(delete(Competitor).where(Competitor.project_id == project_id))
            for competitor in data.competitors:
                self.session.add(
                    Competitor(project_id=project_id, url=competitor.url, description=competitor.description)
                )

        await self.session.commit()
        # The bulk DELETE above doesn't sync the session's identity map, so the
        # re-fetch below would otherwise still see the old (deleted) Competitor
        # objects cached from this method's earlier `self.get(project_id)` call.
        self.session.expire_all()
        return await self.get(project_id)

    async def delete(self, project_id: int) -> None:
        await self.get(project_id)  # raises ValueError if not found

        # Explicit cascade rather than relying solely on the DB-level ON DELETE
        # CASCADE (migration 006): SQLite — used by the test suite — ignores FK
        # constraints unless a pragma most setups don't enable, so this keeps
        # behavior identical in tests and in production Postgres (FR-015).
        await self.session.execute(delete(Competitor).where(Competitor.project_id == project_id))
        await self.session.execute(delete(UrlAnalysis).where(UrlAnalysis.project_id == project_id))
        await self.session.execute(delete(Project).where(Project.id == project_id))
        await self.session.commit()

    async def remove_analysis(self, project_id: int, analysis_id: int) -> None:
        """Permanently deletes the analysis record (FR-016) — not a detach-to-null.
        Only removes it if it actually belongs to this project."""
        result = await self.session.execute(
            select(UrlAnalysis).where(UrlAnalysis.id == analysis_id, UrlAnalysis.project_id == project_id)
        )
        analysis = result.scalar_one_or_none()
        if analysis is None:
            raise ValueError(f'Analysis with id {analysis_id} not found in project {project_id}')

        await self.session.delete(analysis)
        await self.session.commit()

    async def smart_search_competitors(
        self, description: str, category: str, country: str, region: Optional[str] = None
    ) -> List[SmartSearchSuggestion]:
        """Proposes competitor entries (FR-007) — stateless, no DB interaction; never
        persists anything, so it works during project creation before an id exists."""
        agent = CompetitorAgent()
        result = agent.generate(description=description, category=category, country=country, region=region)
        return [SmartSearchSuggestion(**s) for s in result['suggestions']]
