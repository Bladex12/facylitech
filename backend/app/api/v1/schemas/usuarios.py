from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.api.v1.schemas.common import Coordenadas
from app.domain.enums import Especialidad, EstadoDisponibilidadTecnico, RolUsuario
from app.infrastructure.geo import coords_desde_punto


class UsuarioBase(BaseModel):
    nombre: str
    email: str
    rol: RolUsuario
    rut: str | None = None
    telefono: str | None = None
    activo: bool = True
    zona: str | None = None
    especialidades: list[Especialidad] | None = None
    estado_disponibilidad: EstadoDisponibilidadTecnico | None = None


class UsuarioCrear(UsuarioBase):
    # Opcional: un usuario sin contraseña existe pero no puede iniciar sesión.
    password: str | None = Field(default=None, min_length=8, max_length=200)


class UsuarioOut(UsuarioBase):
    id: UUID
    ultima_ubicacion: Coordenadas | None = None
    ultima_ubicacion_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("ultima_ubicacion", mode="before")
    @classmethod
    def _geography_a_coordenadas(cls, valor):
        # El ORM entrega un WKBElement (o WKTElement recién asignado), no {lat, lon}.
        if valor is None or isinstance(valor, dict | Coordenadas):
            return valor
        coords = coords_desde_punto(valor)
        return None if coords is None else Coordenadas(lat=coords[0], lon=coords[1])


class UbicacionActualizar(BaseModel):
    """Body de POST /usuarios/{id}/ubicacion: {lat, lon}."""

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
