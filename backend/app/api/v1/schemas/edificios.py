from datetime import date
from uuid import UUID

from pydantic import BaseModel

from app.api.v1.schemas.common import Coordenadas
from app.domain.enums import TipoEdificio


class EdificioBase(BaseModel):
    administracion_id: UUID
    nombre: str
    direccion: str
    comuna: str
    tipo: TipoEdificio
    ubicacion: Coordenadas
    manas: str | None = None
    instrucciones_reinicio: str | None = None
    vencimiento_certificacion: date | None = None


class EdificioCrear(EdificioBase):
    pass


class EdificioOut(EdificioBase):
    id: UUID

    model_config = {"from_attributes": True}
