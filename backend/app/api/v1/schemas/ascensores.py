from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import EstadoOperativoAscensor


class EdificioResumen(BaseModel):
    id: UUID
    nombre: str
    direccion: str
    comuna: str

    model_config = {"from_attributes": True}


class AscensorBase(BaseModel):
    edificio_id: UUID
    codigo: str
    torre: str | None = None
    numero: str | None = None
    marca_modelo: str | None = None
    estado_operativo: EstadoOperativoAscensor = EstadoOperativoAscensor.OPERATIVO
    estado_repuestos: str | None = None


class AscensorCrear(AscensorBase):
    pass


class AscensorOut(AscensorBase):
    id: UUID
    edificio: EdificioResumen | None = None

    model_config = {"from_attributes": True}
