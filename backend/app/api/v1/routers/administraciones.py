from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import AdministracionRepoDep
from app.api.v1.schemas.administraciones import AdministracionCrear, AdministracionOut
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.edificios import Coordenadas, EdificioOut
from app.application.use_cases.administraciones import (
    crear_administracion,
    edificios_de_administracion,
    listar_administraciones,
    obtener_administracion,
)
from app.infrastructure.db.models import Administracion
from app.infrastructure.geo import coords_desde_punto

router = APIRouter(prefix="/administraciones", tags=["administraciones"])


@router.get("", response_model=Pagina[AdministracionOut])
async def listar(
    repo: AdministracionRepoDep, limit: int = Query(20, ge=1, le=100), offset: int = 0
):
    items, total = await listar_administraciones(repo, limit, offset)
    return Pagina(items=items, total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=AdministracionOut)
async def obtener(id_: UUID, repo: AdministracionRepoDep):
    administracion = await obtener_administracion(repo, id_)
    if administracion is None:
        raise HTTPException(status_code=404, detail=f"Administración {id_} no encontrada.")
    return administracion


@router.post("", response_model=AdministracionOut, status_code=201)
async def crear(datos: AdministracionCrear, repo: AdministracionRepoDep):
    administracion = Administracion(**datos.model_dump())
    return await crear_administracion(repo, administracion)


@router.get("/{id_}/edificios", response_model=list[EdificioOut])
async def edificios(id_: UUID, repo: AdministracionRepoDep):
    """Navegación drill-down: edificios de una administración."""
    rows = await edificios_de_administracion(repo, id_)
    resultado = []
    for e in rows:
        lat, lon = coords_desde_punto(e.ubicacion) or (0.0, 0.0)
        resultado.append(
            EdificioOut(
                id=e.id,
                administracion_id=e.administracion_id,
                nombre=e.nombre,
                direccion=e.direccion,
                comuna=e.comuna,
                tipo=e.tipo,
                ubicacion=Coordenadas(lat=lat, lon=lon),
                manas=e.manas,
                instrucciones_reinicio=e.instrucciones_reinicio,
                vencimiento_certificacion=e.vencimiento_certificacion,
            )
        )
    return resultado
