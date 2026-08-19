import pytest
from pydantic import ValidationError
from sqlalchemy import select

from src.services.project_service import ProjectService
from src.schemas.project import ProjectCreate, ProjectUpdate, CompetitorCreate
from src.models import Competitor, IngestedUrl, UrlAnalysis


async def _make_analysis(session, url: str) -> UrlAnalysis:
    ingested = IngestedUrl(
        url=url,
        html='<html></html>',
        status='success',
        http_status=200,
        content_type='text/html',
        error=None,
    )
    session.add(ingested)
    await session.commit()
    await session.refresh(ingested)

    analysis = UrlAnalysis(
        ingested_url_id=ingested.id,
        seo_score=70,
        geo_score=60,
        overall_score=65,
        analysis={},
        json_ld=None,
        status='completed',
        error=None,
    )
    session.add(analysis)
    await session.commit()
    await session.refresh(analysis)
    return analysis


def _project_payload(**overrides):
    data = dict(
        title='Demo Shop',
        description='A small e-commerce site selling home goods',
        category='e-commerce',
        country='United States',
        region='California',
        competitors=[],
    )
    data.update(overrides)
    return ProjectCreate(**data)


# ── ProjectCreate schema ──────────────────────────────────────────────────


def test_project_create_rejects_invalid_category():
    with pytest.raises(ValidationError):
        _project_payload(category='not-a-real-category')


# ── ProjectService.create ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_project_without_competitors(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(_project_payload())

        assert project.id is not None
        assert project.title == 'Demo Shop'
        assert project.category == 'e-commerce'
        assert project.region == 'California'
        assert project.competitors == []


