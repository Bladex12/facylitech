from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.v1.auth import AsignacionPropiaDep, UsuarioActualDep, es_operador, exigir_propio
from app.api.v1.deps import AsignacionRepoDep, OrdenRepoDep, TiempoRespuestaDep
from app.api.v1.schemas.emergencias import (
    AsignacionEmergenciaOut,
    AsignacionTecnicoOut,
    RechazarAsignacion,
)
from app.api.v1.serializers import construir_asignacion_out, construir_asignacion_tecnico_out
from app.application.errors import ConflictoError, NoEncontradoError
from app.application.use_cases.cascada import (
    aceptar_asignacion,
    listar_asignaciones,
    rechazar_asignacion,
)
from app.domain.cascada import CascadaError
from app.domain.enums import EstadoAsignacion

router = APIRouter(prefix="/asignaciones", tags=["asignaciones"])


@router.get("", response_model=list[AsignacionTecnicoOut])
async def listar(
    repo: AsignacionRepoDep,
    tiempo_respuesta: TiempoRespuestaDep,
    actual: UsuarioActualDep,
    tecnico_id: UUID | None = None,
    estado: EstadoAsignacion | Literal["todas"] = EstadoAsignacion.PENDIENTE,
):
    """Asignaciones del técnico (por defecto solo las `pendiente`; `estado=todas` devuelve todas).
    Técnico: solo las propias (otro `tecnico_id` -> 403; sin filtro se fuerza el propio)."""
    if not es_operador(actual):
        if tecnico_id is not None:
            exigir_propio(actual, tecnico_id, "otro técnico")
        tecnico_id = actual.id
    asignaciones = await listar_asignaciones(
        repo,
        tecnico_id,
        None if estado == "todas" else EstadoAsignacion(estado),
        datetime.now(UTC),
        tiempo_respuesta,
    )
    return [construir_asignacion_tecnico_out(a, tiempo_respuesta) for a in asignaciones]


@router.post("/{id_}/aceptar", response_model=AsignacionEmergenciaOut)
async def aceptar(
    id_: UUID,
    repo: AsignacionRepoDep,
    orden_repo: OrdenRepoDep,
    tiempo_respuesta: TiempoRespuestaDep,
    _propia: AsignacionPropiaDep,
):
    """Acepta la emergencia: cancela al resto de la cascada, crea la OT de
    emergencia (crítica) y deja al técnico `en_terreno`. 409 si ya no está pendiente."""
    try:
        asignacion = await aceptar_asignacion(
            repo, orden_repo, id_, datetime.now(UTC), tiempo_respuesta
        )
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (CascadaError, ConflictoError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return construir_asignacion_out(asignacion, tiempo_respuesta)


@router.post("/{id_}/rechazar", response_model=AsignacionEmergenciaOut)
async def rechazar(
    id_: UUID,
    repo: AsignacionRepoDep,
    tiempo_respuesta: TiempoRespuestaDep,
    _propia: AsignacionPropiaDep,
    datos: RechazarAsignacion | None = None,
):
    try:
        asignacion = await rechazar_asignacion(
            repo, id_, datos.motivo if datos else None, datetime.now(UTC), tiempo_respuesta
        )
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CascadaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return construir_asignacion_out(asignacion, tiempo_respuesta)
