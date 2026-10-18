from datetime import UTC, date, datetime
from uuid import UUID

from app.application.errors import DatosInvalidosError, NoEncontradoError
from app.application.interfaces.repositories import OrdenTrabajoRepository, UsuarioRepository
from app.domain.enums import EstadoOrdenTrabajo, RolUsuario, TipoOrdenTrabajo
from app.domain.transiciones import (
    validar_cancelar,
    validar_completar,
    validar_editable,
    validar_iniciar,
)
from app.infrastructure.db.models import OrdenTrabajo


async def listar_ordenes(
    repo: OrdenTrabajoRepository,
    limit: int,
    offset: int,
    desde: date | None = None,
    hasta: date | None = None,
    tecnico_id: UUID | None = None,
    estado: EstadoOrdenTrabajo | None = None,
    tipo: TipoOrdenTrabajo | None = None,
    edificio_id: UUID | None = None,
):
    return await repo.listar(limit, offset, desde, hasta, tecnico_id, estado, tipo, edificio_id)


async def obtener_orden(repo: OrdenTrabajoRepository, id_: UUID) -> OrdenTrabajo:
    orden = await repo.obtener(id_)
    if orden is None:
        raise NoEncontradoError(f"Orden de trabajo {id_} no encontrada.")
    return orden


async def crear_orden(repo: OrdenTrabajoRepository, orden: OrdenTrabajo) -> OrdenTrabajo:
    orden.codigo = await repo.siguiente_codigo()
    return await repo.crear(orden)


async def iniciar_orden(repo: OrdenTrabajoRepository, id_: UUID) -> OrdenTrabajo:
    orden = await obtener_orden(repo, id_)
    validar_iniciar(orden.estado)
    orden.estado = EstadoOrdenTrabajo.EN_CURSO
    orden.inicio_real = datetime.now(UTC)
    return await repo.guardar(orden)


async def actualizar_orden(
    repo: OrdenTrabajoRepository, usuario_repo: UsuarioRepository, id_: UUID, cambios: dict
) -> OrdenTrabajo:
    """Reasignar técnico (None = sin asignar), reprogramar, prioridad o descripción.
    Solo órdenes abiertas (programado/en_curso)."""
    orden = await obtener_orden(repo, id_)
    validar_editable(orden.estado)
    tecnico_id = cambios.get("tecnico_id")
    if tecnico_id is not None:
        tecnico = await usuario_repo.obtener(tecnico_id)
        if tecnico is None:
            raise NoEncontradoError(f"Técnico {tecnico_id} no encontrado.")
        if tecnico.rol != RolUsuario.TECNICO:
            raise DatosInvalidosError("Solo se puede asignar la orden a un usuario con rol técnico.")
    for campo, valor in cambios.items():
        setattr(orden, campo, valor)
    return await repo.guardar(orden)


async def cancelar_orden(repo: OrdenTrabajoRepository, id_: UUID) -> OrdenTrabajo:
    orden = await obtener_orden(repo, id_)
    validar_cancelar(orden.estado)
    orden.estado = EstadoOrdenTrabajo.CANCELADO
    return await repo.guardar(orden)


async def completar_orden(repo: OrdenTrabajoRepository, id_: UUID) -> OrdenTrabajo:
    orden = await obtener_orden(repo, id_)
    papeleta_enviada = orden.papeleta is not None and orden.papeleta.estado == "enviada"
    validar_completar(orden.estado, papeleta_enviada)
    orden.estado = EstadoOrdenTrabajo.COMPLETADO
    orden.fin_real = datetime.now(UTC)
    return await repo.guardar(orden)
