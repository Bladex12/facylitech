"""Emisión y verificación de tokens de sesión (JWT HS256 con PyJWT)."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt

ALGORITMO = "HS256"


class TokenInvalidoError(Exception):
    """Token ausente de claims, expirado, con firma o algoritmo inválidos."""


@dataclass(frozen=True)
class ClaimsToken:
    usuario_id: UUID
    rol: str
    emitido_at: datetime
    expira_at: datetime


def emitir_token(
    usuario_id: UUID,
    rol: str,
    secreto: str,
    ttl: timedelta,
    ahora: datetime | None = None,
) -> tuple[str, datetime]:
    """Devuelve `(token, expira_at)`. Claims: sub, rol, iat, exp."""
    ahora = ahora or datetime.now(UTC)
    expira_at = ahora + ttl
    token = jwt.encode(
        {
            "sub": str(usuario_id),
            "rol": str(rol),
            "iat": int(ahora.timestamp()),
            "exp": int(expira_at.timestamp()),
        },
        secreto,
        algorithm=ALGORITMO,
    )
    return token, expira_at


def decodificar_token(token: str, secreto: str) -> ClaimsToken:
    """Valida firma, algoritmo (solo HS256), expiración y presencia de sub/rol/exp/iat."""
    try:
        claims = jwt.decode(
            token,
            secreto,
            algorithms=[ALGORITMO],
            options={"require": ["exp", "iat", "sub", "rol"]},
        )
        return ClaimsToken(
            usuario_id=UUID(str(claims["sub"])),
            rol=str(claims["rol"]),
            emitido_at=datetime.fromtimestamp(claims["iat"], UTC),
            expira_at=datetime.fromtimestamp(claims["exp"], UTC),
        )
    except (jwt.PyJWTError, ValueError, TypeError, OverflowError) as exc:
        raise TokenInvalidoError(str(exc)) from exc
