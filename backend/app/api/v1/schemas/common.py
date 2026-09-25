from typing import Generic, TypeVar

from pydantic import BaseModel

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
