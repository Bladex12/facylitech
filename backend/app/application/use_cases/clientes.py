from uuid import UUID

from app.application.interfaces.repositories import ClienteRepository
from app.infrastructure.db.models import Administracion, Cliente


async def listar_clientes(repo: ClienteRepository, limit: int, offset: int):
    return await repo.listar(limit, offset)


async def obtener_cliente(repo: ClienteRepository, id_: UUID) -> Cliente | None:
    return await repo.obtener(id_)


async def crear_cliente(repo: ClienteRepository, cliente: Cliente) -> Cliente:
    return await repo.crear(cliente)


async def administraciones_del_cliente(repo: ClienteRepository, cliente_id: UUID) -> list[Administracion]:
    return await repo.administraciones(cliente_id)
