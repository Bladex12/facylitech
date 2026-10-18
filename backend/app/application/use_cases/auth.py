"""Casos de uso de autenticación: verificar credenciales y gestionar contraseñas.

scrypt es CPU/memoria intensivo (~100 ms): se ejecuta en un hilo para no bloquear
el event loop del resto de las requests.
"""

import asyncio
from functools import cache
from uuid import UUID

from app.application.errors import NoEncontradoError, PasswordInvalidaError
from app.application.interfaces.repositories import UsuarioRepository
from app.domain.seguridad import (
    hash_password,
    validar_password_nueva,
    verificar_password,
)
from app.infrastructure.db.models import Usuario


@cache
def _hash_senuelo() -> str:
    # Hash válido de una clave cualquiera: se verifica contra él cuando el correo no
    # existe para que la respuesta tarde lo mismo (no revela qué correos existen).
    return hash_password("senuelo-sin-uso")


async def autenticar(repo: UsuarioRepository, email: str, password: str) -> Usuario | None:
    """Usuario activo con esa contraseña, o None (correo inexistente, clave mala,
    usuario inactivo o sin hash: indistinguibles para quien llama)."""
    usuario = await repo.obtener_por_email(email)
    hash_guardado = usuario.password_hash if usuario else None
    ok = await asyncio.to_thread(verificar_password, password, hash_guardado or _hash_senuelo())
    if usuario is None or not hash_guardado or not ok or not usuario.activo:
        return None
    return usuario


async def hashear(password: str) -> str:
    return await asyncio.to_thread(hash_password, password)


async def cambiar_password(
    repo: UsuarioRepository, usuario: Usuario, password_actual: str, password_nueva: str
) -> None:
    """El propio usuario cambia su clave. PasswordInvalidaError (-> 400) si la
    actual no coincide, la nueva es corta o es igual a la actual."""
    if not await asyncio.to_thread(verificar_password, password_actual, usuario.password_hash):
        raise PasswordInvalidaError("La contraseña actual es incorrecta.")
    error = validar_password_nueva(password_nueva)
    if error:
        raise PasswordInvalidaError(error)
    if password_nueva == password_actual:
        raise PasswordInvalidaError("La contraseña nueva debe ser distinta de la actual.")
    await repo.guardar_password_hash(usuario, await hashear(password_nueva))


async def restablecer_password(repo: UsuarioRepository, usuario_id: UUID, password_nueva: str) -> None:
    """Un operador fija la clave de otro usuario (no hay recuperación por correo)."""
    usuario = await repo.obtener(usuario_id)
    if usuario is None:
        raise NoEncontradoError(f"Usuario {usuario_id} no encontrado.")
    await repo.guardar_password_hash(usuario, await hashear(password_nueva))
