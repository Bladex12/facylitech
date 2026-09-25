from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import Emergencia

_CODIGO_BASE = 1


class SqlEmergenciaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def listar(
        self, limit: int, offset: int, estado: str | None
    ) -> tuple[list[Emergencia], int]:
        stmt = select(Emergencia).options(
            selectinload(Emergencia.edificio), selectinload(Emergencia.ascensor)
        )
        count_stmt = select(func.count()).select_from(Emergencia)
        if estado is not None:
            stmt = stmt.where(Emergencia.estado == estado)
            count_stmt = count_stmt.where(Emergencia.estado == estado)
        total = (await self.session.execute(count_stmt)).scalar_one()
        rows = (
            (await self.session.execute(stmt.order_by(Emergencia.reportada_at.desc()).limit(limit).offset(offset)))
            .scalars()
            .all()
        )
        return list(rows), total

    async def obtener(self, id_: UUID) -> Emergencia | None:
        stmt = (
            select(Emergencia)
            .where(Emergencia.id == id_)
            .options(selectinload(Emergencia.edificio), selectinload(Emergencia.ascensor))
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def crear(self, emergencia: Emergencia) -> Emergencia:
        self.session.add(emergencia)
        await self.session.commit()
        await self.session.refresh(emergencia, attribute_names=["edificio", "ascensor"])
        return emergencia

    async def guardar(self, emergencia: Emergencia) -> Emergencia:
        await self.session.commit()
        await self.session.refresh(emergencia, attribute_names=["edificio", "ascensor"])
        return emergencia

    async def siguiente_codigo(self) -> str:
        total = (
            await self.session.execute(select(func.count()).select_from(Emergencia))
        ).scalar_one()
        return f"EM-{_CODIGO_BASE + total:03d}"
