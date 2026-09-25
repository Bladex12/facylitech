from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import UsuarioRepoDep
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.usuarios import UsuarioCrear, UsuarioOut
from app.application.use_cases.usuarios import crear_usuario, listar_usuarios, obtener_usuario
from app.domain.enums import RolUsuario
from app.infrastructure.db.models import Usuario

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("", response_model=Pagina[UsuarioOut])
async def listar(
    repo: UsuarioRepoDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    rol: RolUsuario | None = None,
):
    items, total = await listar_usuarios(repo, limit, offset, rol)
    return Pagina(items=items, total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=UsuarioOut)
async def obtener(id_: UUID, repo: UsuarioRepoDep):
    usuario = await obtener_usuario(repo, id_)
    if usuario is None:
        raise HTTPException(status_code=404, detail=f"Usuario {id_} no encontrado.")
    return usuario


@router.post("", response_model=UsuarioOut, status_code=201)
async def crear(datos: UsuarioCrear, repo: UsuarioRepoDep):
    usuario = Usuario(**datos.model_dump())
    return await crear_usuario(repo, usuario)
