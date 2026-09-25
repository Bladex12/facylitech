from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import AscensorRepoDep
from app.api.v1.schemas.ascensores import AscensorCrear, AscensorOut
from app.api.v1.schemas.common import Pagina
from app.application.use_cases.ascensores import (
    crear_ascensor,
    listar_ascensores,
    obtener_ascensor,
)
from app.infrastructure.db.models import Ascensor

router = APIRouter(prefix="/ascensores", tags=["ascensores"])


@router.get("", response_model=Pagina[AscensorOut])
async def listar(
    repo: AscensorRepoDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    edificio_id: UUID | None = None,
):
    items, total = await listar_ascensores(repo, limit, offset, edificio_id)
    return Pagina(items=items, total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=AscensorOut)
async def obtener(id_: UUID, repo: AscensorRepoDep):
    ascensor = await obtener_ascensor(repo, id_)
    if ascensor is None:
        raise HTTPException(status_code=404, detail=f"Ascensor {id_} no encontrado.")
    return ascensor


@router.post("", response_model=AscensorOut, status_code=201)
async def crear(datos: AscensorCrear, repo: AscensorRepoDep):
    ascensor = Ascensor(**datos.model_dump())
    return await crear_ascensor(repo, ascensor)
