from uuid import UUID

from app.application.interfaces.repositories import PautaRepository
from app.infrastructure.db.models import PautaMantencion


async def listar_pautas(repo: PautaRepository, limit: int, offset: int):
    return await repo.listar(limit, offset)


async def obtener_pauta(repo: PautaRepository, id_: UUID) -> PautaMantencion | None:
    return await repo.obtener(id_)


async def crear_pauta(repo: PautaRepository, pauta: PautaMantencion) -> PautaMantencion:
    return await repo.crear(pauta)
