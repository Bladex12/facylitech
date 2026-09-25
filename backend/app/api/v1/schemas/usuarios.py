from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import RolUsuario


class UsuarioBase(BaseModel):
    nombre: str
    email: str
    rol: RolUsuario
    activo: bool = True


class UsuarioCrear(UsuarioBase):
    pass


class UsuarioOut(UsuarioBase):
    id: UUID

    model_config = {"from_attributes": True}
