from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import Especialidad, EstadoEmergencia


class EdificioResumen(BaseModel):
    id: UUID
    nombre: str
    direccion: str

    model_config = {"from_attributes": True}


class AscensorResumen(BaseModel):
    id: UUID
    codigo: str

    model_config = {"from_attributes": True}


class EmergenciaCrear(BaseModel):
    tipo: Especialidad
    edificio_id: UUID
    ascensor_id: UUID | None = None
    descripcion: str | None = None
    solicitante: str | None = None
    reportada_at: datetime | None = None


class EmergenciaActualizarEstado(BaseModel):
    estado: EstadoEmergencia


class EmergenciaOut(BaseModel):
    id: UUID
    codigo: str
    tipo: Especialidad
    edificio: EdificioResumen
    ascensor: AscensorResumen | None
    reportada_at: datetime
    descripcion: str | None
    solicitante: str | None
    estado: EstadoEmergencia

    model_config = {"from_attributes": True}
