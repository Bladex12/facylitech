from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import AsignacionEmergencia, Emergencia

_CODIGO_BASE = 1


def opciones_emergencia_completa():
    """Relaciones necesarias para construir EmergenciaOut sin lazy loads."""
    return (
        selectinload(Emergencia.edificio),
        selectinload(Emergencia.ascensor),
        selectinload(Emergencia.asignaciones).selectinload(AsignacionEmergencia.tecnico),
        selectinload(Emergencia.ordenes),
    )


class SqlEmergenciaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _con_relaciones(self, stmt):
        # populate_existing: ver nota en SqlPapeletaRepository._con_relaciones.
        return stmt.options(*opciones_emergencia_completa()).execution_options(
            populate_existing=True
        )

    async def listar(
        self, limit: int, offset: int, estado: str | None
    ) -> tuple[list[Emergencia], int]:
        stmt = self._con_relaciones(select(Emergencia))
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
        stmt = self._con_relaciones(select(Emergencia).where(Emergencia.id == id_))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def crear(self, emergencia: Emergencia) -> Emergencia:
        self.session.add(emergencia)
        await self.session.commit()
        return await self.obtener(emergencia.id)

    async def guardar(self, emergencia: Emergencia) -> Emergencia:
        await self.session.commit()
        return await self.obtener(emergencia.id)

    async def siguiente_codigo(self) -> str:
        total = (
            await self.session.execute(select(func.count()).select_from(Emergencia))
        ).scalar_one()
        return f"EM-{_CODIGO_BASE + total:03d}"
