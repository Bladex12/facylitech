"""Construye DTOs de salida que requieren datos calculados (semáforo) que no
viven en el modelo ORM."""

from datetime import datetime

from app.api.v1.schemas.ordenes_trabajo import AscensorResumen, OrdenTrabajoOut, TecnicoResumen
from app.domain.semaforo import calcular_semaforo
from app.infrastructure.db.models import OrdenTrabajo


def construir_orden_out(orden: OrdenTrabajo, ahora: datetime) -> OrdenTrabajoOut:
    semaforo = calcular_semaforo(orden.estado, orden.fecha_programada, ahora)
    return OrdenTrabajoOut(
        id=orden.id,
        codigo=orden.codigo,
        tipo=orden.tipo,
        prioridad=orden.prioridad,
        estado=orden.estado,
        semaforo=semaforo,
        ascensor=AscensorResumen.model_validate(orden.ascensor),
        tecnico=TecnicoResumen.model_validate(orden.tecnico) if orden.tecnico else None,
        fecha_programada=orden.fecha_programada,
        inicio_real=orden.inicio_real,
        fin_real=orden.fin_real,
        descripcion=orden.descripcion,
        papeleta_id=orden.papeleta.id if orden.papeleta else None,
        papeleta_estado=orden.papeleta.estado if orden.papeleta else None,
    )
