from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import TipoEquipo


class PautaItemBase(BaseModel):
    orden: int = 0
    descripcion: str
    meses: list[int]
    activo: bool = True


class PautaItemCrear(PautaItemBase):
    pass


class PautaItemOut(PautaItemBase):
    id: UUID

    model_config = {"from_attributes": True}


class PautaBase(BaseModel):
    nombre: str
    tipo_equipo: TipoEquipo
    descripcion: str | None = None


class PautaCrear(PautaBase):
    items: list[PautaItemCrear] = []


class PautaOut(PautaBase):
    id: UUID
    items: list[PautaItemOut] = []

    model_config = {"from_attributes": True}
