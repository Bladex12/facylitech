"""Dependencias de autenticación y autorización (docs/contrato-auth.md).

- `UsuarioActualDep`: exige un Bearer válido y consulta la BD en cada request
  (RNF-06 lo permite), así un usuario desactivado/eliminado pierde acceso al
  instante aunque su token no haya expirado. 401 en cualquier fallo.
- `OperadorDep`: además exige rol operador (403 si no).
- Helpers de propiedad (`exigir_propio`, `OrdenAccesibleDep`, ...): 403 si un
  técnico toca algo que no es suyo. Los parámetros `usuario_id`/`tecnico_id`/...
  que llegan por la API nunca se creen: se contrastan con el token.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.v1.deps import (
    AsignacionRepoDep,
    OrdenRepoDep,
    PapeletaRepoDep,
    UsuarioRepoDep,
)
from app.domain.enums import RolUsuario
from app.infrastructure.config import settings
from app.infrastructure.db.models import AsignacionEmergencia, OrdenTrabajo, Papeleta, Usuario
from app.infrastructure.intentos_login import RegistroIntentosFallidos
from app.infrastructure.tokens import TokenInvalidoError, decodificar_token

_esquema_bearer = HTTPBearer(auto_error=False)

_registro_intentos = RegistroIntentosFallidos()


def get_registro_intentos() -> RegistroIntentosFallidos:
    """Contador de intentos de login fallidos (singleton del proceso; inyectable en tests)."""
    return _registro_intentos


RegistroIntentosDep = Annotated[RegistroIntentosFallidos, Depends(get_registro_intentos)]


def no_autenticado(detalle: str = "No autenticado.") -> HTTPException:
    return HTTPException(
        status_code=401, detail=detalle, headers={"WWW-Authenticate": "Bearer"}
    )


def prohibido(detalle: str = "No tiene permiso para esta operación.") -> HTTPException:
    return HTTPException(status_code=403, detail=detalle)


async def usuario_actual(
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_esquema_bearer)],
    repo: UsuarioRepoDep,
) -> Usuario:
    if credenciales is None or not credenciales.credentials:
        raise no_autenticado()
    try:
        claims = decodificar_token(credenciales.credentials, settings.jwt_secret)
    except TokenInvalidoError as exc:
        raise no_autenticado("Sesión inválida o expirada.") from exc
    usuario = await repo.obtener(claims.usuario_id)
    # Un token cuyo rol ya no coincide con el de la BD (cambio de rol) también se rechaza.
    if usuario is None or not usuario.activo or str(usuario.rol) != claims.rol:
        raise no_autenticado("Sesión inválida o expirada.")
    return usuario


async def requerir_operador(usuario: Annotated[Usuario, Depends(usuario_actual)]) -> Usuario:
    if usuario.rol != RolUsuario.OPERADOR:
        raise prohibido("Esta operación es solo para operadores.")
    return usuario


UsuarioActualDep = Annotated[Usuario, Depends(usuario_actual)]
OperadorDep = Annotated[Usuario, Depends(requerir_operador)]


def es_operador(usuario: Usuario) -> bool:
    return usuario.rol == RolUsuario.OPERADOR


def exigir_propio(usuario: Usuario, id_: UUID | None, que: str = "este usuario") -> None:
    """403 si `id_` no es el del usuario autenticado (aplica a ambos roles)."""
    if id_ != usuario.id:
        raise prohibido(f"Solo puede operar con su propio usuario, no con {que}.")


def exigir_orden_propia(usuario: Usuario, orden: OrdenTrabajo) -> None:
    """Operador: cualquier orden. Técnico: solo si la orden está asignada a él."""
    if not es_operador(usuario) and orden.tecnico_id != usuario.id:
        raise prohibido("Esta orden de trabajo no está asignada a usted.")


def exigir_asignacion_propia(usuario: Usuario, asignacion: AsignacionEmergencia) -> None:
    if asignacion.tecnico_id != usuario.id:
        raise prohibido("Esta asignación no es suya.")


async def _orden_o_404(repo: OrdenRepoDep, id_: UUID) -> OrdenTrabajo:
    orden = await repo.obtener(id_)
    if orden is None:
        raise HTTPException(status_code=404, detail=f"Orden de trabajo {id_} no encontrada.")
    return orden


async def orden_accesible(id_: UUID, usuario: UsuarioActualDep, repo: OrdenRepoDep) -> OrdenTrabajo:
    """Dependencia de rutas `/ordenes-trabajo/{id_}`: 404 si no existe, 403 si es de otro técnico."""
    orden = await _orden_o_404(repo, id_)
    exigir_orden_propia(usuario, orden)
    return orden


async def papeleta_accesible(
    id_: UUID, usuario: UsuarioActualDep, repo: PapeletaRepoDep, orden_repo: OrdenRepoDep
) -> Papeleta:
    """Dependencia de rutas `/papeletas/{id_}/**`: se autoriza por la OT de la papeleta."""
    papeleta = await repo.obtener(id_)
    if papeleta is None:
        raise HTTPException(status_code=404, detail=f"Papeleta {id_} no encontrada.")
    if not es_operador(usuario):
        orden = await _orden_o_404(orden_repo, papeleta.orden_trabajo_id)
        exigir_orden_propia(usuario, orden)
    return papeleta


async def asignacion_propia(
    id_: UUID, usuario: UsuarioActualDep, repo: AsignacionRepoDep
) -> AsignacionEmergencia:
    """Dependencia de aceptar/rechazar: solo el técnico dueño (el operador recibe 403)."""
    if es_operador(usuario):
        raise prohibido("Solo el técnico asignado puede responder la asignación.")
    asignacion = await repo.obtener(id_)
    if asignacion is None:
        raise HTTPException(status_code=404, detail=f"Asignación {id_} no encontrada.")
    exigir_asignacion_propia(usuario, asignacion)
    return asignacion


OrdenAccesibleDep = Annotated[OrdenTrabajo, Depends(orden_accesible)]
PapeletaAccesibleDep = Annotated[Papeleta, Depends(papeleta_accesible)]
AsignacionPropiaDep = Annotated[AsignacionEmergencia, Depends(asignacion_propia)]
