"""Shared pytest fixtures."""

import os
from collections.abc import AsyncGenerator

import pytest
from backend.app.database.base import Base
from backend.app.database.session import get_db
from backend.app.main import app
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Use in-memory SQLite database for fast, isolated testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session", autouse=True)
def set_test_env():
    """Configure environment for testing."""
    os.environ["ENVIRONMENT"] = "testing"
    os.environ["DEBUG"] = "True"
    from backend.app.core.config import get_settings

    get_settings.cache_clear()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a fresh isolated database session per test seeded with test records."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from pathlib import Path

    from backend.app.rag.indexing import seed_database_and_index

    csv_file = Path("data/maintenance_records.csv")
    async with TestAsyncSessionLocal() as session:
        if csv_file.exists():
            await seed_database_and_index(session, csv_file)
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an asynchronous HTTP test client bound to the FastAPI app with test db override."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()
