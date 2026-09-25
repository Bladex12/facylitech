from datetime import date
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import EstadoOrdenTrabajo, PrioridadOrdenTrabajo, Semaforo, TipoOrdenTrabajo


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


class CalendarioMesOut(BaseModel):
    anio: int
    mes: int
    dias: list[DiaCalendario]
    emergencias_abiertas: int
