from uuid import UUID

from app.application.interfaces.repositories import AscensorRepository
from app.infrastructure.db.models import Ascensor


async def listar_ascensores(
    repo: AscensorRepository, limit: int, offset: int, edificio_id: UUID | None
):
    return await repo.listar(limit, offset, edificio_id)


async def obtener_ascensor(repo: AscensorRepository, id_: UUID) -> Ascensor | None:
    return await repo.obtener(id_)


async def crear_ascensor(repo: AscensorRepository, ascensor: Ascensor) -> Ascensor:
    return await repo.crear(ascensor)
