from typing import ClassVar, Generic, TypeVar

from pydantic import BaseModel, model_validator

T = TypeVar("T")


class Coordenadas(BaseModel):
    lat: float
    lon: float


class Pagina(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class ErrorResponse(BaseModel):
    detalle: str


class ActualizacionParcial(BaseModel):
    """Base de los DTOs de PATCH: solo se aplican los campos enviados
    (`model_dump(exclude_unset=True)`). Los campos listados en
    `NO_ANULABLES` pueden omitirse, pero no enviarse explícitamente como null
    (la columna es NOT NULL) -> 422."""

    NO_ANULABLES: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="after")
    def _rechazar_null_en_no_anulables(self):
        for campo in self.NO_ANULABLES:
            if campo in self.model_fields_set and getattr(self, campo) is None:
                raise ValueError(f"El campo '{campo}' no puede ser null.")
        return self

    def cambios(self) -> dict:
        return self.model_dump(exclude_unset=True)
