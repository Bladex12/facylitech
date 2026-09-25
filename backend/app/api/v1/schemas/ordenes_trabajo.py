from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import EstadoOrdenTrabajo, PrioridadOrdenTrabajo, Semaforo, TipoOrdenTrabajo


class EdificioResumen(BaseModel):
    id: UUID
    nombre: str
    direccion: str
    comuna: str
    manas: str | None = None
    instrucciones_reinicio: str | None = None

    model_config = {"from_attributes": True}


class AscensorResumen(BaseModel):
    id: UUID
    codigo: str
    torre: str | None = None
    numero: str | None = None
    manas: str | None = None
    edificio: EdificioResumen

    model_config = {"from_attributes": True}


class TecnicoResumen(BaseModel):
    id: UUID
    nombre: str

    model_config = {"from_attributes": True}


class OrdenTrabajoCrear(BaseModel):
    tipo: TipoOrdenTrabajo
    prioridad: PrioridadOrdenTrabajo
    ascensor_id: UUID
    tecnico_id: UUID | None = None
    pauta_id: UUID | None = None
    emergencia_id: UUID | None = None
    fecha_programada: datetime
    descripcion: str | None = None


class OrdenTrabajoOut(BaseModel):
    id: UUID
    codigo: str
    tipo: TipoOrdenTrabajo
    prioridad: PrioridadOrdenTrabajo
    estado: EstadoOrdenTrabajo
    semaforo: Semaforo
    ascensor: AscensorResumen
    tecnico: TecnicoResumen | None
    emergencia_id: UUID | None = None
    fecha_programada: datetime
    inicio_real: datetime | None
    fin_real: datetime | None
    descripcion: str | None
    papeleta_id: UUID | None = None
    papeleta_estado: str | None = None
