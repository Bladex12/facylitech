"""Construye DTOs de salida que requieren datos calculados (semáforo) que no
viven en el modelo ORM."""

from datetime import datetime, timedelta
from uuid import UUID

from app.api.v1.schemas.common import Coordenadas
from app.api.v1.schemas.emergencias import AscensorResumen as AscensorResumenEmergencia
from app.api.v1.schemas.emergencias import (
    AsignacionEmergenciaOut,
    AsignacionTecnicoOut,
    EmergenciaOut,
)
from app.api.v1.schemas.emergencias import EdificioResumen as EdificioResumenEmergencia
from app.api.v1.schemas.emergencias import TecnicoResumen as TecnicoResumenEmergencia
from app.api.v1.schemas.mapa import (
    MapaData,
    MapaEdificio,
    MapaEmergencia,
    MapaTecnico,
    OrdenActualMapa,
)
from app.api.v1.schemas.ordenes_trabajo import AscensorResumen, OrdenTrabajoOut, TecnicoResumen
from app.api.v1.schemas.tecnicos import CandidatoTecnicoOut
from app.api.v1.schemas.usuarios import UsuarioOut
from app.application.use_cases.cascada import Candidato
from app.domain.cascada import cascada_agotada, expira_at
from app.domain.enums import EstadoAsignacion, EstadoEmergencia, EstadoOrdenTrabajo
from app.domain.semaforo import calcular_semaforo
from app.infrastructure.db.models import AsignacionEmergencia, Emergencia, OrdenTrabajo
from app.infrastructure.geo import coords_desde_punto
from app.infrastructure.repositories.mapa import DatosMapa


def construir_orden_out(orden: OrdenTrabajo, ahora: datetime) -> OrdenTrabajoOut:
    semaforo = calcular_semaforo(orden.estado, orden.fecha_programada, ahora)
    return OrdenTrabajoOut(
        id=orden.id,
        codigo=orden.codigo,
        tipo=orden.tipo,
        prioridad=orden.prioridad,
        estado=orden.estado,
        semaforo=semaforo,
        ascensor=AscensorResumen.model_validate(orden.ascensor),
        tecnico=TecnicoResumen.model_validate(orden.tecnico) if orden.tecnico else None,
        emergencia_id=orden.emergencia_id,
        fecha_programada=orden.fecha_programada,
        inicio_real=orden.inicio_real,
        fin_real=orden.fin_real,
        descripcion=orden.descripcion,
        papeleta_id=orden.papeleta.id if orden.papeleta else None,
        papeleta_estado=orden.papeleta.estado if orden.papeleta else None,
    )


# --- Contrato octubre 2026: emergencias con cascada, candidatos, mapa ---------


def _coordenadas(geog) -> Coordenadas | None:
    coords = coords_desde_punto(geog)
    return None if coords is None else Coordenadas(lat=coords[0], lon=coords[1])


def construir_asignacion_out(
    asignacion: AsignacionEmergencia, tiempo_respuesta: timedelta
) -> AsignacionEmergenciaOut:
    return AsignacionEmergenciaOut(
        id=asignacion.id,
        emergencia_id=asignacion.emergencia_id,
        tecnico=TecnicoResumenEmergencia.model_validate(asignacion.tecnico),
        orden=asignacion.orden,
        estado=asignacion.estado,
        distancia_m=asignacion.distancia_m,
        notificada_at=asignacion.notificada_at,
        respondida_at=asignacion.respondida_at,
        expira_at=expira_at(
            EstadoAsignacion(asignacion.estado), asignacion.notificada_at, tiempo_respuesta
        ),
        motivo_rechazo=asignacion.motivo_rechazo,
    )


def _orden_de_emergencia(emergencia: Emergencia) -> UUID | None:
    """`emergencia.orden_trabajo_id` no es columna: se deriva de
    `orden_trabajo.emergencia_id` (la más reciente no cancelada)."""
    vigentes = [o for o in emergencia.ordenes if o.estado != EstadoOrdenTrabajo.CANCELADO]
    candidatas = vigentes or list(emergencia.ordenes)
    if not candidatas:
        return None
    return max(candidatas, key=lambda o: o.created_at).id


