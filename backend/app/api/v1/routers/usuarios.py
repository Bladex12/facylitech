from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.api.v1.auth import UsuarioActualDep, es_operador, exigir_propio, prohibido, requerir_operador
from app.api.v1.deps import UsuarioRepoDep
from app.api.v1.schemas.auth import RestablecerPasswordIn
from app.api.v1.schemas.common import Pagina
from app.api.v1.schemas.usuarios import UbicacionActualizar, UsuarioCrear, UsuarioOut
from app.application.errors import NoEncontradoError
from app.application.use_cases.auth import hashear, restablecer_password
from app.application.use_cases.usuarios import (
    crear_usuario,
    listar_usuarios,
    obtener_usuario,
    registrar_ubicacion,
)
from app.domain.enums import RolUsuario
from app.infrastructure.db.models import Usuario

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

_SOLO_OPERADOR = [Depends(requerir_operador)]


@router.get("", response_model=Pagina[UsuarioOut], dependencies=_SOLO_OPERADOR)
async def listar(
    repo: UsuarioRepoDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    rol: RolUsuario | None = None,
):
    items, total = await listar_usuarios(repo, limit, offset, rol)
    return Pagina(items=items, total=total, limit=limit, offset=offset)


@router.get("/{id_}", response_model=UsuarioOut)
async def obtener(id_: UUID, repo: UsuarioRepoDep, actual: UsuarioActualDep):
    """Operador: cualquiera. Técnico: solo el propio (403 si pide a otro)."""
    if not es_operador(actual):
        exigir_propio(actual, id_, "otro usuario")
    usuario = await obtener_usuario(repo, id_)
    if usuario is None:
        raise HTTPException(status_code=404, detail=f"Usuario {id_} no encontrado.")
    return usuario


@router.post("", response_model=UsuarioOut, status_code=201, dependencies=_SOLO_OPERADOR)
async def crear(datos: UsuarioCrear, repo: UsuarioRepoDep):
    usuario = Usuario(**datos.model_dump(exclude={"password"}))
    if datos.password:
        usuario.password_hash = await hashear(datos.password)
    return await crear_usuario(repo, usuario)


@router.put("/{id_}/password", status_code=204, dependencies=_SOLO_OPERADOR)
async def restablecer(id_: UUID, datos: RestablecerPasswordIn, repo: UsuarioRepoDep):
    """El operador fija la contraseña de otro usuario (no hay recuperación por correo)."""
    try:
        await restablecer_password(repo, id_, datos.password_nueva)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@router.post("/{id_}/ubicacion", response_model=UsuarioOut)
async def registrar_ubicacion_usuario(
    id_: UUID, datos: UbicacionActualizar, repo: UsuarioRepoDep, actual: UsuarioActualDep
):
    """Registra la última ubicación conocida (el técnico la envía al iniciar/
    aceptar trabajos o con un botón; no hay tracking continuo). Solo la propia."""
    if id_ != actual.id:
        raise prohibido("Solo puede registrar su propia ubicación.")
    try:
        return await registrar_ubicacion(repo, id_, datos.lat, datos.lon, datetime.now(UTC))
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
