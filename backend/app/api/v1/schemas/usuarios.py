from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import Especialidad, EstadoDisponibilidadTecnico, RolUsuario


class UsuarioBase(BaseModel):
    nombre: str
    email: str
    rol: RolUsuario
    telefono: str | None = None
    activo: bool = True
    zona: str | None = None
    especialidades: list[Especialidad] | None = None
    estado_disponibilidad: EstadoDisponibilidadTecnico | None = None


class UsuarioCrear(UsuarioBase):
    pass


class UsuarioOut(UsuarioBase):
    id: UUID

    model_config = {"from_attributes": True}
