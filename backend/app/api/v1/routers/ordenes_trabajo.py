from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import OrdenRepoDep, PapeletaRepoDep
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.ordenes_trabajo import OrdenTrabajoCrear, OrdenTrabajoOut
from app.api.v1.schemas.papeletas import PapeletaOut
from app.api.v1.serializers import construir_orden_out
from app.application.errors import NoEncontradoError
from app.application.use_cases.ordenes_trabajo import (
    completar_orden,
    crear_orden,
    iniciar_orden,
    listar_ordenes,
    obtener_orden,
)
from app.application.use_cases.papeletas import crear_papeleta_desde_orden
from app.domain.enums import EstadoOrdenTrabajo, TipoOrdenTrabajo
from app.domain.transiciones import TransicionInvalidaError
from app.infrastructure.db.models import OrdenTrabajo

router = APIRouter(prefix="/ordenes-trabajo", tags=["ordenes-trabajo"])


@router.get("", response_model=Pagina[OrdenTrabajoOut])
async def listar(
    repo: OrdenRepoDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    desde: date | None = None,
    hasta: date | None = None,
    tecnico_id: UUID | None = None,
    estado: EstadoOrdenTrabajo | None = None,
    tipo: TipoOrdenTrabajo | None = None,
    edificio_id: UUID | None = None,
):
    items, total = await listar_ordenes(
        repo, limit, offset, desde, hasta, tecnico_id, estado, tipo, edificio_id
    )
    ahora = datetime.now(UTC)
    return Pagina(
        items=[construir_orden_out(o, ahora) for o in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{id_}", response_model=OrdenTrabajoOut)
async def obtener(id_: UUID, repo: OrdenRepoDep):
    try:
        orden = await obtener_orden(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return construir_orden_out(orden, datetime.now(UTC))


@router.post("", response_model=OrdenTrabajoOut, status_code=201)
async def crear(datos: OrdenTrabajoCrear, repo: OrdenRepoDep):
    orden = OrdenTrabajo(
        tipo=datos.tipo,
        prioridad=datos.prioridad,
        ascensor_id=datos.ascensor_id,
        tecnico_id=datos.tecnico_id,
        pauta_id=datos.pauta_id,
        emergencia_id=datos.emergencia_id,
        fecha_programada=datos.fecha_programada,
        descripcion=datos.descripcion,
        codigo="",
    )
    creada = await crear_orden(repo, orden)
    return construir_orden_out(creada, datetime.now(UTC))


@router.post("/{id_}/iniciar", response_model=OrdenTrabajoOut)
async def iniciar(id_: UUID, repo: OrdenRepoDep):
    try:
        orden = await iniciar_orden(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TransicionInvalidaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return construir_orden_out(orden, datetime.now(UTC))


@router.post("/{id_}/completar", response_model=OrdenTrabajoOut)
async def completar(id_: UUID, repo: OrdenRepoDep):
    try:
        orden = await completar_orden(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TransicionInvalidaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return construir_orden_out(orden, datetime.now(UTC))


@router.post("/{id_}/papeleta", response_model=PapeletaOut, status_code=201)
async def crear_papeleta(id_: UUID, orden_repo: OrdenRepoDep, papeleta_repo: PapeletaRepoDep):
    try:
        orden = await obtener_orden(orden_repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return await crear_papeleta_desde_orden(papeleta_repo, orden, mes=datetime.now(UTC).month)
