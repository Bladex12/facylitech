from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v1.schemas.common import Coordenadas
from app.domain.enums import Especialidad, EstadoAsignacion, EstadoEmergencia


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


class TecnicoResumen(BaseModel):
    id: UUID
    nombre: str

    model_config = {"from_attributes": True}


class AsignacionEmergenciaOut(BaseModel):
    id: UUID
    emergencia_id: UUID
    tecnico: TecnicoResumen
    orden: int
    estado: EstadoAsignacion
    distancia_m: float | None
    notificada_at: datetime | None
    respondida_at: datetime | None
    # notificada_at + tiempo de respuesta, solo si sigue pendiente.
    expira_at: datetime | None
    motivo_rechazo: str | None


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

    # --- Contrato octubre 2026 (siempre construido por serializers.construir_emergencia_out) ---
    # Coordenadas del edificio (mapa y cercanía).
    ubicacion: Coordenadas
    # Cascada de despacho, ordenada por `orden`. Vacía si aún no se despacha.
    asignaciones: list[AsignacionEmergenciaOut] = []
    # Todos rechazaron/expiraron: el operador debe re-despachar.
    cascada_agotada: bool = False
    # OT de emergencia creada al aceptar (derivada de orden_trabajo.emergencia_id).
    orden_trabajo_id: UUID | None = None


class DespacharEmergencia(BaseModel):
    tecnico_ids: list[UUID]
    operador_id: UUID


class RechazarAsignacion(BaseModel):
    motivo: str | None = None


class AsignacionTecnicoOut(AsignacionEmergenciaOut):
    """Asignación vista por el técnico, con la emergencia embebida."""

    emergencia: EmergenciaOut
