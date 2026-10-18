from datetime import datetime
from uuid import UUID

from app.application.errors import NoEncontradoError
from app.application.interfaces.repositories import UsuarioRepository
from app.domain.enums import RolUsuario
from app.infrastructure.db.models import Usuario


async def listar_usuarios(repo: UsuarioRepository, limit: int, offset: int, rol: RolUsuario | None):
    return await repo.listar(limit, offset, rol)


async def obtener_usuario(repo: UsuarioRepository, id_: UUID) -> Usuario | None:
    return await repo.obtener(id_)


async def crear_usuario(repo: UsuarioRepository, usuario: Usuario) -> Usuario:
    return await repo.crear(usuario)


async def registrar_ubicacion(
    repo: UsuarioRepository, id_: UUID, lat: float, lon: float, momento: datetime
) -> Usuario:
    """Última ubicación conocida (base del tracking GPS por eventos, no continuo)."""
    usuario = await repo.obtener(id_)
    if usuario is None:
        raise NoEncontradoError(f"Usuario {id_} no encontrado.")
    return await repo.actualizar_ubicacion(usuario, lat, lon, momento)
