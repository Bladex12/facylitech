from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import PautaMantencion


class SqlPautaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def listar(self, limit: int, offset: int) -> tuple[list[PautaMantencion], int]:
        total = (
            await self.session.execute(select(func.count()).select_from(PautaMantencion))
        ).scalar_one()
        stmt = (
            select(PautaMantencion)
            .options(selectinload(PautaMantencion.items))
            .order_by(PautaMantencion.nombre)
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), total

    async def obtener(self, id_: UUID) -> PautaMantencion | None:
        stmt = (
            select(PautaMantencion)
            .where(PautaMantencion.id == id_)
            .options(selectinload(PautaMantencion.items))
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def crear(self, pauta: PautaMantencion) -> PautaMantencion:
        self.session.add(pauta)
        await self.session.commit()
        await self.session.refresh(pauta, attribute_names=["items"])
        return pauta
