from datetime import UTC, datetime, timedelta

from app.domain.enums import EstadoOrdenTrabajo, Semaforo
from app.domain.semaforo import calcular_semaforo

_AHORA = datetime(2026, 9, 25, 12, 0, tzinfo=UTC)


def test_programado_futuro_no_esta_vencido():
    fecha = _AHORA + timedelta(days=1)
    assert calcular_semaforo(EstadoOrdenTrabajo.PROGRAMADO, fecha, _AHORA) == Semaforo.PROGRAMADO


def test_programado_pasado_esta_vencido():
    fecha = _AHORA - timedelta(days=1)
    assert calcular_semaforo(EstadoOrdenTrabajo.PROGRAMADO, fecha, _AHORA) == Semaforo.VENCIDO


def test_en_curso_nunca_esta_vencido_aunque_la_fecha_haya_pasado():
    fecha = _AHORA - timedelta(days=5)
    assert calcular_semaforo(EstadoOrdenTrabajo.EN_CURSO, fecha, _AHORA) == Semaforo.EN_CURSO


def test_completado_es_siempre_completado():
    fecha = _AHORA - timedelta(days=30)
    assert calcular_semaforo(EstadoOrdenTrabajo.COMPLETADO, fecha, _AHORA) == Semaforo.COMPLETADO


def test_cancelado_se_muestra_como_completado():
    fecha = _AHORA - timedelta(days=30)
    assert calcular_semaforo(EstadoOrdenTrabajo.CANCELADO, fecha, _AHORA) == Semaforo.COMPLETADO
