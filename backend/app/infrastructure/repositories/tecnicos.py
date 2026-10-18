from dataclasses import dataclass
from uuid import UUID

from geoalchemy2 import Geography
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import EstadoOrdenTrabajo, RolUsuario
from app.infrastructure.db.models import OrdenTrabajo, Usuario


@dataclass
class TecnicoConDistancia:
    tecnico: Usuario
    distancia_m: float | None
    ordenes_en_curso: int


def _punto(lat: float, lon: float):
    """Punto geography(4326) como expresión SQL (parámetros ligados, sin formatear texto)."""
    return cast(func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326), Geography(srid=4326))


class SqlTecnicoRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def con_distancia(
        self, lat: float, lon: float, tecnico_ids: list[UUID] | None = None
    ) -> list[TecnicoConDistancia]:
        """Técnicos activos con su distancia (m) al punto, calculada por PostGIS.

        `ST_Distance(geography, geography)` mide sobre el esferoide WGS84; el
        orden usa el operador KNN `<->`, que puede aprovechar el índice GiST de
        `usuario.ultima_ubicacion`. Técnicos sin ubicación -> distancia None.
        No se limita en SQL: el orden final (disponibilidad, especialidad,
        distancia) se aplica en `domain/cercania.ordenar_candidatos`, y con ~20
        usuarios (RNF-06) traerlos todos es trivial.
        """
        punto = _punto(lat, lon)
        distancia = func.ST_Distance(Usuario.ultima_ubicacion, punto)
        en_curso = (
            select(func.count())
            .select_from(OrdenTrabajo)
            .where(
                OrdenTrabajo.tecnico_id == Usuario.id,
                OrdenTrabajo.estado == EstadoOrdenTrabajo.EN_CURSO,
            )
            .correlate(Usuario)
            .scalar_subquery()
        )
        stmt = (
            select(Usuario, distancia, en_curso)
            .where(Usuario.rol == RolUsuario.TECNICO, Usuario.activo.is_(True))
            .order_by(Usuario.ultima_ubicacion.op("<->")(punto).nulls_last(), Usuario.nombre)
        )
        if tecnico_ids is not None:
            stmt = stmt.where(Usuario.id.in_(tecnico_ids))
        filas = (await self.session.execute(stmt)).all()
        return [
            TecnicoConDistancia(
                tecnico=u, distancia_m=float(d) if d is not None else None, ordenes_en_curso=n
            )
            for u, d, n in filas
        ]
