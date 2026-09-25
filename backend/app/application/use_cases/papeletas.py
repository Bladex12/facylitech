from datetime import UTC, datetime
from uuid import UUID

from app.application.errors import NoEncontradoError
from app.application.interfaces.repositories import PapeletaRepository
from app.domain.enums import EstadoPapeleta
from app.infrastructure.db.models import OrdenTrabajo, Papeleta, PapeletaChecklistItem


async def crear_papeleta_desde_orden(repo: PapeletaRepository, orden: OrdenTrabajo) -> Papeleta:
    existente = await repo.obtener_por_orden(orden.id)
    if existente is not None:
        return existente

    papeleta = Papeleta(orden_trabajo_id=orden.id, hora_inicio=datetime.now(UTC))
    if orden.pauta is not None:
        papeleta.checklist = [
            PapeletaChecklistItem(pauta_item_id=item.id, descripcion=item.descripcion)
            for item in orden.pauta.items
        ]
    return await repo.crear(papeleta)


async def obtener_papeleta(repo: PapeletaRepository, id_: UUID) -> Papeleta:
    papeleta = await repo.obtener(id_)
    if papeleta is None:
        raise NoEncontradoError(f"Papeleta {id_} no encontrada.")
    return papeleta


async def actualizar_papeleta(repo: PapeletaRepository, id_: UUID, campos: dict) -> Papeleta:
    papeleta = await obtener_papeleta(repo, id_)
    for campo, valor in campos.items():
        setattr(papeleta, campo, valor)
    return await repo.guardar(papeleta)


async def marcar_item_checklist(
    repo: PapeletaRepository,
    papeleta_id: UUID,
    item_id: UUID,
    completado: bool,
    comentario: str | None,
) -> PapeletaChecklistItem:
    item = await repo.obtener_item(item_id)
    if item is None or item.papeleta_id != papeleta_id:
        raise NoEncontradoError(f"Ítem de checklist {item_id} no encontrado en la papeleta.")
    item.completado = completado
    item.completado_at = datetime.now(UTC) if completado else None
    if comentario is not None:
        item.comentario = comentario
    return await repo.guardar_item(item)


async def enviar_papeleta(repo: PapeletaRepository, id_: UUID) -> Papeleta:
    papeleta = await obtener_papeleta(repo, id_)
    papeleta.estado = EstadoPapeleta.ENVIADA
    papeleta.hora_fin = datetime.now(UTC)
    return await repo.guardar(papeleta)
