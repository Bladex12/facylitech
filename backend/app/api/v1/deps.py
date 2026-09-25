from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.session import get_session
from app.infrastructure.repositories.ascensores import SqlAscensorRepository
from app.infrastructure.repositories.edificios import SqlEdificioRepository
from app.infrastructure.repositories.ordenes_trabajo import SqlOrdenTrabajoRepository
from app.infrastructure.repositories.papeletas import SqlPapeletaRepository
from app.infrastructure.repositories.pautas import SqlPautaRepository
from app.infrastructure.repositories.usuarios import SqlUsuarioRepository

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_edificio_repo(session: SessionDep) -> SqlEdificioRepository:
    return SqlEdificioRepository(session)


def get_ascensor_repo(session: SessionDep) -> SqlAscensorRepository:
    return SqlAscensorRepository(session)


def get_usuario_repo(session: SessionDep) -> SqlUsuarioRepository:
    return SqlUsuarioRepository(session)


def get_pauta_repo(session: SessionDep) -> SqlPautaRepository:
    return SqlPautaRepository(session)


def get_orden_repo(session: SessionDep) -> SqlOrdenTrabajoRepository:
    return SqlOrdenTrabajoRepository(session)


def get_papeleta_repo(session: SessionDep) -> SqlPapeletaRepository:
    return SqlPapeletaRepository(session)


EdificioRepoDep = Annotated[SqlEdificioRepository, Depends(get_edificio_repo)]
AscensorRepoDep = Annotated[SqlAscensorRepository, Depends(get_ascensor_repo)]
UsuarioRepoDep = Annotated[SqlUsuarioRepository, Depends(get_usuario_repo)]
PautaRepoDep = Annotated[SqlPautaRepository, Depends(get_pauta_repo)]
OrdenRepoDep = Annotated[SqlOrdenTrabajoRepository, Depends(get_orden_repo)]
PapeletaRepoDep = Annotated[SqlPapeletaRepository, Depends(get_papeleta_repo)]
