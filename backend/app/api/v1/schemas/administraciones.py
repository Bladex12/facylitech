from uuid import UUID

from pydantic import BaseModel


class AdministracionBase(BaseModel):
    cliente_id: UUID
    nombre: str
    contacto_nombre: str | None = None
    contacto_email: str | None = None
    contacto_telefono: str | None = None
    contacto_alternativo: str | None = None


class AdministracionCrear(AdministracionBase):
    pass


class AdministracionOut(AdministracionBase):
    id: UUID

    model_config = {"from_attributes": True}
