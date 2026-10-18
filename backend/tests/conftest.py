import asyncio
import os
import sys
from collections.abc import AsyncGenerator
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.v1.auth import get_registro_intentos
from app.domain.enums import RolUsuario
from app.infrastructure.db import models  # noqa: F401
from app.infrastructure.db.base import Base
from app.infrastructure.db.models import Usuario
from app.infrastructure.db.session import get_session
from app.main import app
from tests.fabricas import headers_de

if sys.platform == "win32":
    # asyncpg necesita el loop de selectores; ProactorEventLoop (default en Windows)
    # rompe la conexión al cruzar límites de fixture/test.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://facylitech:facylitech@localhost:5432/facylitech_test"
)


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    connection = await test_engine.connect()
    transaction = await connection.begin()
    session_factory = async_sessionmaker(
        bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )
    session = session_factory()

    yield session

    await session.close()
    await transaction.rollback()
    await connection.close()


@pytest.fixture(autouse=True)
def _reiniciar_intentos_login():
    """El contador de intentos fallidos es global al proceso: aislarlo entre tests."""
    get_registro_intentos().reiniciar()
    yield
    get_registro_intentos().reiniciar()


@pytest_asyncio.fixture
async def _app_con_sesion(db_session):
    async def _override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_get_session
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def operador_prueba(db_session) -> Usuario:
    """Operador activo de prueba (sin contraseña) con el que se autentica `client`."""
    operador = Usuario(
        nombre="Operador de Prueba",
        email=f"operador-prueba-{uuid4().hex[:8]}@facylitech.cl",
        rol=RolUsuario.OPERADOR,
        activo=True,
    )
    db_session.add(operador)
    await db_session.commit()
    await db_session.refresh(operador)
    return operador


@pytest_asyncio.fixture
async def client(_app_con_sesion, operador_prueba) -> AsyncGenerator[AsyncClient, None]:
    """Cliente autenticado como `operador_prueba` (el caso por defecto de los tests)."""
    transport = ASGITransport(app=_app_con_sesion)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers=headers_de(operador_prueba.id, RolUsuario.OPERADOR),
    ) as ac:
        yield ac


@pytest_asyncio.fixture
async def cliente_anonimo(_app_con_sesion) -> AsyncGenerator[AsyncClient, None]:
    """Cliente sin credenciales."""
    transport = ASGITransport(app=_app_con_sesion)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def cliente_como(_app_con_sesion):
    """Fábrica de clientes autenticados como un usuario concreto:
    `tec = cliente_como(tecnico["id"], "tecnico")`. Se cierran al terminar el test."""
    abiertos: list[AsyncClient] = []

    def _fabrica(usuario_id: UUID | str, rol: str = "tecnico", token: str | None = None) -> AsyncClient:
        cabecera = {"Authorization": f"Bearer {token}"} if token else headers_de(usuario_id, rol)
        cliente = AsyncClient(
            transport=ASGITransport(app=_app_con_sesion), base_url="http://test", headers=cabecera
        )
        abiertos.append(cliente)
        return cliente

    yield _fabrica
    for c in abiertos:
        await c.aclose()
