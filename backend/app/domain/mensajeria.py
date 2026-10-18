"""Reglas puras de la mensajería operador <-> técnico.

No dependen de FastAPI ni SQLAlchemy: reciben ids, fechas y roles.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.enums import RolUsuario


@dataclass(frozen=True)
class MensajeDatos:
    id: UUID
    remitente_id: UUID
    destinatario_id: UUID
    created_at: datetime
    leido_at: datetime | None


@dataclass(frozen=True)
class ResumenConversacion:
    contraparte_id: UUID
    ultimo_mensaje_id: UUID | None
    ultimo_mensaje_at: datetime | None
    no_leidos: int


def rol_contraparte_por_defecto(rol: RolUsuario) -> RolUsuario:
    """El operador ve siempre a todos los técnicos activos y viceversa,
    aunque todavía no hayan intercambiado mensajes."""
    return RolUsuario.TECNICO if rol == RolUsuario.OPERADOR else RolUsuario.OPERADOR


def resumir_conversaciones(
    usuario_id: UUID,
    mensajes: Iterable[MensajeDatos],
    contrapartes_por_defecto: Iterable[UUID] = (),
) -> list[ResumenConversacion]:
    """Una conversación por contraparte con la que hay mensajes, más las
    contrapartes por defecto sin mensajes. Orden: último mensaje más reciente
    primero; las conversaciones vacías van al final, en el orden recibido.
    `no_leidos` cuenta solo lo recibido por `usuario_id` sin `leido_at`."""
    ultimo: dict[UUID, MensajeDatos] = {}
    no_leidos: dict[UUID, int] = {}
    for m in mensajes:
        if m.remitente_id == usuario_id:
            contraparte = m.destinatario_id
        elif m.destinatario_id == usuario_id:
            contraparte = m.remitente_id
        else:
            continue
        previo = ultimo.get(contraparte)
        if previo is None or m.created_at > previo.created_at:
            ultimo[contraparte] = m
        no_leidos.setdefault(contraparte, 0)
        if m.destinatario_id == usuario_id and m.leido_at is None:
            no_leidos[contraparte] += 1

    con_mensajes = sorted(ultimo.items(), key=lambda kv: kv[1].created_at, reverse=True)
    resumen = [
        ResumenConversacion(c, m.id, m.created_at, no_leidos[c]) for c, m in con_mensajes
    ]
    vistos = set(ultimo)
    for c in contrapartes_por_defecto:
        if c != usuario_id and c not in vistos:
            vistos.add(c)
            resumen.append(ResumenConversacion(c, None, None, 0))
    return resumen
