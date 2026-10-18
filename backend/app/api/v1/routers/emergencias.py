from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import (
    AsignacionRepoDep,
    EmergenciaRepoDep,
    TecnicoRepoDep,
    TiempoRespuestaDep,
    UsuarioRepoDep,
)
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.emergencias import (
    DespacharEmergencia,
    EmergenciaActualizarEstado,
    EmergenciaCrear,
    EmergenciaOut,
)
from app.api.v1.schemas.tecnicos import CandidatoTecnicoOut
from app.api.v1.serializers import construir_candidato_out, construir_emergencia_out
from app.application.errors import ConflictoError, NoEncontradoError, ValidacionError
from app.application.use_cases.cascada import (
    candidatos_emergencia,
    despachar_emergencia,
    sincronizar_cascadas,
)
from app.application.use_cases.emergencias import (
    actualizar_estado_emergencia,
    crear_emergencia,
    listar_emergencias,
    obtener_emergencia,
)
from app.domain.cascada import CascadaError
from app.domain.enums import EstadoEmergencia
from app.infrastructure.db.models import Emergencia

router = APIRouter(prefix="/emergencias", tags=["emergencias"])


@router.get("", response_model=Pagina[EmergenciaOut])
async def listar(
    repo: EmergenciaRepoDep,
    asignacion_repo: AsignacionRepoDep,
    tiempo_respuesta: TiempoRespuestaDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    estado: EstadoEmergencia | None = None,
):
    await sincronizar_cascadas(asignacion_repo, datetime.now(UTC), tiempo_respuesta)
    items, total = await listar_emergencias(repo, limit, offset, estado)
    return Pagina(
        items=[construir_emergencia_out(e, tiempo_respuesta) for e in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{id_}", response_model=EmergenciaOut)
async def obtener(
    id_: UUID,
    repo: EmergenciaRepoDep,
    asignacion_repo: AsignacionRepoDep,
    tiempo_respuesta: TiempoRespuestaDep,
):
    await sincronizar_cascadas(asignacion_repo, datetime.now(UTC), tiempo_respuesta)
    try:
        emergencia = await obtener_emergencia(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return construir_emergencia_out(emergencia, tiempo_respuesta)


@router.post("", response_model=EmergenciaOut, status_code=201)
async def crear(datos: EmergenciaCrear, repo: EmergenciaRepoDep, tiempo_respuesta: TiempoRespuestaDep):
    emergencia = Emergencia(
        codigo="",
        tipo=datos.tipo,
        edificio_id=datos.edificio_id,
        ascensor_id=datos.ascensor_id,
        descripcion=datos.descripcion,
        solicitante=datos.solicitante,
        reportada_at=datos.reportada_at or datetime.now(UTC),
    )
    creada = await crear_emergencia(repo, emergencia)
    return construir_emergencia_out(creada, tiempo_respuesta)


@router.patch("/{id_}/estado", response_model=EmergenciaOut)
async def actualizar_estado(
    id_: UUID,
    datos: EmergenciaActualizarEstado,
    repo: EmergenciaRepoDep,
    asignacion_repo: AsignacionRepoDep,
    tiempo_respuesta: TiempoRespuestaDep,
):
    ahora = datetime.now(UTC)
    await sincronizar_cascadas(asignacion_repo, ahora, tiempo_respuesta)
    try:
        emergencia = await actualizar_estado_emergencia(repo, id_, datos.estado, ahora)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return construir_emergencia_out(emergencia, tiempo_respuesta)


@router.get("/{id_}/candidatos", response_model=list[CandidatoTecnicoOut])
async def candidatos(
    id_: UUID,
    repo: EmergenciaRepoDep,
    tecnico_repo: TecnicoRepoDep,
    limit: int = Query(5, ge=1, le=50),
):
    """Técnicos sugeridos para la emergencia: disponibles primero, luego con la
    especialidad del tipo de emergencia, luego por distancia (PostGIS)."""
    try:
        resultado = await candidatos_emergencia(repo, tecnico_repo, id_, limit)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [construir_candidato_out(c) for c in resultado]


@router.post("/{id_}/despachar", response_model=EmergenciaOut)
async def despachar(
    id_: UUID,
    datos: DespacharEmergencia,
    repo: EmergenciaRepoDep,
    asignacion_repo: AsignacionRepoDep,
    tecnico_repo: TecnicoRepoDep,
    usuario_repo: UsuarioRepoDep,
    tiempo_respuesta: TiempoRespuestaDep,
):
    """El operador aprueba la cascada: el primer técnico queda `pendiente`, el
    resto `en_espera`. Re-despachar cancela las asignaciones abiertas previas."""
    try:
        emergencia = await despachar_emergencia(
            repo,
            asignacion_repo,
            tecnico_repo,
            usuario_repo,
            id_,
            datos.tecnico_ids,
            datos.operador_id,
            datetime.now(UTC),
            tiempo_respuesta,
        )
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (CascadaError, ConflictoError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValidacionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return construir_emergencia_out(emergencia, tiempo_respuesta)
