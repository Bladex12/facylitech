from datetime import date, datetime, time
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import EstadoOrdenTrabajo, TipoOrdenTrabajo
from app.infrastructure.db.models import Ascensor, OrdenTrabajo, PautaMantencion

_TZ = ZoneInfo("America/Santiago")
_CODIGO_BASE = 2850


class SqlOrdenTrabajoRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _con_relaciones(self, stmt):
        return stmt.options(
            selectinload(OrdenTrabajo.ascensor).selectinload(Ascensor.edificio),
            selectinload(OrdenTrabajo.tecnico),
            selectinload(OrdenTrabajo.pauta).selectinload(PautaMantencion.items),
            selectinload(OrdenTrabajo.papeleta),
        )

    async def listar(
        self,
        limit: int,
        offset: int,
        desde: date | None,
        hasta: date | None,
        tecnico_id: UUID | None,
        estado: EstadoOrdenTrabajo | None,
        tipo: TipoOrdenTrabajo | None,
        edificio_id: UUID | None,
    ) -> tuple[list[OrdenTrabajo], int]:
        stmt = select(OrdenTrabajo)
        count_stmt = select(func.count()).select_from(OrdenTrabajo)
        if edificio_id is not None:
            stmt = stmt.join(OrdenTrabajo.ascensor)
            count_stmt = count_stmt.join(OrdenTrabajo.ascensor)

        conditions = []
        if desde is not None:
            conditions.append(
                OrdenTrabajo.fecha_programada >= datetime.combine(desde, time.min, tzinfo=_TZ)
            )
        if hasta is not None:
            conditions.append(
                OrdenTrabajo.fecha_programada <= datetime.combine(hasta, time.max, tzinfo=_TZ)
            )
        if tecnico_id is not None:
            conditions.append(OrdenTrabajo.tecnico_id == tecnico_id)
        if estado is not None:
            conditions.append(OrdenTrabajo.estado == estado)
        if tipo is not None:
            conditions.append(OrdenTrabajo.tipo == tipo)
        if edificio_id is not None:
            conditions.append(Ascensor.edificio_id == edificio_id)

        for cond in conditions:
            stmt = stmt.where(cond)
            count_stmt = count_stmt.where(cond)

        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = self._con_relaciones(stmt).order_by(OrdenTrabajo.fecha_programada)
        rows = (await self.session.execute(stmt.limit(limit).offset(offset))).scalars().all()
        return list(rows), total

    async def obtener(self, id_: UUID) -> OrdenTrabajo | None:
        stmt = self._con_relaciones(select(OrdenTrabajo).where(OrdenTrabajo.id == id_))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def crear(self, orden: OrdenTrabajo) -> OrdenTrabajo:
        self.session.add(orden)
        await self.session.commit()
        return await self.obtener(orden.id)

    async def guardar(self, orden: OrdenTrabajo) -> OrdenTrabajo:
        await self.session.commit()
        return await self.obtener(orden.id)

    async def siguiente_codigo(self) -> str:
        total = (
            await self.session.execute(select(func.count()).select_from(OrdenTrabajo))
        ).scalar_one()
        return f"WO-{_CODIGO_BASE + total}"

    async def listar_por_mes(self, anio: int, mes: int) -> list[OrdenTrabajo]:
        inicio = datetime(anio, mes, 1, tzinfo=_TZ)
        fin_mes = 12 if mes == 12 else mes + 1
        fin_anio = anio + 1 if mes == 12 else anio
        fin = datetime(fin_anio, fin_mes, 1, tzinfo=_TZ)
        stmt = self._con_relaciones(
            select(OrdenTrabajo).where(
                OrdenTrabajo.fecha_programada >= inicio, OrdenTrabajo.fecha_programada < fin
            )
        ).order_by(OrdenTrabajo.fecha_programada)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows)
