from datetime import date
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import EstadoAscensor, TipoEquipo


class EdificioResumen(BaseModel):
    id: UUID
    nombre: str
    direccion: str
    comuna: str

    model_config = {"from_attributes": True}


class AscensorBase(BaseModel):
    edificio_id: UUID
    codigo: str
    codigo_qr: str
    torre: str | None = None
    numero: str | None = None
    marca: str | None = None
    modelo: str | None = None
    anio_instalacion: int | None = None
    pisos: int | None = None
    tipo_equipo: TipoEquipo
    estado: EstadoAscensor = EstadoAscensor.OPERACIONAL
    tasa_fallo: float | None = None
    manas: str | None = None
    ultima_mantencion: date | None = None


class AscensorCrear(AscensorBase):
    pass


class AscensorOut(AscensorBase):
    id: UUID
    edificio: EdificioResumen | None = None

    model_config = {"from_attributes": True}


class PiezaBitacora(BaseModel):
    nombre: str
    marca: str | None
    es_original: bool

    model_config = {"from_attributes": True}


class BitacoraEntrada(BaseModel):
    orden_codigo: str
    tipo: str
    fecha: date
    tecnico_nombre: str | None
    descripcion: str | None
    falla_detectada: str | None
    trabajo_realizado: str | None
    piezas: list[PiezaBitacora]