def construir_emergencia_out(emergencia: Emergencia, tiempo_respuesta: timedelta) -> EmergenciaOut:
    asignaciones = sorted(emergencia.asignaciones, key=lambda a: a.orden)
    return EmergenciaOut(
        id=emergencia.id,
        codigo=emergencia.codigo,
        tipo=emergencia.tipo,
        edificio=EdificioResumenEmergencia.model_validate(emergencia.edificio),
        ascensor=AscensorResumenEmergencia.model_validate(emergencia.ascensor)
        if emergencia.ascensor
        else None,
        reportada_at=emergencia.reportada_at,
        descripcion=emergencia.descripcion,
        solicitante=emergencia.solicitante,
        estado=emergencia.estado,
        ubicacion=_coordenadas(emergencia.edificio.ubicacion),
        asignaciones=[construir_asignacion_out(a, tiempo_respuesta) for a in asignaciones],
        cascada_agotada=emergencia.estado != EstadoEmergencia.CERRADA
        and cascada_agotada(EstadoAsignacion(a.estado) for a in asignaciones),
        orden_trabajo_id=_orden_de_emergencia(emergencia),
    )


def construir_asignacion_tecnico_out(
    asignacion: AsignacionEmergencia, tiempo_respuesta: timedelta
) -> AsignacionTecnicoOut:
    base = construir_asignacion_out(asignacion, tiempo_respuesta)
    return AsignacionTecnicoOut(
        **base.model_dump(),
        emergencia=construir_emergencia_out(asignacion.emergencia, tiempo_respuesta),
    )


def construir_candidato_out(candidato: Candidato) -> CandidatoTecnicoOut:
    return CandidatoTecnicoOut(
        tecnico=UsuarioOut.model_validate(candidato.tecnico),
        distancia_m=candidato.distancia_m,
        eta_min=candidato.eta_min,
        especialidad_match=candidato.especialidad_match,
        disponible=candidato.disponible,
        ordenes_en_curso=candidato.ordenes_en_curso,
    )


def construir_mapa_out(datos: DatosMapa) -> MapaData:
    tecnicos = []
    for t in datos.tecnicos:
        orden = datos.ordenes_en_curso.get(t.id)
        tecnicos.append(
            MapaTecnico(
                id=t.id,
                nombre=t.nombre,
                estado_disponibilidad=t.estado_disponibilidad,
                ubicacion=_coordenadas(t.ultima_ubicacion),
                ubicacion_at=t.ultima_ubicacion_at,
                orden_actual=OrdenActualMapa(
                    id=orden.id, codigo=orden.codigo, edificio_nombre=orden.ascensor.edificio.nombre
                )
                if orden
                else None,
            )
        )
    return MapaData(
        edificios=[
            MapaEdificio(
                id=e.edificio.id,
                nombre=e.edificio.nombre,
                direccion=e.edificio.direccion,
                comuna=e.edificio.comuna,
                tipo=e.edificio.tipo,
                ubicacion=_coordenadas(e.edificio.ubicacion),
                total_equipos=e.total_equipos,
                equipos_con_falla=e.equipos_con_falla,
                ordenes_hoy=e.ordenes_hoy,
                emergencia_activa=e.emergencia_activa,
            )
            for e in datos.edificios
        ],
        tecnicos=tecnicos,
        emergencias=[
            MapaEmergencia(
                id=em.id,
                codigo=em.codigo,
                tipo=em.tipo,
                edificio_id=em.edificio_id,
                edificio_nombre=em.edificio.nombre,
                ubicacion=_coordenadas(em.edificio.ubicacion),
                reportada_at=em.reportada_at,
                estado=em.estado,
            )
            for em in datos.emergencias
        ],
    )
