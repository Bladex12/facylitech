from datetime import datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.domain.enums import EstadoOrdenTrabajo, TipoOrdenTrabajo
from app.domain.replicacion import (
    MotivoOmision,
    OrdenOrigen,
    fecha_equivalente,
    mes_siguiente,
    planificar_replicacion,
)

TZ = ZoneInfo("America/Santiago")


def _orden(
    fecha, ascensor=None, tipo=TipoOrdenTrabajo.MANTENCION, estado=EstadoOrdenTrabajo.COMPLETADO
):
    return OrdenOrigen(
        id=uuid4(),
        codigo=f"WO-{fecha:%d%H%M}",
        ascensor_id=ascensor or uuid4(),
        tipo=tipo,
        estado=estado,
        fecha_local=fecha,
    )


def test_cronograma_de_la_empresa_octubre_a_noviembre():
    # mié 07, jue 08, vie 09 de octubre -> mié 04, jue 05, vie 06 de noviembre
    # (el ciclo siguiente que describe docs/datos-simulacion.md).
    for dia_oct, dia_nov in [(7, 4), (8, 5), (9, 6)]:
        fecha = fecha_equivalente(datetime(2026, 10, dia_oct, 8, 30, tzinfo=TZ))
        assert fecha == datetime(2026, 11, dia_nov, 8, 30, tzinfo=TZ)


def test_conserva_hora_local_aunque_cambie_el_horario_de_verano():
    # Chile pasa a horario de verano el 6-sep-2026: 08:30 local sigue siendo 08:30.
    fecha = fecha_equivalente(datetime(2026, 8, 19, 8, 30, tzinfo=TZ))
    assert fecha == datetime(2026, 9, 16, 8, 30, tzinfo=TZ)
    assert fecha.utcoffset() != datetime(2026, 8, 19, 8, 30, tzinfo=TZ).utcoffset()


def test_primeros_dias_del_mes_saltan_cinco_semanas():
    # jue 01-oct + 4 semanas = 29-oct (mismo mes) -> se usan 5: jue 05-nov.
    assert fecha_equivalente(datetime(2026, 10, 1, 9, 0, tzinfo=TZ)).date() == (
        datetime(2026, 11, 5).date()
    )


def test_todo_el_mes_cae_en_el_mes_siguiente_mismo_dia_de_semana_y_no_domingo():
    for anio, mes in [(2026, 1), (2026, 2), (2026, 10), (2026, 12)]:
        for dia in range(1, 32):
            try:
                origen = datetime(anio, mes, dia, 9, 0, tzinfo=TZ)
            except ValueError:
                continue
            fecha = fecha_equivalente(origen)
            assert (fecha.year, fecha.month) == mes_siguiente(anio, mes)
            assert fecha.weekday() == origen.weekday()
            assert 28 <= (fecha.date() - origen.date()).days <= 35


def test_mes_siguiente_cruza_el_anio():
    assert mes_siguiente(2026, 12) == (2027, 1)
    assert mes_siguiente(2026, 11) == (2026, 12)


def test_plan_solo_mantenciones_no_canceladas():
    base = datetime(2026, 11, 4, 8, 30, tzinfo=TZ)
    ordenes = [
        _orden(base),
        _orden(base, estado=EstadoOrdenTrabajo.PROGRAMADO),  # vencida o pendiente: se replica
        _orden(base, estado=EstadoOrdenTrabajo.CANCELADO),
        _orden(base, tipo=TipoOrdenTrabajo.EMERGENCIA),
        _orden(base, tipo=TipoOrdenTrabajo.REPARACION),
    ]
    plan = planificar_replicacion(ordenes, set())
    assert len(plan.crear) == 2
    assert all(p.fecha_local == datetime(2026, 12, 2, 8, 30, tzinfo=TZ) for p in plan.crear)
    assert plan.omitidas == []


def test_plan_no_duplica_equipos_ya_programados_ni_repetidos():
    ya = uuid4()
    repetido = uuid4()
    base = datetime(2026, 11, 5, 14, 0, tzinfo=TZ)
    ordenes = [_orden(base, ya), _orden(base, repetido), _orden(base.replace(day=6), repetido)]
    plan = planificar_replicacion(ordenes, {ya})
    assert [p.origen.ascensor_id for p in plan.crear] == [repetido]
    assert {(o.origen.ascensor_id, o.motivo) for o in plan.omitidas} == {
        (ya, MotivoOmision.YA_PROGRAMADA),
        (repetido, MotivoOmision.DUPLICADA_EN_ORIGEN),
    }