@pytest.mark.asyncio
async def test_create_project_with_competitors(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        payload = _project_payload(
            competitors=[
                CompetitorCreate(url='https://a.example.com', description='Competitor A'),
                CompetitorCreate(url='https://b.example.com', description='Competitor B'),
            ]
        )
        project = await service.create(payload)

        assert len(project.competitors) == 2
        urls = {c.url for c in project.competitors}
        assert urls == {'https://a.example.com', 'https://b.example.com'}
        assert all(c.project_id == project.id for c in project.competitors)


# ── ProjectService.list / get ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_projects_returns_all(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        await service.create(_project_payload(title='Project A'))
        await service.create(_project_payload(title='Project B'))

        projects = await service.list()

        assert {p.title for p in projects} == {'Project A', 'Project B'}


@pytest.mark.asyncio
async def test_get_project_returns_with_competitors(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        created = await service.create(
            _project_payload(competitors=[CompetitorCreate(url='https://a.example.com', description='A')])
        )

        fetched = await service.get(created.id)

        assert fetched.id == created.id
        assert len(fetched.competitors) == 1


@pytest.mark.asyncio
async def test_get_project_not_found_raises(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        with pytest.raises(ValueError, match='not found'):
            await service.get(999)


# ── ProjectService.attach_analysis ────────────────────────────────────────


@pytest.mark.asyncio
async def test_attach_analysis_sets_project_id(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(_project_payload())
        analysis = await _make_analysis(session, 'https://example.com/product-a')

        attached = await service.attach_analysis(project.id, analysis.id)

        assert attached.id == analysis.id
        assert attached.project_id == project.id


@pytest.mark.asyncio
async def test_attach_analysis_reassigns_from_another_project(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project_a = await service.create(_project_payload(title='Project A'))
        project_b = await service.create(_project_payload(title='Project B'))
        analysis = await _make_analysis(session, 'https://example.com/product-b')

        await service.attach_analysis(project_a.id, analysis.id)
        reassigned = await service.attach_analysis(project_b.id, analysis.id)

        assert reassigned.project_id == project_b.id


@pytest.mark.asyncio
async def test_attach_analysis_project_not_found_raises(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        analysis = await _make_analysis(session, 'https://example.com/product-c')

        with pytest.raises(ValueError, match='Project'):
            await service.attach_analysis(999, analysis.id)


@pytest.mark.asyncio
async def test_attach_analysis_analysis_not_found_raises(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(_project_payload())

        with pytest.raises(ValueError, match='Analysis'):
            await service.attach_analysis(project.id, 999)


# ── ProjectService.get_analysis ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_analysis_returns_matching_analysis(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(_project_payload())
        analysis = await _make_analysis(session, 'https://example.com/product-get')
        await service.attach_analysis(project.id, analysis.id)

        fetched = await service.get_analysis(project.id, analysis.id)

        assert fetched.id == analysis.id
        assert fetched.project_id == project.id


@pytest.mark.asyncio
async def test_get_analysis_project_not_found_raises(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        analysis = await _make_analysis(session, 'https://example.com/product-get-2')

        with pytest.raises(ValueError, match='Project'):
            await service.get_analysis(999, analysis.id)


@pytest.mark.asyncio
async def test_get_analysis_wrong_project_raises_not_found(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project_a = await service.create(_project_payload(title='Project A'))
        project_b = await service.create(_project_payload(title='Project B'))
        analysis = await _make_analysis(session, 'https://example.com/product-get-3')
        await service.attach_analysis(project_a.id, analysis.id)

        with pytest.raises(ValueError, match='not found'):
            await service.get_analysis(project_b.id, analysis.id)


@pytest.mark.asyncio
async def test_get_analysis_missing_analysis_raises_not_found(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(_project_payload())

        with pytest.raises(ValueError, match='not found'):
            await service.get_analysis(project.id, 999)


# ── ProjectService.update ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_project_changes_metadata(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(_project_payload())

        updated = await service.update(
            project.id,
            ProjectUpdate(title='Renamed Shop', category='saas'),
        )

        assert updated.title == 'Renamed Shop'
        assert updated.category == 'saas'
        # Fields not present in the update are left untouched.
        assert updated.country == 'United States'


@pytest.mark.asyncio
async def test_update_project_replaces_competitor_list(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(
            _project_payload(competitors=[CompetitorCreate(url='https://old.example.com', description='Old')])
        )

        updated = await service.update(
            project.id,
            ProjectUpdate(competitors=[CompetitorCreate(url='https://new.example.com', description='New')]),
        )

        assert len(updated.competitors) == 1
        assert updated.competitors[0].url == 'https://new.example.com'


@pytest.mark.asyncio
async def test_update_project_omitted_competitors_leaves_list_untouched(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(
            _project_payload(competitors=[CompetitorCreate(url='https://keep.example.com', description='Keep')])
        )

        updated = await service.update(project.id, ProjectUpdate(title='New Title'))

        assert len(updated.competitors) == 1
        assert updated.competitors[0].url == 'https://keep.example.com'


@pytest.mark.asyncio
async def test_update_project_not_found_raises(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        with pytest.raises(ValueError, match='not found'):
            await service.update(999, ProjectUpdate(title='X'))


# ── ProjectService.delete ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_project_cascades_to_competitors_and_analyses(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(
            _project_payload(competitors=[CompetitorCreate(url='https://c.example.com', description='C')])
        )
        analysis = await _make_analysis(session, 'https://example.com/product-delete')
        await service.attach_analysis(project.id, analysis.id)

        await service.delete(project.id)

        with pytest.raises(ValueError, match='not found'):
            await service.get(project.id)

        remaining_competitors = await session.execute(select(Competitor).where(Competitor.project_id == project.id))
        assert remaining_competitors.scalars().all() == []

        remaining_analysis = await session.execute(select(UrlAnalysis).where(UrlAnalysis.id == analysis.id))
        assert remaining_analysis.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_project_not_found_raises(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        with pytest.raises(ValueError, match='not found'):
            await service.delete(999)


# ── ProjectService.remove_analysis ────────────────────────────────────────


@pytest.mark.asyncio
async def test_remove_analysis_deletes_the_record(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project = await service.create(_project_payload())
        analysis = await _make_analysis(session, 'https://example.com/product-remove')
        await service.attach_analysis(project.id, analysis.id)

        await service.remove_analysis(project.id, analysis.id)

        remaining = await session.execute(select(UrlAnalysis).where(UrlAnalysis.id == analysis.id))
        assert remaining.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_remove_analysis_not_belonging_to_project_raises(db_session_factory):
    async with db_session_factory() as session:
        service = ProjectService(session)
        project_a = await service.create(_project_payload(title='Project A'))
        project_b = await service.create(_project_payload(title='Project B'))
        analysis = await _make_analysis(session, 'https://example.com/product-wrong-project')
        await service.attach_analysis(project_a.id, analysis.id)

        with pytest.raises(ValueError, match='not found'):
            await service.remove_analysis(project_b.id, analysis.id)

        # Reassigning (not removing) preserves the record — confirms remove_analysis's
        # delete behavior is distinct from attach_analysis's reassignment.
        reassigned = await service.attach_analysis(project_b.id, analysis.id)
        assert reassigned.project_id == project_b.id
