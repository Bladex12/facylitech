from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import RolUsuario
from app.infrastructure.db.models import Usuario


class SqlUsuarioRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def listar(
        self, limit: int, offset: int, rol: RolUsuario | None
    ) -> tuple[list[Usuario], int]:
        stmt = select(Usuario)
        count_stmt = select(func.count()).select_from(Usuario)
        if rol is not None:
            stmt = stmt.where(Usuario.rol == rol)
            count_stmt = count_stmt.where(Usuario.rol == rol)
        total = (await self.session.execute(count_stmt)).scalar_one()
        rows = (
            (await self.session.execute(stmt.order_by(Usuario.nombre).limit(limit).offset(offset)))
            .scalars()
            .all()
        )
        return list(rows), total

    async def obtener(self, id_: UUID) -> Usuario | None:
        return await self.session.get(Usuario, id_)

    async def crear(self, usuario: Usuario) -> Usuario:
        self.session.add(usuario)
        await self.session.commit()
        await self.session.refresh(usuario)
        return usuario
