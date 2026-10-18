"""Máquina de estados del despacho en cascada de emergencias (funciones puras).

El operador aprueba una lista ordenada de técnicos (alcance: nunca hay
asignación 100% automática). El primero queda `pendiente` (notificado); el
resto `en_espera`. Si el pendiente rechaza o no responde dentro del tiempo
de respuesta (`expirada`), se notifica al siguiente. Cuando uno acepta, el
resto pasa a `cancelada`. Si todos rechazan/expiran, la cascada queda
agotada y el operador debe re-despachar.

    en_espera ──► pendiente ──► aceptada
                       │──────► rechazada
                       └──────► expirada
    (en_espera | pendiente) ──► cancelada   (otro aceptó, re-despacho o cierre)

No hay jobs en segundo plano: `avanzar_cascada` se evalúa de forma perezosa
en cada lectura/escritura relevante. Para que el resultado no dependa de
cuándo se lee, las expiraciones encadenadas usan el instante *teórico* de
vencimiento: si nadie consulta durante 12 minutos con 5 min de respuesta, el
1º expira a los 5, el 2º se notifica a los 5 y expira a los 10, y el 3º
queda pendiente desde los 10.

Las funciones reciben `Paso` (instantánea inmutable) y devuelven `Cambio`s
con el estado final de cada asignación modificada; aplicarlos a los
modelos ORM es tarea de la capa de aplicación.
"""

from collections.abc import Hashable, Iterable, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from app.domain.enums import EstadoAsignacion, EstadoEmergencia

ABIERTOS = frozenset({EstadoAsignacion.EN_ESPERA, EstadoAsignacion.PENDIENTE})
CERRADOS_SIN_EXITO = frozenset(
    {EstadoAsignacion.RECHAZADA, EstadoAsignacion.EXPIRADA, EstadoAsignacion.CANCELADA}
)


class CascadaError(Exception):
    """Operación de cascada no permitida (-> HTTP 409 en la capa API)."""


@dataclass(frozen=True)
class Paso:
    id: Hashable
    orden: int
    estado: EstadoAsignacion
    notificada_at: datetime | None = None
    respondida_at: datetime | None = None
    motivo_rechazo: str | None = None


@dataclass(frozen=True)
class Cambio:
    """Estado final de una asignación modificada (se aplican los 4 campos)."""

    id: Hashable
    estado: EstadoAsignacion
    notificada_at: datetime | None
    respondida_at: datetime | None
    motivo_rechazo: str | None


def expira_at(
    estado: EstadoAsignacion, notificada_at: datetime | None, tiempo_respuesta: timedelta
) -> datetime | None:
    """Momento en que expira una asignación pendiente; None si no está pendiente."""
    if estado != EstadoAsignacion.PENDIENTE or notificada_at is None:
        return None
    return notificada_at + tiempo_respuesta


class _Simulacion:
    """Copia mutable de la cascada que registra qué asignaciones cambiaron."""

    def __init__(self, pasos: Iterable[Paso]):
        self.pasos: dict[Hashable, Paso] = {p.id: p for p in pasos}
        self.cambiados: list[Hashable] = []

    def ordenados(self) -> list[Paso]:
        return sorted(self.pasos.values(), key=lambda p: p.orden)

    def obtener(self, id_: Hashable) -> Paso:
        try:
            return self.pasos[id_]
        except KeyError as exc:
            raise CascadaError(f"La asignación {id_} no pertenece a esta cascada.") from exc

    def actualizar(self, id_: Hashable, **campos) -> None:
        self.pasos[id_] = replace(self.pasos[id_], **campos)
        if id_ not in self.cambiados:
            self.cambiados.append(id_)

    def cambios(self) -> list[Cambio]:
        return [
            Cambio(
                id=p.id,
                estado=p.estado,
                notificada_at=p.notificada_at,
                respondida_at=p.respondida_at,
                motivo_rechazo=p.motivo_rechazo,
            )
            for p in (self.pasos[i] for i in self.cambiados)
        ]

    def avanzar(self, ahora: datetime, tiempo_respuesta: timedelta) -> None:
        if any(p.estado == EstadoAsignacion.ACEPTADA for p in self.pasos.values()):
            return
        while True:
            pendientes = [p for p in self.ordenados() if p.estado == EstadoAsignacion.PENDIENTE]
            if pendientes:
                actual = pendientes[0]
                vence = expira_at(actual.estado, actual.notificada_at, tiempo_respuesta)
                if vence is None or ahora < vence:
                    return
                self.actualizar(actual.id, estado=EstadoAsignacion.EXPIRADA, respondida_at=vence)
                notificar_desde = vence
            else:
                notificar_desde = ahora
            siguiente = next(
                (p for p in self.ordenados() if p.estado == EstadoAsignacion.EN_ESPERA), None
            )
            if siguiente is None:
                return
            self.actualizar(
                siguiente.id, estado=EstadoAsignacion.PENDIENTE, notificada_at=notificar_desde
            )


