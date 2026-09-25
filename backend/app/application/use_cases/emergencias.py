from uuid import UUID

from app.application.errors import NoEncontradoError
from app.application.interfaces.repositories import EmergenciaRepository
from app.infrastructure.db.models import Emergencia


async def listar_emergencias(repo: EmergenciaRepository, limit: int, offset: int, estado: str | None):
    return await repo.listar(limit, offset, estado)


async def obtener_emergencia(repo: EmergenciaRepository, id_: UUID) -> Emergencia:
    emergencia = await repo.obtener(id_)
    if emergencia is None:
        raise NoEncontradoError(f"Emergencia {id_} no encontrada.")
    return emergencia


async def crear_emergencia(repo: EmergenciaRepository, emergencia: Emergencia) -> Emergencia:
    emergencia.codigo = await repo.siguiente_codigo()
    return await repo.crear(emergencia)


async def actualizar_estado_emergencia(repo: EmergenciaRepository, id_: UUID, estado: str) -> Emergencia:
    emergencia = await obtener_emergencia(repo, id_)
    emergencia.estado = estado
    return await repo.guardar(emergencia)
