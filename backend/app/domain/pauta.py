"""Regla de dominio: qué ítems de una pauta corresponden al mes en curso.

RNF-04: el checklist se maneja con datos (matriz `meses`), no con código —
agregar o quitar ítems de una pauta no requiere cambios estructurales.
"""

from typing import Protocol


class _ItemConMeses(Protocol):
    activo: bool
    meses: list[int]


def items_del_mes[T: _ItemConMeses](items: list[T], mes: int) -> list[T]:
    """Filtra los ítems activos cuyo array `meses` (1-12) incluye `mes`."""
    return [item for item in items if item.activo and mes in item.meses]
