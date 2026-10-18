class NoEncontradoError(Exception):
    """Entidad no encontrada (-> HTTP 404 en la capa API)."""


class DatosInvalidosError(Exception):
    """Datos de entrada que violan una regla de negocio (-> HTTP 422 en la capa API)."""
