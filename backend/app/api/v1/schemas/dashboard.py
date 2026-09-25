from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import (
    Especialidad,
    EstadoOrdenTrabajo,
    PrioridadOrdenTrabajo,
    Semaforo,
    TipoOrdenTrabajo,
)


class OrdenCalendarioItem(BaseModel):
    id: UUID
    codigo: str
    hora: str
    ascensor_codigo: str
    edificio_nombre: str
    tipo: TipoOrdenTrabajo
    prioridad: PrioridadOrdenTrabajo
    estado: EstadoOrdenTrabajo
    semaforo: Semaforo


class DiaCalendario(BaseModel):
    fecha: date
    ordenes: list[OrdenCalendarioItem]


class EmergenciaBanner(BaseModel):
    id: UUID
    codigo: str
    tipo: Especialidad
    edificio_nombre: str
    descripcion: str | None
    reportada_at: datetime


class CalendarioMesOut(BaseModel):
    anio: int
    mes: int
    dias: list[DiaCalendario]
    emergencias_abiertas: list[EmergenciaBanner]
