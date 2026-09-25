from datetime import UTC, datetime

from app.domain.enums import PrioridadOrdenTrabajo, Semaforo
from app.domain.ordenamiento import clave_orden_listado


def test_vencido_va_antes_que_en_curso_y_programado():
    fecha = datetime(2026, 1, 1, tzinfo=UTC)
    vencido = clave_orden_listado(Semaforo.VENCIDO, PrioridadOrdenTrabajo.BAJA, fecha)
    en_curso = clave_orden_listado(Semaforo.EN_CURSO, PrioridadOrdenTrabajo.CRITICA, fecha)
    programado = clave_orden_listado(Semaforo.PROGRAMADO, PrioridadOrdenTrabajo.CRITICA, fecha)
    completado = clave_orden_listado(Semaforo.COMPLETADO, PrioridadOrdenTrabajo.CRITICA, fecha)
    assert vencido < en_curso < programado < completado


def test_dentro_del_mismo_semaforo_prioridad_critica_va_primero():
    fecha = datetime(2026, 1, 1, tzinfo=UTC)
    critica = clave_orden_listado(Semaforo.PROGRAMADO, PrioridadOrdenTrabajo.CRITICA, fecha)
    baja = clave_orden_listado(Semaforo.PROGRAMADO, PrioridadOrdenTrabajo.BAJA, fecha)
    assert critica < baja


def test_misma_prioridad_fecha_mas_proxima_va_primero():
    temprano = datetime(2026, 1, 1, tzinfo=UTC)
    tarde = datetime(2026, 1, 5, tzinfo=UTC)
    clave_temprano = clave_orden_listado(Semaforo.PROGRAMADO, PrioridadOrdenTrabajo.MEDIA, temprano)
    clave_tarde = clave_orden_listado(Semaforo.PROGRAMADO, PrioridadOrdenTrabajo.MEDIA, tarde)
    assert clave_temprano < clave_tarde
