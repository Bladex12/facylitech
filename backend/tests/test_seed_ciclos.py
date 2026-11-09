"""El seed genera los ciclos mensuales hasta el próximo, sin importar cuándo se corra."""

from datetime import date

from seed import _ciclos


def test_desde_octubre_hasta_el_primer_ciclo_futuro():
    assert _ciclos(date(2026, 10, 18)) == [date(2026, 10, 7), date(2026, 11, 4)]
    assert _ciclos(date(2026, 11, 9)) == [date(2026, 10, 7), date(2026, 11, 4), date(2026, 12, 2)]


def test_siempre_hay_un_ciclo_proximo_y_todos_son_miercoles():
    for hoy in (date(2026, 10, 1), date(2026, 12, 2), date(2027, 3, 15)):
        ciclos = _ciclos(hoy)
        assert ciclos[0] == date(2026, 10, 7)
        assert ciclos[-1] > hoy or ciclos == [date(2026, 10, 7)]
        assert all(c.weekday() == 2 for c in ciclos)
