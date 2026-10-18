class NoEncontradoError(Exception):
    """Entidad no encontrada (-> HTTP 404 en la capa API)."""


class ConflictoError(Exception):
    """Operación incompatible con el estado actual (-> HTTP 409 en la capa API)."""


class ValidacionError(Exception):
    """Datos de entrada inválidos que no valida Pydantic (-> HTTP 422 en la capa API)."""


class AlmacenamientoError(Exception):
    """Falla del servicio externo de almacenamiento de archivos (-> HTTP 502)."""
