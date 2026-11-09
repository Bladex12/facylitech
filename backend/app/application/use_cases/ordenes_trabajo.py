from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from app.application.errors import DatosInvalidosError, NoEncontradoError
from app.application.interfaces.repositories import OrdenTrabajoRepository, UsuarioRepository
from app.domain.enums import (
    EstadoDisponibilidadTecnico,
    EstadoEmergencia,
    EstadoOrdenTrabajo,
    RolUsuario,
    TipoOrdenTrabajo,
)
from app.domain.replicacion import (
    OrdenOmitida,
    OrdenOrigen,
    OrdenPlanificada,
    mes_siguiente,
    planificar_replicacion,
)
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
    if orden.tipo == TipoOrdenTrabajo.EMERGENCIA:
        # Cierre de la atención: el técnico vuelve a estar disponible para la
        # próxima cascada y la emergencia queda cerrada (ver docs/decisiones.md).
        if orden.tecnico is not None:
            orden.tecnico.estado_disponibilidad = EstadoDisponibilidadTecnico.DISPONIBLE
        if orden.emergencia is not None and orden.emergencia.estado != EstadoEmergencia.CERRADA:
            orden.emergencia.estado = EstadoEmergencia.CERRADA
    return await repo.guardar(orden)


@dataclass
class ResultadoReplicacion:
    anio_origen: int
    mes_origen: int
    anio_destino: int
    mes_destino: int
    simulacion: bool
    crear: list[OrdenPlanificada]
    omitidas: list[OrdenOmitida]
    origenes: dict[UUID, OrdenTrabajo]  # id de OT de origen -> OT (para nombres en la respuesta)
    creadas: list[OrdenTrabajo]


async def replicar_cronograma(
    repo: OrdenTrabajoRepository, anio: int, mes: int, simular: bool, zona_horaria: str
) -> ResultadoReplicacion:
    """Copia las mantenciones de `anio`/`mes` al mes siguiente (ver domain/replicacion.py).

    Con `simular=True` solo devuelve el plan (vista previa del operador); con
    `False` crea las OTs en estado `programado`. Las del mismo técnico se
    conservan; si el técnico está inactivo, la OT queda sin asignar.
    """
    tz = ZoneInfo(zona_horaria)
    anio_dest, mes_dest = mes_siguiente(anio, mes)
    origen = await repo.listar_por_mes(anio, mes)
    destino = await repo.listar_por_mes(anio_dest, mes_dest)
    ya_programados = {
        o.ascensor_id
        for o in destino
        if o.tipo == TipoOrdenTrabajo.MANTENCION and o.estado != EstadoOrdenTrabajo.CANCELADO
    }
    plan = planificar_replicacion(
        [
            OrdenOrigen(
                id=o.id,
                codigo=o.codigo,
                ascensor_id=o.ascensor_id,
                tipo=o.tipo,
                estado=o.estado,
                fecha_local=o.fecha_programada.astimezone(tz),
            )
            for o in origen
        ],
        ya_programados,
    )
    por_id = {o.id: o for o in origen}
    creadas: list[OrdenTrabajo] = []
    if not simular and plan.crear:
        nuevas = []
        for p in plan.crear:
            o = por_id[p.origen.id]
            tecnico_activo = o.tecnico is not None and o.tecnico.activo
            nuevas.append(
                OrdenTrabajo(
                    codigo="",
                    tipo=TipoOrdenTrabajo.MANTENCION,
                    prioridad=o.prioridad,
                    estado=EstadoOrdenTrabajo.PROGRAMADO,
                    ascensor_id=o.ascensor_id,
                    tecnico_id=o.tecnico_id if tecnico_activo else None,
                    pauta_id=o.pauta_id,
                    fecha_programada=p.fecha_local,
                    descripcion=o.descripcion,
                )
            )
        creadas = await repo.crear_varias(nuevas)
    return ResultadoReplicacion(
        anio_origen=anio,
        mes_origen=mes,
        anio_destino=anio_dest,
        mes_destino=mes_dest,
        simulacion=simular,
        crear=plan.crear,
        omitidas=plan.omitidas,
        origenes=por_id,
        creadas=creadas,
    )
