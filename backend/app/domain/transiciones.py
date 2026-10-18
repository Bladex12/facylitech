from app.domain.enums import EstadoOrdenTrabajo


class TransicionInvalidaError(Exception):
    """Transición de estado de orden de trabajo no permitida (-> HTTP 409 en la capa API)."""


def validar_iniciar(estado_actual: EstadoOrdenTrabajo) -> None:
    if estado_actual != EstadoOrdenTrabajo.PROGRAMADO:
        raise TransicionInvalidaError(
            f"No se puede iniciar una orden en estado '{estado_actual}'; debe estar 'programado'."
        )


_ESTADOS_CERRADOS = (EstadoOrdenTrabajo.COMPLETADO, EstadoOrdenTrabajo.CANCELADO)


def validar_cancelar(estado_actual: EstadoOrdenTrabajo) -> None:
    """Se puede cancelar una orden programada o en curso; no una ya cerrada."""
    if estado_actual in _ESTADOS_CERRADOS:
        raise TransicionInvalidaError(
            f"No se puede cancelar una orden en estado '{estado_actual}'."
        )


def validar_editable(estado_actual: EstadoOrdenTrabajo) -> None:
    """Reasignar / reprogramar / cambiar prioridad solo en órdenes abiertas."""
    if estado_actual in _ESTADOS_CERRADOS:
        raise TransicionInvalidaError(
            f"No se puede modificar una orden en estado '{estado_actual}'."
        )


def validar_completar(estado_actual: EstadoOrdenTrabajo, papeleta_enviada: bool) -> None:
    if estado_actual != EstadoOrdenTrabajo.EN_CURSO:
        raise TransicionInvalidaError(
            f"No se puede completar una orden en estado '{estado_actual}'; debe estar 'en_curso'."
        )
    if not papeleta_enviada:
        raise TransicionInvalidaError("No se puede completar la orden sin una papeleta enviada.")
