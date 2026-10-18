from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.v1.auth import requerir_operador, usuario_actual
from app.api.v1.deps import EdificioRepoDep
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.edificios import (
    Coordenadas,
    EdificioActualizar,
    EdificioCrear,
    EdificioOut,
)
from app.application.errors import NoEncontradoError
from app.application.use_cases.edificios import (
    actualizar_edificio,
    crear_edificio,
    listar_edificios,
    obtener_edificio,
)
from app.infrastructure.db.models import Edificio
from app.infrastructure.geo import coords_desde_punto, punto_desde_coords

# Lectura: cualquier usuario autenticado (el técnico la necesita). Escritura: operador.
router = APIRouter(prefix="/edificios", tags=["edificios"], dependencies=[Depends(usuario_actual)])
_SOLO_OPERADOR = [Depends(requerir_operador)]


def _a_out(edificio: Edificio) -> EdificioOut:
    lat, lon = coords_desde_punto(edificio.ubicacion) or (0.0, 0.0)
    return EdificioOut(
        id=edificio.id,
        administracion_id=edificio.administracion_id,
        nombre=edificio.nombre,
        direccion=edificio.direccion,
        comuna=edificio.comuna,
        tipo=edificio.tipo,
        ubicacion=Coordenadas(lat=lat, lon=lon),
        manas=edificio.manas,
        instrucciones_reinicio=edificio.instrucciones_reinicio,
        vencimiento_certificacion=edificio.vencimiento_certificacion,
        contacto_nombre=edificio.contacto_nombre,
        contacto_telefono=edificio.contacto_telefono,
        contacto_email=edificio.contacto_email,
    )


@router.get("", response_model=Pagina[EdificioOut])
async def listar(
    repo: EdificioRepoDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    administracion_id: UUID | None = None,
):
    items, total = await listar_edificios(repo, limit, offset, administracion_id)
    return Pagina(items=[_a_out(e) for e in items], total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=EdificioOut)
async def obtener(id_: UUID, repo: EdificioRepoDep):
    edificio = await obtener_edificio(repo, id_)
    if edificio is None:
        raise HTTPException(status_code=404, detail=f"Edificio {id_} no encontrado.")
    return _a_out(edificio)


@router.post("", response_model=EdificioOut, status_code=201, dependencies=_SOLO_OPERADOR)
async def crear(datos: EdificioCrear, repo: EdificioRepoDep):
    edificio = Edificio(
        **datos.model_dump(exclude={"ubicacion"}),
        ubicacion=punto_desde_coords(datos.ubicacion.lat, datos.ubicacion.lon),
    )
    creado = await crear_edificio(repo, edificio)
    return _a_out(creado)


@router.patch("/{id_}", response_model=EdificioOut, dependencies=_SOLO_OPERADOR)
async def actualizar(id_: UUID, datos: EdificioActualizar, repo: EdificioRepoDep):
    try:
        edificio = await actualizar_edificio(repo, id_, datos.cambios())
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _a_out(edificio)
