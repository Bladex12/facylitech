"""Cercanía de técnicos y despacho en cascada de emergencias.

Las reglas viven en `domain/cercania.py` y `domain/cascada.py`; aquí solo se
orquestan repositorios y se aplican los `Cambio`s del dominio a los modelos.
La cascada se evalúa de forma perezosa (`sincronizar_cascadas`) en cada
lectura/escritura relevante: no hay jobs en segundo plano.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from app.application.errors import ConflictoError, NoEncontradoError, ValidacionError
from app.application.interfaces.repositories import (
    AsignacionRepository,
    EmergenciaRepository,
    OrdenTrabajoRepository,
    TecnicoRepository,
    UsuarioRepository,
)
from app.domain import cascada
from app.domain.cercania import especialidad_calza, eta_min, ordenar_candidatos
from app.domain.enums import (
    EstadoAsignacion,
    EstadoDisponibilidadTecnico,
    EstadoEmergencia,
    EstadoOrdenTrabajo,
    PrioridadOrdenTrabajo,
    RolUsuario,
    TipoOrdenTrabajo,
)
from app.infrastructure.db.models import AsignacionEmergencia, Emergencia, OrdenTrabajo, Usuario
from app.infrastructure.geo import coords_desde_punto

# --- Puente dominio <-> ORM ---------------------------------------------------


def pasos(asignaciones: Iterable[AsignacionEmergencia]) -> list[cascada.Paso]:
    return [
        cascada.Paso(
            id=a.id,
            orden=a.orden,
            estado=EstadoAsignacion(a.estado),
            notificada_at=a.notificada_at,
            respondida_at=a.respondida_at,
            motivo_rechazo=a.motivo_rechazo,
        )
        for a in asignaciones
    ]


def aplicar_cambios(
    asignaciones: Iterable[AsignacionEmergencia], cambios: Iterable[cascada.Cambio]
) -> None:
    por_id = {a.id: a for a in asignaciones}
    for cambio in cambios:
        asignacion = por_id[cambio.id]
        asignacion.estado = cambio.estado
        asignacion.notificada_at = cambio.notificada_at
        asignacion.respondida_at = cambio.respondida_at
        asignacion.motivo_rechazo = cambio.motivo_rechazo


async def sincronizar_cascadas(
    repo: AsignacionRepository, ahora: datetime, tiempo_respuesta: timedelta
) -> None:
    """Evaluación perezosa: expira pendientes vencidas y notifica al siguiente
    en todas las cascadas abiertas (con ~20 usuarios son unas pocas filas)."""
    por_emergencia: dict[UUID, list[AsignacionEmergencia]] = defaultdict(list)
    for asignacion in await repo.de_cascadas_abiertas():
        por_emergencia[asignacion.emergencia_id].append(asignacion)
    hubo_cambios = False
    for grupo in por_emergencia.values():
        cambios = cascada.avanzar_cascada(pasos(grupo), ahora, tiempo_respuesta)
        if cambios:
            aplicar_cambios(grupo, cambios)
            hubo_cambios = True
    if hubo_cambios:
        await repo.confirmar()


# --- Cercanía -----------------------------------------------------------------


@dataclass
class Candidato:
    tecnico: Usuario
    distancia_m: float | None
    eta_min: int | None
    especialidad_match: bool
    disponible: bool
    ordenes_en_curso: int


async def _candidatos(
    repo: TecnicoRepository, lat: float, lon: float, tipo_emergencia: str | None, limit: int
) -> list[Candidato]:
    filas = await repo.con_distancia(lat, lon)
    candidatos = [
        Candidato(
            tecnico=f.tecnico,
            distancia_m=f.distancia_m,
            eta_min=eta_min(f.distancia_m),
            especialidad_match=especialidad_calza(f.tecnico.especialidades, tipo_emergencia),
            disponible=f.tecnico.estado_disponibilidad == EstadoDisponibilidadTecnico.DISPONIBLE,
            ordenes_en_curso=f.ordenes_en_curso,
        )
        for f in filas
    ]
    return ordenar_candidatos(candidatos)[:limit]


async def tecnicos_cercanos(
    repo: TecnicoRepository, lat: float, lon: float, limit: int
) -> list[Candidato]:
    return await _candidatos(repo, lat, lon, None, limit)


def ubicacion_emergencia(emergencia: Emergencia) -> tuple[float, float]:
    coords = coords_desde_punto(emergencia.edificio.ubicacion)
    if coords is None:  # edificio.ubicacion es NOT NULL; defensivo
        raise ConflictoError(f"El edificio de la emergencia {emergencia.codigo} no tiene ubicación.")
    return coords


async def candidatos_emergencia(
    emergencia_repo: EmergenciaRepository,
    tecnico_repo: TecnicoRepository,
    emergencia_id: UUID,
    limit: int,
) -> list[Candidato]:
    emergencia = await emergencia_repo.obtener(emergencia_id)
    if emergencia is None:
        raise NoEncontradoError(f"Emergencia {emergencia_id} no encontrada.")
    lat, lon = ubicacion_emergencia(emergencia)
    return await _candidatos(tecnico_repo, lat, lon, emergencia.tipo, limit)


# --- Despacho -----------------------------------------------------------------


async def despachar_emergencia(
    emergencia_repo: EmergenciaRepository,
    asignacion_repo: AsignacionRepository,
    tecnico_repo: TecnicoRepository,
    usuario_repo: UsuarioRepository,
    emergencia_id: UUID,
    tecnico_ids: list[UUID],
    operador_id: UUID,
    ahora: datetime,
    tiempo_respuesta: timedelta,
) -> Emergencia:
    """Crea la cascada aprobada por el operador (en el orden dado). Si había
    una cascada previa (agotada o en curso), cancela sus asignaciones abiertas."""
    await sincronizar_cascadas(asignacion_repo, ahora, tiempo_respuesta)
    emergencia = await asignacion_repo.emergencia(emergencia_id)
    if emergencia is None:
        raise NoEncontradoError(f"Emergencia {emergencia_id} no encontrada.")
    try:
        cascada.validar_despacho(
            EstadoEmergencia(emergencia.estado),
            [EstadoAsignacion(a.estado) for a in emergencia.asignaciones],
            tecnico_ids,
        )
    except ValueError as exc:
        raise ValidacionError(str(exc)) from exc

    operador = await usuario_repo.obtener(operador_id)
    if operador is None or operador.rol != RolUsuario.OPERADOR:
        raise ValidacionError(f"El usuario {operador_id} no es un operador.")

    lat, lon = ubicacion_emergencia(emergencia)
    filas = await tecnico_repo.con_distancia(lat, lon, tecnico_ids)
    distancia_por_id = {f.tecnico.id: f.distancia_m for f in filas}
    faltantes = [str(t) for t in tecnico_ids if t not in distancia_por_id]
    if faltantes:
        raise ValidacionError(f"No son técnicos activos: {', '.join(faltantes)}.")

    aplicar_cambios(
        emergencia.asignaciones, cascada.cancelar_abiertas(pasos(emergencia.asignaciones), ahora)
    )
    orden_inicial = max((a.orden for a in emergencia.asignaciones), default=0) + 1
    for (orden, estado, notificada_at), tecnico_id in zip(
        cascada.nueva_cascada(len(tecnico_ids), ahora, orden_inicial), tecnico_ids, strict=True
    ):
        asignacion_repo.agregar(
            AsignacionEmergencia(
                emergencia_id=emergencia.id,
                tecnico_id=tecnico_id,
                orden=orden,
                estado=estado,
                distancia_m=distancia_por_id[tecnico_id],
                notificada_at=notificada_at,
                operador_id=operador_id,
            )
        )
    await asignacion_repo.confirmar()
    return await emergencia_repo.obtener(emergencia.id)


async def listar_asignaciones(
    repo: AsignacionRepository,
    tecnico_id: UUID | None,
    estado: EstadoAsignacion | None,
    ahora: datetime,
    tiempo_respuesta: timedelta,
) -> list[AsignacionEmergencia]:
    await sincronizar_cascadas(repo, ahora, tiempo_respuesta)
    return await repo.listar(tecnico_id, estado)


async def _asignacion_sincronizada(
    repo: AsignacionRepository, id_: UUID, ahora: datetime, tiempo_respuesta: timedelta
) -> AsignacionEmergencia:
    await sincronizar_cascadas(repo, ahora, tiempo_respuesta)
    asignacion = await repo.obtener(id_)
    if asignacion is None:
        raise NoEncontradoError(f"Asignación {id_} no encontrada.")
    return asignacion


async def aceptar_asignacion(
    repo: AsignacionRepository,
    orden_repo: OrdenTrabajoRepository,
    id_: UUID,
    ahora: datetime,
    tiempo_respuesta: timedelta,
) -> AsignacionEmergencia:
    """El técnico acepta: cancela al resto, emergencia -> en_atencion, técnico
    -> en_terreno y se crea la OT de emergencia (crítica, programada ahora)."""
    asignacion = await _asignacion_sincronizada(repo, id_, ahora, tiempo_respuesta)
    emergencia = asignacion.emergencia
    if emergencia.estado == EstadoEmergencia.CERRADA:
        raise cascada.CascadaError("La emergencia ya está cerrada.")
    cambios = cascada.aceptar(pasos(emergencia.asignaciones), asignacion.id, ahora, tiempo_respuesta)

    ascensor_id = emergencia.ascensor_id or await repo.primer_ascensor_id(emergencia.edificio_id)
    if ascensor_id is None:
        raise ConflictoError(
            f"El edificio de la emergencia {emergencia.codigo} no tiene equipos registrados; "
            "no se puede crear la orden de trabajo."
        )

    aplicar_cambios(emergencia.asignaciones, cambios)
    emergencia.estado = EstadoEmergencia.EN_ATENCION
    asignacion.tecnico.estado_disponibilidad = EstadoDisponibilidadTecnico.EN_TERRENO
    descripcion = f"Emergencia {emergencia.codigo} ({emergencia.tipo})"
    if emergencia.descripcion:
        descripcion += f": {emergencia.descripcion}"
    repo.agregar(
        OrdenTrabajo(
            codigo=await orden_repo.siguiente_codigo(),
            tipo=TipoOrdenTrabajo.EMERGENCIA,
            prioridad=PrioridadOrdenTrabajo.CRITICA,
            estado=EstadoOrdenTrabajo.PROGRAMADO,
            ascensor_id=ascensor_id,
            tecnico_id=asignacion.tecnico_id,
            emergencia_id=emergencia.id,
            fecha_programada=ahora,
            descripcion=descripcion,
        )
    )
    await repo.confirmar()
    return await repo.obtener(id_)


async def rechazar_asignacion(
    repo: AsignacionRepository,
    id_: UUID,
    motivo: str | None,
    ahora: datetime,
    tiempo_respuesta: timedelta,
) -> AsignacionEmergencia:
    asignacion = await _asignacion_sincronizada(repo, id_, ahora, tiempo_respuesta)
    emergencia = asignacion.emergencia
    cambios = cascada.rechazar(
        pasos(emergencia.asignaciones), asignacion.id, ahora, tiempo_respuesta, motivo
    )
    aplicar_cambios(emergencia.asignaciones, cambios)
    await repo.confirmar()
    return await repo.obtener(id_)
