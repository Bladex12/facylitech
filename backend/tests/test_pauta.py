from dataclasses import dataclass

from app.domain.pauta import items_del_mes


@dataclass
class _Item:
    descripcion: str
    meses: list[int]
    activo: bool = True


def test_filtra_items_que_incluyen_el_mes():
    items = [
        _Item("Mensual", meses=list(range(1, 13))),
        _Item("Trimestral", meses=[1, 4, 7, 10]),
        _Item("Solo marzo", meses=[3]),
    ]
    resultado = items_del_mes(items, mes=4)
    assert {i.descripcion for i in resultado} == {"Mensual", "Trimestral"}


def test_ignora_items_inactivos():
    items = [
        _Item("Activo", meses=[5]),
        _Item("Inactivo", meses=[5], activo=False),
    ]
    resultado = items_del_mes(items, mes=5)
    assert [i.descripcion for i in resultado] == ["Activo"]


def test_mes_sin_items_correspondientes():
    items = [_Item("Solo enero", meses=[1])]
    assert items_del_mes(items, mes=6) == []
