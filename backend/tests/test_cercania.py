from dataclasses import dataclass

import pytest

from app.domain.cercania import (
    especialidad_calza,
    eta_min,
    haversine_m,
    ordenar_candidatos,
)

PLAZA_DE_ARMAS = (-33.4378, -70.6505)
COSTANERA_CENTER = (-33.4173, -70.6067)


def test_haversine_mismo_punto_es_cero():
    assert haversine_m(PLAZA_DE_ARMAS, PLAZA_DE_ARMAS) == 0


def test_haversine_es_simetrica():
    assert haversine_m(PLAZA_DE_ARMAS, COSTANERA_CENTER) == pytest.approx(
        haversine_m(COSTANERA_CENTER, PLAZA_DE_ARMAS)
    )


def test_haversine_distancia_conocida_en_santiago():
    # Plaza de Armas -> Costanera Center: ~4,6 km en línea recta.
    assert haversine_m(PLAZA_DE_ARMAS, COSTANERA_CENTER) == pytest.approx(4_590, rel=0.02)


def test_haversine_un_grado_de_latitud():
    assert haversine_m((0.0, 0.0), (1.0, 0.0)) == pytest.approx(111_195, rel=0.001)


def test_haversine_antipodas_no_falla():
    assert haversine_m((0.0, 0.0), (0.0, 180.0)) == pytest.approx(20_015_115, rel=0.001)


@pytest.mark.parametrize(
    ("distancia", "esperado"),
    [(None, None), (0, 0), (25_000, 60), (4_166.7, 10), (200, 0), (300, 1)],
)
def test_eta_a_25_kmh(distancia, esperado):
    assert eta_min(distancia) == esperado


@dataclass
class C:
    nombre: str
    disponible: bool
    especialidad_match: bool
    distancia_m: float | None


def test_ordenar_primero_disponibles_luego_especialidad_luego_distancia():
    candidatos = [
        C("ocupado-cerca-match", False, True, 100),
        C("disp-lejos-sin-match", True, False, 9_000),
        C("disp-lejos-match", True, True, 8_000),
        C("disp-cerca-match", True, True, 500),
        C("disp-cerca-sin-match", True, False, 50),
        C("ocupado-lejos-sin-match", False, False, 20_000),
    ]
    assert [c.nombre for c in ordenar_candidatos(candidatos)] == [
        "disp-cerca-match",
        "disp-lejos-match",
        "disp-cerca-sin-match",
        "disp-lejos-sin-match",
        "ocupado-cerca-match",
        "ocupado-lejos-sin-match",
    ]


def test_ordenar_sin_ubicacion_al_final_de_su_grupo():
    candidatos = [
        C("sin-ubicacion", True, True, None),
        C("lejos", True, True, 30_000),
        C("cerca", True, True, 10),
        C("ocupado", False, True, 1),
    ]
    assert [c.nombre for c in ordenar_candidatos(candidatos)] == [
        "cerca",
        "lejos",
        "sin-ubicacion",
        "ocupado",
    ]


def test_ordenar_lista_vacia():
    assert ordenar_candidatos([]) == []


@pytest.mark.parametrize(
    ("especialidades", "tipo", "esperado"),
    [
        (["mecanica", "incendio"], "incendio", True),
        (["mecanica"], "incendio", False),
        (None, "incendio", False),
        ([], "incendio", False),
        (["mecanica"], None, False),
    ],
)
def test_especialidad_calza(especialidades, tipo, esperado):
    assert especialidad_calza(especialidades, tipo) is esperado
