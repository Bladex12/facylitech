from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import Edificio


class SqlEdificioRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def listar(self, limit: int, offset: int) -> tuple[list[Edificio], int]:
        count_stmt = select(func.count()).select_from(Edificio)
        total = (await self.session.execute(count_stmt)).scalar_one()
        rows = (
            (
                await self.session.execute(
                    select(Edificio).order_by(Edificio.nombre).limit(limit).offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), total

    async def obtener(self, id_: UUID) -> Edificio | None:
        return await self.session.get(Edificio, id_)

    async def crear(self, edificio: Edificio) -> Edificio:
        self.session.add(edificio)
        await self.session.commit()
        await self.session.refresh(edificio)
        return edificio
