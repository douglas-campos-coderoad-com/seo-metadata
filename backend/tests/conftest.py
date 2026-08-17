import os
import sys
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Ensure backend src is importable
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from src.main import create_app  # noqa: E402
from src.db import get_session  # noqa: E402
from src.models.ingested_url import IngestedUrl  # noqa: E402
from src.models.url_analysis import UrlAnalysis  # noqa: E402
from src.models.url_optimization import UrlOptimization  # noqa: E402
from sqlalchemy import MetaData  # noqa: E402


@pytest.fixture(scope='session')
def event_loop():
    """One event loop for the whole session.

    pytest-asyncio's default is a fresh loop per test, which breaks any
    loop-bound resource shared across tests — notably the Playwright browser the
    PDF export reuses (src/services/pdf_renderer.py). With a per-test loop the
    second render either deadlocks or has to abandon a live Chromium process.
    """
    import asyncio

    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_engine():
    """Create an in-memory SQLite async engine for tests."""
    engine = create_async_engine(
        'sqlite+aiosqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )

    # Create only the tables needed for tests (Item model uses ARRAY which SQLite can't compile)
    metadata = MetaData()
    IngestedUrl.__table__.to_metadata(metadata)
    UrlAnalysis.__table__.to_metadata(metadata)
    UrlOptimization.__table__.to_metadata(metadata)

    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session_factory(db_engine):
    """Create a session factory bound to the test engine."""
    factory = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    return factory


@pytest_asyncio.fixture
async def client(db_session_factory):
    """Create a FastAPI test client with dependency overrides."""
    app = create_app()

    async def override_get_session():
        async with db_session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as ac:
        yield ac

    app.dependency_overrides.clear()