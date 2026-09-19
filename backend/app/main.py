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
from backend.app.database.session import AsyncSessionLocal, engine
from backend.app.rag.indexing import seed_database_and_index
from backend.app.rag.vector_store import vector_store
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

    # 2. Try loading vector store or seed if empty
    csv_path = Path("data/maintenance_records.csv")
    if not vector_store.load() or vector_store.count() == 0:
        async with AsyncSessionLocal() as session:
            await seed_database_and_index(session, csv_path)

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

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS
        if isinstance(settings.CORS_ORIGINS, list)
        else [settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
