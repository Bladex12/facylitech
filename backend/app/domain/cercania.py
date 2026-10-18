"""Reglas de cercanía de técnicos (funciones puras, sin FastAPI ni SQLAlchemy).

La distancia "oficial" se calcula en la BD con PostGIS (`ST_Distance` sobre
`geography`, ver `infrastructure/repositories/tecnicos.py`); `haversine_m`
queda como respaldo (p.ej. si se calcula fuera de la BD) y como referencia
en los tests (ambas deben coincidir ±1%).
"""

from collections.abc import Iterable
from math import asin, cos, radians, sin, sqrt
from typing import Protocol

# Radio medio de la Tierra (IUGG), en metros.
RADIO_TIERRA_M = 6_371_008.8

# Velocidad promedio supuesta para el ETA: tráfico urbano de Santiago.
VELOCIDAD_PROMEDIO_KMH = 25.0
_METROS_POR_MINUTO = VELOCIDAD_PROMEDIO_KMH * 1000 / 60


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distancia ortodrómica en metros entre dos puntos `(lat, lon)` en grados."""
    lat1, lon1 = map(radians, a)
    lat2, lon2 = map(radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * RADIO_TIERRA_M * asin(min(1.0, sqrt(h)))


def eta_min(distancia_m: float | None) -> int | None:
    """Estimado simple de llegada en minutos: distancia / 25 km/h, redondeado.

    None si no se conoce la distancia (técnico sin ubicación).
    """
    if distancia_m is None:
        return None
    return round(distancia_m / _METROS_POR_MINUTO)


class CandidatoOrdenable(Protocol):
    @property
    def disponible(self) -> bool: ...
    @property
    def especialidad_match(self) -> bool: ...
    @property
    def distancia_m(self) -> float | None: ...


def clave_candidato(disponible: bool, especialidad_match: bool, distancia_m: float | None):
    """Primero disponibles; luego los que tienen la especialidad de la
    emergencia; luego por distancia ascendente, con los técnicos sin
    ubicación conocida al final de su grupo."""
    return (
        not disponible,
        not especialidad_match,
        distancia_m is None,
        distancia_m if distancia_m is not None else 0.0,
    )


def ordenar_candidatos[C: CandidatoOrdenable](candidatos: Iterable[C]) -> list[C]:
    """Ordena candidatos según `clave_candidato` (orden estable)."""
    return sorted(
        candidatos,
        key=lambda c: clave_candidato(c.disponible, c.especialidad_match, c.distancia_m),
    )


def especialidad_calza(especialidades: Iterable[str] | None, tipo_emergencia: str | None) -> bool:
    if tipo_emergencia is None or not especialidades:
        return False
    return tipo_emergencia in set(especialidades)
