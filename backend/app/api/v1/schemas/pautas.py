from uuid import UUID

from pydantic import BaseModel


class PautaItemBase(BaseModel):
    orden: int = 0
    descripcion: str


class PautaItemCrear(PautaItemBase):
    pass


class PautaItemOut(PautaItemBase):
    id: UUID

    model_config = {"from_attributes": True}


class PautaBase(BaseModel):
    nombre: str
    descripcion: str | None = None


class PautaCrear(PautaBase):
    items: list[PautaItemCrear] = []


class PautaOut(PautaBase):
    id: UUID
    items: list[PautaItemOut] = []

    model_config = {"from_attributes": True}
