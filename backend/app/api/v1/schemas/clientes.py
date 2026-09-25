from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import TipoCliente


class ClienteBase(BaseModel):
    nombre: str
    tipo: TipoCliente


class ClienteCrear(ClienteBase):
    pass


class ClienteOut(ClienteBase):
    id: UUID

    model_config = {"from_attributes": True}
