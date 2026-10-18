from datetime import UTC, datetime
from uuid import UUID

from app.application.errors import NoEncontradoError
from app.application.interfaces.repositories import EmergenciaRepository
from app.application.use_cases.cascada import aplicar_cambios, pasos
from app.domain.cascada import cancelar_abiertas
from app.domain.enums import EstadoEmergencia
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


async def actualizar_estado_emergencia(
    repo: EmergenciaRepository, id_: UUID, estado: str, ahora: datetime | None = None
) -> Emergencia:
    emergencia = await obtener_emergencia(repo, id_)
    emergencia.estado = estado
    if estado == EstadoEmergencia.CERRADA:
        # Cerrar la emergencia cancela la cascada que siga abierta.
        cambios = cancelar_abiertas(pasos(emergencia.asignaciones), ahora or datetime.now(UTC))
        aplicar_cambios(emergencia.asignaciones, cambios)
    return await repo.guardar(emergencia)
