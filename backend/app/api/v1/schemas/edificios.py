from datetime import date
from uuid import UUID

from pydantic import BaseModel

from app.api.v1.schemas.common import ActualizacionParcial, Coordenadas
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
    contacto_nombre: str | None = None
    contacto_telefono: str | None = None
    contacto_email: str | None = None


class EdificioCrear(EdificioBase):
    pass


class EdificioActualizar(ActualizacionParcial):
    """PATCH /edificios/{id}: datos de terreno (mañas, reinicio, certificación) y contactos."""

    NO_ANULABLES = ("nombre", "direccion")

    nombre: str | None = None
    direccion: str | None = None
    manas: str | None = None
    instrucciones_reinicio: str | None = None
    vencimiento_certificacion: date | None = None
    contacto_nombre: str | None = None
    contacto_telefono: str | None = None
    contacto_email: str | None = None


class EdificioOut(EdificioBase):
    id: UUID

    model_config = {"from_attributes": True}
