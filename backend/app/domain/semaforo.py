from datetime import datetime

from app.domain.enums import EstadoOrdenTrabajo, Semaforo

_ESTADOS_CERRADOS = {EstadoOrdenTrabajo.COMPLETADO, EstadoOrdenTrabajo.CANCELADO}


def calcular_semaforo(
    estado: EstadoOrdenTrabajo, fecha_programada: datetime, ahora: datetime
) -> Semaforo:
    """'Vencido' no se guarda en BD: se calcula a partir de fecha_programada y estado.

    Una orden cancelada se muestra como 'completado' (cerrada, no requiere atención);
    no existe un color de semáforo dedicado para 'cancelado' (ver docs/decisiones.md).
    """
    if estado in _ESTADOS_CERRADOS:
        return Semaforo.COMPLETADO
    if estado == EstadoOrdenTrabajo.EN_CURSO:
        return Semaforo.EN_CURSO
    if fecha_programada < ahora:
        return Semaforo.VENCIDO
    return Semaforo.PROGRAMADO
