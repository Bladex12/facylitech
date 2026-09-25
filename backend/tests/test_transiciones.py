import pytest

from app.domain.enums import EstadoOrdenTrabajo
from app.domain.transiciones import TransicionInvalidaError, validar_completar, validar_iniciar


def test_iniciar_desde_programado_ok():
    validar_iniciar(EstadoOrdenTrabajo.PROGRAMADO)  # no lanza


@pytest.mark.parametrize(
    "estado",
    [EstadoOrdenTrabajo.EN_CURSO, EstadoOrdenTrabajo.COMPLETADO, EstadoOrdenTrabajo.CANCELADO],
)
def test_iniciar_desde_otro_estado_falla(estado):
    with pytest.raises(TransicionInvalidaError):
        validar_iniciar(estado)


def test_completar_desde_en_curso_con_papeleta_enviada_ok():
    validar_completar(EstadoOrdenTrabajo.EN_CURSO, papeleta_enviada=True)  # no lanza


def test_completar_sin_papeleta_enviada_falla():
    with pytest.raises(TransicionInvalidaError):
        validar_completar(EstadoOrdenTrabajo.EN_CURSO, papeleta_enviada=False)


def test_completar_desde_estado_incorrecto_falla():
    with pytest.raises(TransicionInvalidaError):
        validar_completar(EstadoOrdenTrabajo.PROGRAMADO, papeleta_enviada=True)
