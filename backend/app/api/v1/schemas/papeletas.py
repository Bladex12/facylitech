from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.enums import EstadoPapeleta


class ChecklistItemOut(BaseModel):
    id: UUID
    pauta_item_id: UUID | None
    descripcion: str
    completado: bool
    completado_at: datetime | None
    comentario: str | None

    model_config = {"from_attributes": True}


class ChecklistItemMarcar(BaseModel):
    completado: bool
    comentario: str | None = None


class PiezaOut(BaseModel):
    id: UUID
    nombre: str
    marca: str | None
    es_original: bool

    model_config = {"from_attributes": True}


class PiezaCrear(BaseModel):
    nombre: str
    marca: str | None = None
    es_original: bool = True


class PapeletaActualizar(BaseModel):
    observaciones: str | None = None
    falla_detectada: str | None = None
    trabajo_realizado: str | None = None
    causada_por_terceros: bool | None = None
    folio_fisico: str | None = None
    receptor_nombre: str | None = None


class PapeletaOut(BaseModel):
    id: UUID
    orden_trabajo_id: UUID
    observaciones: str | None
    falla_detectada: str | None
    trabajo_realizado: str | None
    causada_por_terceros: bool
    hora_inicio: datetime | None
    hora_fin: datetime | None
    estado: EstadoPapeleta
    folio_fisico: str | None
    receptor_nombre: str | None
    items: list[ChecklistItemOut]
    piezas: list[PiezaOut]
    # Total de ítems de la pauta (sin filtrar por mes); permite mostrar
    # "Este mes corresponden X de Y ítems". None si la orden no tiene pauta.
    total_items_pauta: int | None = None

    model_config = {"from_attributes": True}
