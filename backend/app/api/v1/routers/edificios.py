from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import EdificioRepoDep
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.edificios import Coordenadas, EdificioCrear, EdificioOut
from app.application.use_cases.edificios import crear_edificio, listar_edificios, obtener_edificio
from app.infrastructure.db.models import Edificio
from app.infrastructure.geo import coords_desde_punto, punto_desde_coords

router = APIRouter(prefix="/edificios", tags=["edificios"])


def _a_out(edificio: Edificio) -> EdificioOut:
    lat, lon = coords_desde_punto(edificio.ubicacion) or (0.0, 0.0)
    return EdificioOut(
        id=edificio.id,
        nombre=edificio.nombre,
        direccion=edificio.direccion,
        comuna=edificio.comuna,
        tipo=edificio.tipo,
        ubicacion=Coordenadas(lat=lat, lon=lon),
        contacto_nombre=edificio.contacto_nombre,
        contacto_email=edificio.contacto_email,
        contacto_telefono=edificio.contacto_telefono,
        manas=edificio.manas,
        instrucciones_reinicio=edificio.instrucciones_reinicio,
    )


@router.get("", response_model=Pagina[EdificioOut])
async def listar(repo: EdificioRepoDep, limit: int = Query(20, ge=1, le=100), offset: int = 0):
    items, total = await listar_edificios(repo, limit, offset)
    return Pagina(items=[_a_out(e) for e in items], total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=EdificioOut)
async def obtener(id_: UUID, repo: EdificioRepoDep):
    edificio = await obtener_edificio(repo, id_)
    if edificio is None:
        raise HTTPException(status_code=404, detail=f"Edificio {id_} no encontrado.")
    return _a_out(edificio)


@router.post("", response_model=EdificioOut, status_code=201)
async def crear(datos: EdificioCrear, repo: EdificioRepoDep):
    edificio = Edificio(
        **datos.model_dump(exclude={"ubicacion"}),
        ubicacion=punto_desde_coords(datos.ubicacion.lat, datos.ubicacion.lon),
    )
    creado = await crear_edificio(repo, edificio)
    return _a_out(creado)
