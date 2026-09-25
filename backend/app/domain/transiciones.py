from app.domain.enums import EstadoOrdenTrabajo


class TransicionInvalidaError(Exception):
    """Transición de estado de orden de trabajo no permitida (-> HTTP 409 en la capa API)."""


def validar_iniciar(estado_actual: EstadoOrdenTrabajo) -> None:
    if estado_actual != EstadoOrdenTrabajo.PROGRAMADO:
        raise TransicionInvalidaError(
            f"No se puede iniciar una orden en estado '{estado_actual}'; debe estar 'programado'."
        )


def validar_completar(estado_actual: EstadoOrdenTrabajo, papeleta_enviada: bool) -> None:
    if estado_actual != EstadoOrdenTrabajo.EN_CURSO:
        raise TransicionInvalidaError(
            f"No se puede completar una orden en estado '{estado_actual}'; debe estar 'en_curso'."
        )
    if not papeleta_enviada:
        raise TransicionInvalidaError("No se puede completar la orden sin una papeleta enviada.")
