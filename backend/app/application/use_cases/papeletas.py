from datetime import UTC, datetime
from uuid import UUID

from app.application.errors import NoEncontradoError
from app.application.interfaces.repositories import PapeletaRepository
from app.domain.enums import EstadoPapeleta
from app.domain.pauta import items_del_mes
from app.infrastructure.db.models import OrdenTrabajo, Papeleta, PapeletaItem, PiezaReemplazada


async def crear_papeleta_desde_orden(
    repo: PapeletaRepository, orden: OrdenTrabajo, mes: int | None = None
) -> Papeleta:
    total_items_pauta = len(orden.pauta.items) if orden.pauta is not None else 0

    existente = await repo.obtener_por_orden(orden.id)
    if existente is not None:
        existente.total_items_pauta = total_items_pauta  # atributo transiente, no persistido
        return existente

    mes = mes or datetime.now(UTC).month
    papeleta = Papeleta(orden_trabajo_id=orden.id, hora_inicio=datetime.now(UTC))
    if orden.pauta is not None:
        items_correspondientes = items_del_mes(orden.pauta.items, mes)
        papeleta.items = [
            PapeletaItem(pauta_item_id=item.id, descripcion=item.descripcion)
            for item in items_correspondientes
        ]
    creada = await repo.crear(papeleta)
    creada.total_items_pauta = total_items_pauta  # atributo transiente, no persistido
    return creada


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
) -> PapeletaItem:
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


async def agregar_pieza(
    repo: PapeletaRepository, papeleta_id: UUID, nombre: str, marca: str | None, es_original: bool
) -> Papeleta:
    pieza = PiezaReemplazada(
        papeleta_id=papeleta_id, nombre=nombre, marca=marca, es_original=es_original
    )
    return await repo.agregar_pieza(pieza)


async def eliminar_pieza(repo: PapeletaRepository, papeleta_id: UUID, pieza_id: UUID) -> Papeleta:
    return await repo.eliminar_pieza(papeleta_id, pieza_id)
