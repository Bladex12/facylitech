from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import Mensaje


class SqlMensajeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _con_usuarios(self, stmt):
        return stmt.options(
            selectinload(Mensaje.remitente), selectinload(Mensaje.destinatario)
        ).execution_options(populate_existing=True)

    async def de_usuario(self, usuario_id: UUID) -> list[Mensaje]:
        stmt = self._con_usuarios(
            select(Mensaje).where(
                or_(Mensaje.remitente_id == usuario_id, Mensaje.destinatario_id == usuario_id)
            )
        ).order_by(Mensaje.created_at)
        return list((await self.session.execute(stmt)).scalars().all())

    async def hilo(self, usuario_id: UUID, contraparte_id: UUID) -> list[Mensaje]:
        stmt = self._con_usuarios(
            select(Mensaje).where(
                or_(
                    and_(Mensaje.remitente_id == usuario_id, Mensaje.destinatario_id == contraparte_id),
                    and_(Mensaje.remitente_id == contraparte_id, Mensaje.destinatario_id == usuario_id),
                )
            )
        ).order_by(Mensaje.created_at, Mensaje.id)
        return list((await self.session.execute(stmt)).scalars().all())

    async def crear(self, mensaje: Mensaje) -> Mensaje:
        self.session.add(mensaje)
        await self.session.commit()
        stmt = self._con_usuarios(select(Mensaje).where(Mensaje.id == mensaje.id))
        return (await self.session.execute(stmt)).scalar_one()

    async def marcar_leidos(self, usuario_id: UUID, contraparte_id: UUID, ahora: datetime) -> int:
        resultado = await self.session.execute(
            update(Mensaje)
            .where(
                Mensaje.destinatario_id == usuario_id,
                Mensaje.remitente_id == contraparte_id,
                Mensaje.leido_at.is_(None),
            )
            .values(leido_at=ahora)
        )
        await self.session.commit()
        return resultado.rowcount or 0
