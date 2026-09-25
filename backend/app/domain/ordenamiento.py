from datetime import datetime

from app.domain.enums import PrioridadOrdenTrabajo, Semaforo

_ORDEN_SEMAFORO = {
    Semaforo.VENCIDO: 0,
    Semaforo.EN_CURSO: 1,
    Semaforo.PROGRAMADO: 2,
    Semaforo.COMPLETADO: 3,
}

_ORDEN_PRIORIDAD = {
    PrioridadOrdenTrabajo.CRITICA: 0,
    PrioridadOrdenTrabajo.ALTA: 1,
    PrioridadOrdenTrabajo.MEDIA: 2,
    PrioridadOrdenTrabajo.BAJA: 3,
}


def clave_orden_listado(
    semaforo: Semaforo, prioridad: PrioridadOrdenTrabajo, fecha_programada: datetime
) -> tuple[int, int, datetime]:
    """Regla del cliente: vencidos > en_curso > programados > completados;
    dentro de cada grupo, por prioridad (crítica primero) y fecha (más próxima primero)."""
    return (_ORDEN_SEMAFORO[semaforo], _ORDEN_PRIORIDAD[prioridad], fecha_programada)
