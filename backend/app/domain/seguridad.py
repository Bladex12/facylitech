"""Reglas de seguridad puras (sin FastAPI ni SQLAlchemy): hash de contraseñas con
scrypt de la biblioteca estándar y política anti fuerza bruta.

Formato del hash: ``scrypt$N$r$p$<sal_b64>$<hash_b64>`` (ver docs/contrato-auth.md).
"""

import base64
import binascii
import hashlib
import hmac
import math
import os
from collections.abc import Sequence
from datetime import datetime, timedelta

SCRYPT_N = 2**15
SCRYPT_R = 8
SCRYPT_P = 1
LARGO_SAL = 16
LARGO_HASH = 32
# scrypt necesita ~128*N*r bytes (32 MB con los parámetros por defecto); el límite
# por defecto de OpenSSL es justo 32 MB, así que se fija uno explícito.
_MAXMEM = 128 * 1024 * 1024
# Tope de N aceptado al verificar: un hash manipulado en BD no debe poder agotar memoria.
_N_MAXIMO = 2**17

PASSWORD_MIN_CARACTERES = 8

# Anti fuerza bruta: 5 intentos fallidos por clave en 15 minutos.
MAX_INTENTOS_FALLIDOS = 5
VENTANA_INTENTOS = timedelta(minutes=15)


def _b64(datos: bytes) -> str:
    return base64.b64encode(datos).decode("ascii")


def hash_password(password: str, *, n: int = SCRYPT_N, r: int = SCRYPT_R, p: int = SCRYPT_P) -> str:
    """Hash scrypt con sal aleatoria. `n`/`r`/`p` solo se cambian en tests (más rápido)."""
    sal = os.urandom(LARGO_SAL)
    derivado = hashlib.scrypt(
        password.encode("utf-8"), salt=sal, n=n, r=r, p=p, maxmem=_MAXMEM, dklen=LARGO_HASH
    )
    return f"scrypt${n}${r}${p}${_b64(sal)}${_b64(derivado)}"


def verificar_password(password: str, hash_guardado: str | None) -> bool:
    """Compara en tiempo constante. Un hash ausente o mal formado devuelve False (nunca lanza)."""
    if not hash_guardado:
        return False
    try:
        esquema, n_s, r_s, p_s, sal_s, hash_s = hash_guardado.split("$")
        if esquema != "scrypt":
            return False
        n, r, p = int(n_s), int(r_s), int(p_s)
        if n < 2 or n > _N_MAXIMO or n & (n - 1) or r < 1 or r > 32 or p < 1 or p > 16:
            return False
        sal = base64.b64decode(sal_s, validate=True)
        esperado = base64.b64decode(hash_s, validate=True)
        if not sal or not esperado:
            return False
        derivado = hashlib.scrypt(
            password.encode("utf-8"), salt=sal, n=n, r=r, p=p, maxmem=_MAXMEM, dklen=len(esperado)
        )
    except (ValueError, TypeError, binascii.Error, OverflowError, MemoryError):
        return False
    return hmac.compare_digest(derivado, esperado)


def validar_password_nueva(password: str) -> str | None:
    """None si es válida; si no, el mensaje de error para el usuario."""
    if len(password) < PASSWORD_MIN_CARACTERES:
        return f"La contraseña debe tener al menos {PASSWORD_MIN_CARACTERES} caracteres."
    return None


def segundos_de_bloqueo(
    intentos_fallidos: Sequence[datetime],
    ahora: datetime,
    maximo: int = MAX_INTENTOS_FALLIDOS,
    ventana: timedelta = VENTANA_INTENTOS,
) -> int:
    """Segundos que faltan para poder reintentar (0 si no está bloqueado).

    Se bloquea cuando hay `maximo` o más intentos fallidos dentro de la ventana
    móvil; se libera cuando el (maximo)-ésimo intento más reciente sale de ella.
    """
    recientes = sorted(t for t in intentos_fallidos if ahora - t < ventana)
    if len(recientes) < maximo:
        return 0
    libera_en = recientes[-maximo] + ventana
    return max(1, math.ceil((libera_en - ahora).total_seconds()))
