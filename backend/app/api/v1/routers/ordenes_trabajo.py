from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.v1.auth import (
    OrdenAccesibleDep,
    UsuarioActualDep,
    es_operador,
    exigir_propio,
    requerir_operador,
)
from app.api.v1.deps import OrdenRepoDep, PapeletaRepoDep, UsuarioRepoDep
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.ordenes_trabajo import (
    OrdenOmitidaOut,
    OrdenReplicada,
    OrdenTrabajoActualizar,
    OrdenTrabajoCrear,
    OrdenTrabajoOut,
    ReplicacionOut,
    ReplicarCronograma,
)
from app.api.v1.schemas.papeletas import PapeletaOut
from app.api.v1.serializers import construir_orden_out
from app.application.errors import DatosInvalidosError, NoEncontradoError
from app.application.use_cases.ordenes_trabajo import (
    actualizar_orden,
    cancelar_orden,
    completar_orden,
    crear_orden,
    iniciar_orden,
    listar_ordenes,
    obtener_orden,
    replicar_cronograma,
)
from app.application.use_cases.papeletas import crear_papeleta_desde_orden
from app.domain.enums import EstadoOrdenTrabajo, TipoOrdenTrabajo
from app.domain.transiciones import TransicionInvalidaError
from app.infrastructure.config import settings
from app.infrastructure.db.models import OrdenTrabajo

router = APIRouter(prefix="/ordenes-trabajo", tags=["ordenes-trabajo"])
_SOLO_OPERADOR = [Depends(requerir_operador)]


@router.get("", response_model=Pagina[OrdenTrabajoOut])
async def listar(
    repo: OrdenRepoDep,
    actual: UsuarioActualDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    desde: date | None = None,
    hasta: date | None = None,
    tecnico_id: UUID | None = None,
    estado: EstadoOrdenTrabajo | None = None,
    tipo: TipoOrdenTrabajo | None = None,
    edificio_id: UUID | None = None,
):
    if not es_operador(actual):
        # El técnico solo ve sus órdenes: si pide las de otro -> 403; si no filtra, se fuerza el propio.
        if tecnico_id is not None:
            exigir_propio(actual, tecnico_id, "otro técnico")
        tecnico_id = actual.id
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
async def obtener(id_: UUID, repo: OrdenRepoDep, _acceso: OrdenAccesibleDep):
    try:
        orden = await obtener_orden(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return construir_orden_out(orden, datetime.now(UTC))


@router.post("", response_model=OrdenTrabajoOut, status_code=201, dependencies=_SOLO_OPERADOR)
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


@router.post("/replicar", response_model=ReplicacionOut, dependencies=_SOLO_OPERADOR)
async def replicar(datos: ReplicarCronograma, repo: OrdenRepoDep):
    """Replica las mantenciones del mes al mes siguiente (botón del calendario).

    `simular=true` (default) devuelve la vista previa sin crear nada; con
    `simular=false` crea las OTs. Repetirlo no duplica: los equipos que ya tienen
    mantención en el mes de destino se omiten (`motivo: ya_programada`).
    """
    anio, mes = (int(x) for x in datos.mes.split("-"))
    r = await replicar_cronograma(repo, anio, mes, datos.simular, settings.timezone)
    codigos = [o.codigo for o in r.creadas] if r.creadas else [None] * len(r.crear)
    crear = []
    for plan, codigo in zip(r.crear, codigos, strict=True):
        o = r.origenes[plan.origen.id]
        crear.append(
            OrdenReplicada(
                origen_codigo=o.codigo,
                ascensor_codigo=o.ascensor.codigo,
                edificio_nombre=o.ascensor.edificio.nombre,
                tecnico_nombre=o.tecnico.nombre if o.tecnico and o.tecnico.activo else None,
                fecha_origen=o.fecha_programada,
                fecha_programada=plan.fecha_local,
                codigo=codigo,
            )
        )
    omitidas = [
        OrdenOmitidaOut(
            origen_codigo=r.origenes[om.origen.id].codigo,
            ascensor_codigo=r.origenes[om.origen.id].ascensor.codigo,
            edificio_nombre=r.origenes[om.origen.id].ascensor.edificio.nombre,
            motivo=om.motivo,
        )
        for om in r.omitidas
    ]
    return ReplicacionOut(
        mes_origen=f"{r.anio_origen}-{r.mes_origen:02d}",
        mes_destino=f"{r.anio_destino}-{r.mes_destino:02d}",
        simulacion=r.simulacion,
        total_crear=len(crear),
        crear=crear,
        omitidas=omitidas,
    )


@router.patch("/{id_}", response_model=OrdenTrabajoOut, dependencies=_SOLO_OPERADOR)
async def actualizar(
    id_: UUID, datos: OrdenTrabajoActualizar, repo: OrdenRepoDep, usuario_repo: UsuarioRepoDep
):
    try:
        orden = await actualizar_orden(repo, usuario_repo, id_, datos.cambios())
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TransicionInvalidaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DatosInvalidosError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return construir_orden_out(orden, datetime.now(UTC))


@router.post("/{id_}/cancelar", response_model=OrdenTrabajoOut, dependencies=_SOLO_OPERADOR)
async def cancelar(id_: UUID, repo: OrdenRepoDep):
    try:
        orden = await cancelar_orden(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TransicionInvalidaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return construir_orden_out(orden, datetime.now(UTC))


@router.post("/{id_}/iniciar", response_model=OrdenTrabajoOut)
async def iniciar(id_: UUID, repo: OrdenRepoDep, _acceso: OrdenAccesibleDep):
    try:
        orden = await iniciar_orden(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TransicionInvalidaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return construir_orden_out(orden, datetime.now(UTC))


@router.post("/{id_}/completar", response_model=OrdenTrabajoOut)
async def completar(id_: UUID, repo: OrdenRepoDep, _acceso: OrdenAccesibleDep):
    try:
        orden = await completar_orden(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TransicionInvalidaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return construir_orden_out(orden, datetime.now(UTC))


@router.post("/{id_}/papeleta", response_model=PapeletaOut, status_code=201)
async def crear_papeleta(
    id_: UUID, orden_repo: OrdenRepoDep, papeleta_repo: PapeletaRepoDep, _acceso: OrdenAccesibleDep
):
    try:
        orden = await obtener_orden(orden_repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return await crear_papeleta_desde_orden(papeleta_repo, orden, mes=datetime.now(UTC).month)
