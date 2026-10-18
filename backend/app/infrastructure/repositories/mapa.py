from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import (
    EstadoAscensor,
    EstadoEmergencia,
    EstadoOrdenTrabajo,
    RolUsuario,
)
from app.infrastructure.db.models import Ascensor, Edificio, Emergencia, OrdenTrabajo, Usuario


@dataclass
class EdificioMapa:
    edificio: Edificio
    total_equipos: int
    equipos_con_falla: int
    ordenes_hoy: int
    emergencia_activa: bool


@dataclass
class DatosMapa:
    edificios: list[EdificioMapa]
    tecnicos: list[Usuario]
    # tecnico_id -> orden en curso más reciente (con ascensor.edificio cargado)
    ordenes_en_curso: dict
    emergencias: list[Emergencia]


class SqlMapaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def datos(self, inicio_dia: datetime, fin_dia: datetime) -> DatosMapa:
        total_equipos = (
            select(func.count())
            .select_from(Ascensor)
            .where(Ascensor.edificio_id == Edificio.id)
            .correlate(Edificio)
            .scalar_subquery()
        )
        con_falla = (
            select(func.count())
            .select_from(Ascensor)
            .where(
                Ascensor.edificio_id == Edificio.id,
                Ascensor.estado != EstadoAscensor.OPERACIONAL,
            )
            .correlate(Edificio)
            .scalar_subquery()
        )
        ordenes_hoy = (
            select(func.count())
            .select_from(OrdenTrabajo)
            .join(Ascensor, OrdenTrabajo.ascensor_id == Ascensor.id)
            .where(
                Ascensor.edificio_id == Edificio.id,
                OrdenTrabajo.fecha_programada >= inicio_dia,
                OrdenTrabajo.fecha_programada < fin_dia,
                OrdenTrabajo.estado != EstadoOrdenTrabajo.CANCELADO,
            )
            .correlate(Edificio)
            .scalar_subquery()
        )
        emergencia_activa = exists().where(
            Emergencia.edificio_id == Edificio.id, Emergencia.estado != EstadoEmergencia.CERRADA
        )
        filas = (
            await self.session.execute(
                select(Edificio, total_equipos, con_falla, ordenes_hoy, emergencia_activa).order_by(
                    Edificio.nombre
                )
            )
        ).all()
        edificios = [EdificioMapa(e, t, f, o, a) for e, t, f, o, a in filas]

        tecnicos = list(
            (
                await self.session.execute(
                    select(Usuario)
                    .where(Usuario.rol == RolUsuario.TECNICO, Usuario.activo.is_(True))
                    .order_by(Usuario.nombre)
                )
            )
            .scalars()
            .all()
        )

        en_curso = (
            (
                await self.session.execute(
                    select(OrdenTrabajo)
                    .where(
                        OrdenTrabajo.estado == EstadoOrdenTrabajo.EN_CURSO,
                        OrdenTrabajo.tecnico_id.is_not(None),
                    )
                    .options(selectinload(OrdenTrabajo.ascensor).selectinload(Ascensor.edificio))
                    .order_by(OrdenTrabajo.inicio_real.desc().nulls_last())
                )
            )
            .scalars()
            .all()
        )
        ordenes_en_curso: dict = {}
        for orden in en_curso:
            ordenes_en_curso.setdefault(orden.tecnico_id, orden)

        emergencias = list(
            (
                await self.session.execute(
                    select(Emergencia)
                    .where(Emergencia.estado != EstadoEmergencia.CERRADA)
                    .options(selectinload(Emergencia.edificio))
                    .order_by(Emergencia.reportada_at.desc())
                )
            )
            .scalars()
            .all()
        )
        return DatosMapa(edificios, tecnicos, ordenes_en_curso, emergencias)
