from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import Administracion, Cliente


class SqlClienteRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def listar(self, limit: int, offset: int) -> tuple[list[Cliente], int]:
        total = (await self.session.execute(select(func.count()).select_from(Cliente))).scalar_one()
        rows = (
            (
                await self.session.execute(
                    select(Cliente).order_by(Cliente.nombre).limit(limit).offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), total

    async def obtener(self, id_: UUID) -> Cliente | None:
        return await self.session.get(Cliente, id_)

    async def crear(self, cliente: Cliente) -> Cliente:
        self.session.add(cliente)
        await self.session.commit()
        await self.session.refresh(cliente)
        return cliente

    async def administraciones(self, cliente_id: UUID) -> list[Administracion]:
        stmt = (
            select(Administracion)
            .where(Administracion.cliente_id == cliente_id)
            .order_by(Administracion.nombre)
        )
        return list((await self.session.execute(stmt)).scalars().all())
