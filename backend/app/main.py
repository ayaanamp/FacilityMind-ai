import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure root directory is on sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
from backend.app.api.routes import api_router
from backend.app.core.config import get_settings
from backend.app.core.logging import logging, setup_logging
from backend.app.database.migration import reconcile_database_schema
from backend.app.database.session import engine
from backend.app.rag.vector_store import vector_store
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

logger = logging.getLogger("FacilityMind.Main")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup and shutdown event lifecycle."""
    setup_logging()
    logger.info("Starting FacilityMind AI Platform...")

    # 1. Initialize and reconcile DB schema
    async with engine.begin() as conn:
        await conn.run_sync(reconcile_database_schema)

    # 2. Load existing vector store index from disk (if present)
    vector_store.load()
    if vector_store.count() == 0:
        try:
            from backend.app.database.session import AsyncSessionLocal
            from backend.app.models.maintenance import MaintenanceRecord
            from backend.app.rag.indexing import build_index_from_db
            from sqlalchemy import func, select

            async with AsyncSessionLocal() as session:
                rec_count_res = await session.execute(select(func.count(MaintenanceRecord.id)))
                rec_count = rec_count_res.scalar() or 0
                if rec_count > 0:
                    await build_index_from_db(session)
        except Exception as err:
            logger.warning(f"Vector sync on startup note: {err}")

    yield

    # Shutdown: Dispose engine connection pool and save vector index
    vector_store.save()
    await engine.dispose()
    logger.info("FacilityMind AI Platform gracefully stopped.")


def create_application() -> FastAPI:
    """Factory creating and configuring the FastAPI instance."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        docs_url=f"{settings.API_PREFIX}/docs",
        redoc_url=f"{settings.API_PREFIX}/redoc",
        lifespan=lifespan,
    )

    # Permissive CORS configuration with regex origin matching and credentials support
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://.*$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    # Root & Docs Redirects / Health probes for Render & Cloud
    @app.get("/health", include_in_schema=False)
    @app.get("/healthz", include_in_schema=False)
    async def health_probe():
        return {"status": "ok", "service": "FacilityMind AI Backend", "version": settings.VERSION}

    @app.get("/", include_in_schema=False)
    async def root_redirect():
        return RedirectResponse(url=f"{settings.API_PREFIX}/docs")

    @app.get("/docs", include_in_schema=False)
    async def docs_redirect():
        return RedirectResponse(url=f"{settings.API_PREFIX}/docs")

    @app.get("/redoc", include_in_schema=False)
    async def redoc_redirect():
        return RedirectResponse(url=f"{settings.API_PREFIX}/redoc")

    # Include versioned API router
    app.include_router(api_router, prefix=settings.API_PREFIX)

    return app


app = create_application()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=settings.DEBUG,
    )
