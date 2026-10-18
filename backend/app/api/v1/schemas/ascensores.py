from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v1.schemas.common import ActualizacionParcial
from app.domain.enums import CategoriaEquipo, EstadoAscensor, TipoEquipo


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
    categoria: CategoriaEquipo = CategoriaEquipo.ASCENSOR
    estado: EstadoAscensor = EstadoAscensor.OPERACIONAL
    tasa_fallo: float | None = None
    manas: str | None = None
    ultima_mantencion: date | None = None


class AscensorCrear(AscensorBase):
    pass


class AscensorActualizar(ActualizacionParcial):
    """PATCH /ascensores/{id}: ficha técnica editable desde el operador."""

    NO_ANULABLES = ("estado",)

    estado: EstadoAscensor | None = None
    manas: str | None = None
    marca: str | None = None
    modelo: str | None = None
    pisos: int | None = Field(default=None, ge=1)
    anio_instalacion: int | None = Field(default=None, ge=1900, le=2100)
    torre: str | None = None
    numero: str | None = None


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
