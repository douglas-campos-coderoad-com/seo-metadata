from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from dotenv import load_dotenv

load_dotenv()

from src.middleware import setup_logging, RequestIDMiddleware, register_exception_handlers
from src.api.health import router as health_router
from src.api.items import router as items_router
from src.api.categories import router as categories_router
from src.api.periods import router as periods_router
from src.api.ingest import router as ingest_router
from src.api.analysis import router as analysis_router
from src.api.optimization import router as optimization_router
from src.api.geo import router as geo_router
from src.api.report import router as report_router
from src.services.pdf_renderer import pdf_renderer


def create_app() -> FastAPI:
    app = FastAPI(
        title='Visora Analyzer',
        description='Curated Catalog Discovery & Dealer Inquiry',
        version='0.1.0',
    )

    setup_logging()

    app.add_middleware(RequestIDMiddleware)

    origins = [
        'http://localhost:3000',
        'http://localhost:8000',
        os.getenv('FRONTEND_URL', 'http://localhost:3000'),
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
        # The PDF export carries its filename in Content-Disposition. Without
        # exposing the header the browser hides it and every download silently
        # falls back to a generic name, breaking FR-017.
        expose_headers=['Content-Disposition'],
    )

    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(items_router)
    app.include_router(categories_router)
    app.include_router(periods_router)
    app.include_router(ingest_router)
    app.include_router(analysis_router)
    app.include_router(optimization_router)
    app.include_router(geo_router)
    app.include_router(report_router)

    return app


app = create_app()


@app.on_event('startup')
async def startup():
    # Launch Chromium up front so the first PDF export does not pay the launch
    # cost. A failure here must not block the whole API: the renderer relaunches
    # lazily on first use, so a slow first export beats a dead service.
    try:
        await pdf_renderer.start()
    except Exception as exc:
        logging.getLogger(__name__).warning(
            'PDF renderer could not start eagerly, will launch on first use: %s', exc
        )


@app.on_event('shutdown')
async def shutdown():
    await pdf_renderer.stop()
