from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import PautaRepoDep
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.pautas import PautaCrear, PautaOut
from app.application.use_cases.pautas import crear_pauta, listar_pautas, obtener_pauta
from app.infrastructure.db.models import PautaItem, PautaMantencion

router = APIRouter(prefix="/pautas", tags=["pautas"])


@router.get("", response_model=Pagina[PautaOut])
async def listar(repo: PautaRepoDep, limit: int = Query(20, ge=1, le=100), offset: int = 0):
    items, total = await listar_pautas(repo, limit, offset)
    return Pagina(items=items, total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=PautaOut)
async def obtener(id_: UUID, repo: PautaRepoDep):
    pauta = await obtener_pauta(repo, id_)
    if pauta is None:
        raise HTTPException(status_code=404, detail=f"Pauta {id_} no encontrada.")
    return pauta


@router.post("", response_model=PautaOut, status_code=201)
async def crear(datos: PautaCrear, repo: PautaRepoDep):
    pauta = PautaMantencion(
        nombre=datos.nombre,
        tipo_equipo=datos.tipo_equipo,
        descripcion=datos.descripcion,
        items=[
            PautaItem(orden=i.orden, descripcion=i.descripcion, meses=i.meses, activo=i.activo)
            for i in datos.items
        ],
    )
    return await crear_pauta(repo, pauta)
