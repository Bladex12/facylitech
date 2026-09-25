from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import Papeleta, PapeletaItem, PiezaReemplazada


class SqlPapeletaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _con_relaciones(self, stmt):
        # populate_existing: la sesión usa expire_on_commit=False, así que sin esto
        # una Papeleta ya cacheada en el identity map no refresca sus colecciones
        # (items/piezas/evidencias) tras un INSERT relacionado en la misma sesión.
        return stmt.options(
            selectinload(Papeleta.items),
            selectinload(Papeleta.piezas),
            selectinload(Papeleta.evidencias),
        ).execution_options(populate_existing=True)

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

    async def obtener_item(self, item_id: UUID) -> PapeletaItem | None:
        return await self.session.get(PapeletaItem, item_id)

    async def guardar_item(self, item: PapeletaItem) -> PapeletaItem:
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def agregar_pieza(self, pieza: PiezaReemplazada) -> Papeleta:
        self.session.add(pieza)
        await self.session.commit()
        return await self.obtener(pieza.papeleta_id)

    async def eliminar_pieza(self, papeleta_id: UUID, pieza_id: UUID) -> Papeleta:
        pieza = await self.session.get(PiezaReemplazada, pieza_id)
        if pieza is not None and pieza.papeleta_id == papeleta_id:
            await self.session.delete(pieza)
            await self.session.commit()
        return await self.obtener(papeleta_id)
