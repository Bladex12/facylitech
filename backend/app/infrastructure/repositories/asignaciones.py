from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.domain.cascada import ABIERTOS
from app.domain.enums import EstadoAsignacion
from app.infrastructure.db.models import Ascensor, AsignacionEmergencia, Emergencia
from app.infrastructure.repositories.emergencias import opciones_emergencia_completa


class SqlAsignacionRepository:
    """Asignaciones de la cascada de despacho. Las escrituras se acumulan en
    la sesión (`agregar`) y se confirman juntas (`confirmar`), para que
    aceptar una asignación (cancelar el resto + crear la OT + cambiar
    estados) sea atómico."""

    def __init__(self, session: AsyncSession):
        self.session = session

    def _con_relaciones(self, stmt):
        # Aquí NO se usa populate_existing (a diferencia de los otros repos): la
        # carga anidada Emergencia.asignaciones vuelve a poblar las mismas
        # instancias de AsignacionEmergencia y, con populate_existing, les
        # "descarga" la relación `emergencia` recién traída (lazy load posterior
        # -> MissingGreenlet en async). En su lugar se expira la sesión antes de
        # cada lectura (`_fresco`): siempre se llama sin cambios pendientes.
        return stmt.options(
            joinedload(AsignacionEmergencia.tecnico),
            joinedload(AsignacionEmergencia.emergencia).options(*opciones_emergencia_completa()),
        )

    def _fresco(self) -> None:
        self.session.expire_all()

    async def obtener(self, id_: UUID) -> AsignacionEmergencia | None:
        self._fresco()
        stmt = self._con_relaciones(
            select(AsignacionEmergencia).where(AsignacionEmergencia.id == id_)
        )
        return (await self.session.execute(stmt)).unique().scalar_one_or_none()

    async def listar(
        self, tecnico_id: UUID | None, estado: EstadoAsignacion | None
    ) -> list[AsignacionEmergencia]:
        self._fresco()
        stmt = self._con_relaciones(select(AsignacionEmergencia))
        if tecnico_id is not None:
            stmt = stmt.where(AsignacionEmergencia.tecnico_id == tecnico_id)
        if estado is not None:
            stmt = stmt.where(AsignacionEmergencia.estado == estado)
        stmt = stmt.order_by(
            AsignacionEmergencia.notificada_at.desc().nulls_last(),
            AsignacionEmergencia.created_at.desc(),
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def de_cascadas_abiertas(self) -> list[AsignacionEmergencia]:
        """Todas las asignaciones de las emergencias que tienen al menos una
        `en_espera`/`pendiente` (lo único que la evaluación perezosa puede mover)."""
        abiertas = (
            select(AsignacionEmergencia.emergencia_id)
            .where(AsignacionEmergencia.estado.in_(list(ABIERTOS)))
            .distinct()
        )
        self._fresco()
        stmt = select(AsignacionEmergencia).where(AsignacionEmergencia.emergencia_id.in_(abiertas))
        return list((await self.session.execute(stmt)).scalars().all())

    async def primer_ascensor_id(self, edificio_id: UUID) -> UUID | None:
        stmt = (
            select(Ascensor.id)
            .where(Ascensor.edificio_id == edificio_id)
            .order_by(Ascensor.codigo)
            .limit(1)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def emergencia(self, emergencia_id: UUID) -> Emergencia | None:
        self._fresco()
        stmt = (
            select(Emergencia)
            .where(Emergencia.id == emergencia_id)
            .options(*opciones_emergencia_completa())
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    def agregar(self, *objetos) -> None:
        self.session.add_all(objetos)

    async def confirmar(self) -> None:
        await self.session.commit()
