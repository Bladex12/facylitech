from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v1.schemas.common import ActualizacionParcial
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


class OrdenTrabajoActualizar(ActualizacionParcial):
    """PATCH /ordenes-trabajo/{id}: reasignar técnico (null = sin asignar),
    reprogramar, cambiar prioridad o descripción."""

    NO_ANULABLES = ("fecha_programada", "prioridad")

    tecnico_id: UUID | None = None
    fecha_programada: datetime | None = None
    prioridad: PrioridadOrdenTrabajo | None = None
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


class ReplicarCronograma(BaseModel):
    """POST /ordenes-trabajo/replicar: copia las mantenciones de `mes` al mes siguiente."""

    mes: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-11"])
    simular: bool = True


class OrdenReplicada(BaseModel):
    origen_codigo: str
    ascensor_codigo: str
    edificio_nombre: str
    tecnico_nombre: str | None
    fecha_origen: datetime
    fecha_programada: datetime
    codigo: str | None = None  # código de la OT creada (null en simulación)


class OrdenOmitidaOut(BaseModel):
    origen_codigo: str
    ascensor_codigo: str
    edificio_nombre: str
    motivo: str


class ReplicacionOut(BaseModel):
    mes_origen: str
    mes_destino: str
    simulacion: bool
    total_crear: int
    crear: list[OrdenReplicada]
    omitidas: list[OrdenOmitidaOut]
