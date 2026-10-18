from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import RolUsuario
from app.infrastructure.db.models import Usuario
from app.infrastructure.geo import punto_desde_coords


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

    async def listar_activos(self, rol: RolUsuario) -> list[Usuario]:
        stmt = select(Usuario).where(Usuario.rol == rol, Usuario.activo.is_(True)).order_by(Usuario.nombre)
        return list((await self.session.execute(stmt)).scalars().all())

    async def obtener_por_email(self, email: str) -> Usuario | None:
        """Búsqueda sin distinguir mayúsculas (el login no debe depender de ellas)."""
        stmt = select(Usuario).where(func.lower(Usuario.email) == email.strip().lower()).limit(1)
        return (await self.session.execute(stmt)).scalars().first()

    async def guardar_password_hash(self, usuario: Usuario, password_hash: str) -> Usuario:
        usuario.password_hash = password_hash
        await self.session.commit()
        return usuario

    async def actualizar_ubicacion(
        self, usuario: Usuario, lat: float, lon: float, momento: datetime
    ) -> Usuario:
        usuario.ultima_ubicacion = punto_desde_coords(lat, lon)
        usuario.ultima_ubicacion_at = momento
        await self.session.commit()
        await self.session.refresh(usuario)
        return usuario
