from uuid import UUID

from pydantic import BaseModel

from app.api.v1.schemas.common import Coordenadas
from app.domain.enums import TipoEdificio


class EdificioBase(BaseModel):
    nombre: str
    direccion: str
    comuna: str
    tipo: TipoEdificio
    ubicacion: Coordenadas
    contacto_nombre: str | None = None
    contacto_email: str | None = None
    contacto_telefono: str | None = None
    manas: str | None = None
    instrucciones_reinicio: str | None = None


class EdificioCrear(EdificioBase):
    pass


class EdificioOut(EdificioBase):
    id: UUID

    model_config = {"from_attributes": True}
