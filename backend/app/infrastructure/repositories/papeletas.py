from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import Papeleta, PapeletaChecklistItem


class SqlPapeletaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _con_relaciones(self, stmt):
        return stmt.options(
            selectinload(Papeleta.checklist), selectinload(Papeleta.evidencias)
        )

    async def obtener(self, id_: UUID) -> Papeleta | None:
        stmt = self._con_relaciones(select(Papeleta).where(Papeleta.id == id_))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def obtener_por_orden(self, orden_trabajo_id: UUID) -> Papeleta | None:
        stmt = self._con_relaciones(
            select(Papeleta).where(Papeleta.orden_trabajo_id == orden_trabajo_id)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def crear(self, papeleta: Papeleta) -> Papeleta:
        self.session.add(papeleta)
        await self.session.commit()
        return await self.obtener(papeleta.id)

    async def guardar(self, papeleta: Papeleta) -> Papeleta:
        await self.session.commit()
        return await self.obtener(papeleta.id)

    async def obtener_item(self, item_id: UUID) -> PapeletaChecklistItem | None:
        return await self.session.get(PapeletaChecklistItem, item_id)

    async def guardar_item(self, item: PapeletaChecklistItem) -> PapeletaChecklistItem:
        await self.session.commit()
        await self.session.refresh(item)
        return item