def avanzar_cascada(
    asignaciones: Iterable[Paso], ahora: datetime, tiempo_respuesta: timedelta
) -> list[Cambio]:
    """Expira la `pendiente` vencida (en cadena si hace falta) y pasa la
    siguiente `en_espera` a `pendiente`. No hace nada si alguien ya aceptó."""
    sim = _Simulacion(asignaciones)
    sim.avanzar(ahora, tiempo_respuesta)
    return sim.cambios()


def aceptar(
    asignaciones: Iterable[Paso], id_: Hashable, ahora: datetime, tiempo_respuesta: timedelta
) -> list[Cambio]:
    """Marca `id_` como aceptada y cancela el resto de las abiertas.

    Primero avanza la cascada: si la asignación ya expiró, lanza CascadaError.
    """
    sim = _Simulacion(asignaciones)
    sim.avanzar(ahora, tiempo_respuesta)
    paso = sim.obtener(id_)
    if paso.estado != EstadoAsignacion.PENDIENTE:
        raise CascadaError(
            f"No se puede aceptar una asignación en estado '{paso.estado}'; debe estar 'pendiente'."
        )
    sim.actualizar(id_, estado=EstadoAsignacion.ACEPTADA, respondida_at=ahora)
    for otro in sim.ordenados():
        if otro.id != id_ and otro.estado in ABIERTOS:
            sim.actualizar(otro.id, estado=EstadoAsignacion.CANCELADA, respondida_at=ahora)
    return sim.cambios()


def rechazar(
    asignaciones: Iterable[Paso],
    id_: Hashable,
    ahora: datetime,
    tiempo_respuesta: timedelta,
    motivo: str | None = None,
) -> list[Cambio]:
    """Marca `id_` como rechazada y notifica al siguiente de la cascada."""
    sim = _Simulacion(asignaciones)
    sim.avanzar(ahora, tiempo_respuesta)
    paso = sim.obtener(id_)
    if paso.estado != EstadoAsignacion.PENDIENTE:
        raise CascadaError(
            f"No se puede rechazar una asignación en estado '{paso.estado}'; debe estar 'pendiente'."
        )
    sim.actualizar(
        id_, estado=EstadoAsignacion.RECHAZADA, respondida_at=ahora, motivo_rechazo=motivo
    )
    sim.avanzar(ahora, tiempo_respuesta)
    return sim.cambios()


def cancelar_abiertas(asignaciones: Iterable[Paso], ahora: datetime) -> list[Cambio]:
    """Cancela las asignaciones `en_espera`/`pendiente` (re-despacho o cierre)."""
    sim = _Simulacion(asignaciones)
    for paso in sim.ordenados():
        if paso.estado in ABIERTOS:
            sim.actualizar(paso.id, estado=EstadoAsignacion.CANCELADA, respondida_at=ahora)
    return sim.cambios()


def cascada_agotada(estados: Iterable[EstadoAsignacion]) -> bool:
    """True si hubo despacho y nadie quedó abierto ni aceptó: el operador
    debe re-despachar."""
    estados = list(estados)
    return bool(estados) and all(e in CERRADOS_SIN_EXITO for e in estados)


def validar_despacho(
    estado_emergencia: EstadoEmergencia, estados: Iterable[EstadoAsignacion], tecnico_ids: Sequence
) -> None:
    if estado_emergencia == EstadoEmergencia.CERRADA:
        raise CascadaError("No se puede despachar una emergencia cerrada.")
    if any(e == EstadoAsignacion.ACEPTADA for e in estados):
        raise CascadaError("La emergencia ya tiene un técnico que aceptó.")
    if not tecnico_ids:
        raise ValueError("Debe indicar al menos un técnico.")
    if len(set(tecnico_ids)) != len(tecnico_ids):
        raise ValueError("La lista de técnicos tiene repetidos.")


def nueva_cascada(
    cantidad: int, ahora: datetime, orden_inicial: int = 1
) -> list[tuple[int, EstadoAsignacion, datetime | None]]:
    """`(orden, estado, notificada_at)` de una cascada nueva: el primero
    `pendiente` (notificado ahora), el resto `en_espera`."""
    return [
        (
            orden_inicial + i,
            EstadoAsignacion.PENDIENTE if i == 0 else EstadoAsignacion.EN_ESPERA,
            ahora if i == 0 else None,
        )
        for i in range(cantidad)
    ]
