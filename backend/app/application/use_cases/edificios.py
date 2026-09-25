from uuid import UUID

from app.application.interfaces.repositories import EdificioRepository
from app.infrastructure.db.models import Edificio


async def listar_edificios(
    repo: EdificioRepository, limit: int, offset: int, administracion_id: UUID | None = None
):
    return await repo.listar(limit, offset, administracion_id)


async def obtener_edificio(repo: EdificioRepository, id_: UUID) -> Edificio | None:
    return await repo.obtener(id_)


async def crear_edificio(repo: EdificioRepository, edificio: Edificio) -> Edificio:
    return await repo.crear(edificio)
