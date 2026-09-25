from uuid import UUID

from app.application.interfaces.repositories import AdministracionRepository
from app.infrastructure.db.models import Administracion, Edificio


async def listar_administraciones(repo: AdministracionRepository, limit: int, offset: int):
    return await repo.listar(limit, offset)


async def obtener_administracion(repo: AdministracionRepository, id_: UUID) -> Administracion | None:
    return await repo.obtener(id_)


async def crear_administracion(
    repo: AdministracionRepository, administracion: Administracion
) -> Administracion:
    return await repo.crear(administracion)


async def edificios_de_administracion(
    repo: AdministracionRepository, administracion_id: UUID
) -> list[Edificio]:
    return await repo.edificios(administracion_id)
