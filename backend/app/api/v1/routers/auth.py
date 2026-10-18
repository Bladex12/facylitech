from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Response

from app.api.v1.auth import RegistroIntentosDep, UsuarioActualDep, no_autenticado
from app.api.v1.deps import UsuarioRepoDep
from app.api.v1.schemas.auth import CambiarPasswordIn, LoginIn, LoginOut
from app.api.v1.schemas.usuarios import UsuarioOut
from app.application.errors import PasswordInvalidaError
from app.application.use_cases.auth import autenticar, cambiar_password
from app.domain.enums import RolUsuario
from app.infrastructure.config import settings
from app.infrastructure.tokens import emitir_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _ttl(rol: str) -> timedelta:
    horas = (
        settings.jwt_ttl_operador_horas if rol == RolUsuario.OPERADOR else settings.jwt_ttl_tecnico_horas
    )
    return timedelta(hours=horas)


@router.post("/login", response_model=LoginOut)
async def login(datos: LoginIn, repo: UsuarioRepoDep, intentos: RegistroIntentosDep):
    """Correo + contraseña -> token. Correo inexistente, clave errónea, usuario
    inactivo o sin contraseña devuelven el mismo 401. 429 tras 5 fallos en 15 min."""
    ahora = datetime.now(UTC)
    espera = intentos.segundos_bloqueado(datos.email, ahora)
    if espera:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos. Intente de nuevo más tarde.",
            headers={"Retry-After": str(espera)},
        )
    usuario = await autenticar(repo, datos.email, datos.password)
    if usuario is None:
        intentos.registrar_fallo(datos.email, ahora)
        raise no_autenticado("Correo o contraseña incorrectos.")
    intentos.limpiar(datos.email)
    token, expira_at = emitir_token(
        usuario.id, str(usuario.rol), settings.jwt_secret, _ttl(str(usuario.rol)), ahora
    )
    return LoginOut(
        access_token=token, expira_at=expira_at, usuario=UsuarioOut.model_validate(usuario)
    )


@router.get("/me", response_model=UsuarioOut)
async def me(usuario: UsuarioActualDep):
    return usuario


@router.post("/cambiar-password", status_code=204)
async def cambiar(datos: CambiarPasswordIn, usuario: UsuarioActualDep, repo: UsuarioRepoDep):
    """400 (no 401) si la actual es incorrecta: el frontend cierra sesión ante todo 401."""
    try:
        await cambiar_password(repo, usuario, datos.password_actual, datos.password_nueva)
    except PasswordInvalidaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(status_code=204)
