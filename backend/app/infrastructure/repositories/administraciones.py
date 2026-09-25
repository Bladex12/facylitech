from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import Administracion, Edificio


class SqlAdministracionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def listar(self, limit: int, offset: int) -> tuple[list[Administracion], int]:
        total = (
            await self.session.execute(select(func.count()).select_from(Administracion))
        ).scalar_one()
        rows = (
            (
                await self.session.execute(
                    select(Administracion).order_by(Administracion.nombre).limit(limit).offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), total

    async def obtener(self, id_: UUID) -> Administracion | None:
        return await self.session.get(Administracion, id_)

    async def crear(self, administracion: Administracion) -> Administracion:
        self.session.add(administracion)
        await self.session.commit()
        await self.session.refresh(administracion)
        return administracion

    async def edificios(self, administracion_id: UUID) -> list[Edificio]:
        stmt = (
            select(Edificio)
            .where(Edificio.administracion_id == administracion_id)
            .order_by(Edificio.nombre)
        )
        return list((await self.session.execute(stmt)).scalars().all())
