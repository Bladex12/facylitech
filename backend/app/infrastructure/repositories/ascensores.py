from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import EstadoOrdenTrabajo
from app.infrastructure.db.models import Ascensor, OrdenTrabajo, Papeleta, PautaMantencion


class SqlAscensorRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def listar(
        self, limit: int, offset: int, edificio_id: UUID | None
    ) -> tuple[list[Ascensor], int]:
        stmt = select(Ascensor)
        count_stmt = select(func.count()).select_from(Ascensor)
        if edificio_id is not None:
            stmt = stmt.where(Ascensor.edificio_id == edificio_id)
            count_stmt = count_stmt.where(Ascensor.edificio_id == edificio_id)
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = stmt.options(selectinload(Ascensor.edificio)).order_by(Ascensor.codigo)
        rows = (await self.session.execute(stmt.limit(limit).offset(offset))).scalars().all()
        return list(rows), total

    async def obtener(self, id_: UUID) -> Ascensor | None:
        stmt = select(Ascensor).where(Ascensor.id == id_).options(selectinload(Ascensor.edificio))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def crear(self, ascensor: Ascensor) -> Ascensor:
        self.session.add(ascensor)
        await self.session.commit()
        await self.session.refresh(ascensor, attribute_names=["edificio"])
        return ascensor

    async def bitacora(self, ascensor_id: UUID) -> list[OrdenTrabajo]:
        """Query (no tabla): órdenes completadas de un ascensor con su papeleta y piezas."""
        stmt = (
            select(OrdenTrabajo)
            .where(
                OrdenTrabajo.ascensor_id == ascensor_id,
                OrdenTrabajo.estado == EstadoOrdenTrabajo.COMPLETADO,
            )
            .options(
                selectinload(OrdenTrabajo.papeleta).selectinload(Papeleta.piezas),
                selectinload(OrdenTrabajo.papeleta).selectinload(Papeleta.items),
                selectinload(OrdenTrabajo.tecnico),
                selectinload(OrdenTrabajo.pauta).selectinload(PautaMantencion.items),
            )
            .order_by(OrdenTrabajo.fecha_programada.desc())
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows)
