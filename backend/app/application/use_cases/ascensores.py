from uuid import UUID

from app.application.errors import NoEncontradoError
from app.application.interfaces.repositories import AscensorRepository
from app.domain.enums import CategoriaEquipo
from app.infrastructure.db.models import Ascensor


async def listar_ascensores(
    repo: AscensorRepository,
    limit: int,
    offset: int,
    edificio_id: UUID | None,
    categoria: CategoriaEquipo | None = None,
):
    return await repo.listar(limit, offset, edificio_id, categoria)


async def obtener_ascensor(repo: AscensorRepository, id_: UUID) -> Ascensor | None:
    return await repo.obtener(id_)


async def crear_ascensor(repo: AscensorRepository, ascensor: Ascensor) -> Ascensor:
    return await repo.crear(ascensor)


async def actualizar_ascensor(repo: AscensorRepository, id_: UUID, cambios: dict) -> Ascensor:
    """PATCH parcial: `cambios` trae solo los campos enviados por el cliente."""
    ascensor = await repo.obtener(id_)
    if ascensor is None:
        raise NoEncontradoError(f"Ascensor {id_} no encontrado.")
    for campo, valor in cambios.items():
        setattr(ascensor, campo, valor)
    return await repo.guardar(ascensor)


async def bitacora_ascensor(repo: AscensorRepository, ascensor_id: UUID):
    return await repo.bitacora(ascensor_id)
