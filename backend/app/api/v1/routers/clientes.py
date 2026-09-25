from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import ClienteRepoDep
from app.api.v1.schemas.administraciones import AdministracionOut
from app.api.v1.schemas.clientes import ClienteCrear, ClienteOut
from app.api.v1.schemas.common import Pagina
from app.application.use_cases.clientes import (
    administraciones_del_cliente,
    crear_cliente,
    listar_clientes,
    obtener_cliente,
)
from app.infrastructure.db.models import Cliente

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=Pagina[ClienteOut])
async def listar(repo: ClienteRepoDep, limit: int = Query(20, ge=1, le=100), offset: int = 0):
    items, total = await listar_clientes(repo, limit, offset)
    return Pagina(items=items, total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=ClienteOut)
async def obtener(id_: UUID, repo: ClienteRepoDep):
    cliente = await obtener_cliente(repo, id_)
    if cliente is None:
        raise HTTPException(status_code=404, detail=f"Cliente {id_} no encontrado.")
    return cliente


@router.post("", response_model=ClienteOut, status_code=201)
async def crear(datos: ClienteCrear, repo: ClienteRepoDep):
    cliente = Cliente(**datos.model_dump())
    return await crear_cliente(repo, cliente)


@router.get("/{id_}/administraciones", response_model=list[AdministracionOut])
async def administraciones(id_: UUID, repo: ClienteRepoDep):
    """Navegación drill-down: administraciones de un cliente."""
    return await administraciones_del_cliente(repo, id_)
