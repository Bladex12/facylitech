from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v1.schemas.common import Coordenadas
from app.domain.enums import (
    Especialidad,
    EstadoDisponibilidadTecnico,
    EstadoEmergencia,
    TipoEdificio,
)


class MapaEdificio(BaseModel):
    id: UUID
    nombre: str
    direccion: str
    comuna: str
    tipo: TipoEdificio
    ubicacion: Coordenadas
    total_equipos: int
    equipos_con_falla: int
    ordenes_hoy: int
    emergencia_activa: bool


class OrdenActualMapa(BaseModel):
    id: UUID
    codigo: str
    edificio_nombre: str


class MapaTecnico(BaseModel):
    id: UUID
    nombre: str
    estado_disponibilidad: EstadoDisponibilidadTecnico | None
    ubicacion: Coordenadas | None
    ubicacion_at: datetime | None
    orden_actual: OrdenActualMapa | None


class MapaEmergencia(BaseModel):
    id: UUID
    codigo: str
    tipo: Especialidad
    edificio_id: UUID
    edificio_nombre: str
    ubicacion: Coordenadas
    reportada_at: datetime
    estado: EstadoEmergencia


class MapaData(BaseModel):
    edificios: list[MapaEdificio]
    tecnicos: list[MapaTecnico]
    emergencias: list[MapaEmergencia]
