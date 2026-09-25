from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import EmergenciaRepoDep
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.emergencias import (
    EmergenciaActualizarEstado,
    EmergenciaCrear,
    EmergenciaOut,
)
from app.application.errors import NoEncontradoError
from app.application.use_cases.emergencias import (
    actualizar_estado_emergencia,
    crear_emergencia,
    listar_emergencias,
    obtener_emergencia,
)
from app.domain.enums import EstadoEmergencia
from app.infrastructure.db.models import Emergencia

router = APIRouter(prefix="/emergencias", tags=["emergencias"])


@router.get("", response_model=Pagina[EmergenciaOut])
async def listar(
    repo: EmergenciaRepoDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    estado: EstadoEmergencia | None = None,
):
    items, total = await listar_emergencias(repo, limit, offset, estado)
    return Pagina(items=items, total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=EmergenciaOut)
async def obtener(id_: UUID, repo: EmergenciaRepoDep):
    try:
        return await obtener_emergencia(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("", response_model=EmergenciaOut, status_code=201)
async def crear(datos: EmergenciaCrear, repo: EmergenciaRepoDep):
    emergencia = Emergencia(
        codigo="",
        tipo=datos.tipo,
        edificio_id=datos.edificio_id,
        ascensor_id=datos.ascensor_id,
        descripcion=datos.descripcion,
        solicitante=datos.solicitante,
        reportada_at=datos.reportada_at or datetime.now(UTC),
    )
    return await crear_emergencia(repo, emergencia)


@router.patch("/{id_}/estado", response_model=EmergenciaOut)
async def actualizar_estado(id_: UUID, datos: EmergenciaActualizarEstado, repo: EmergenciaRepoDep):
    try:
        return await actualizar_estado_emergencia(repo, id_, datos.estado)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
