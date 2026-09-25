from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.v1.deps import PapeletaRepoDep
from app.api.v1.schemas.papeletas import (
    ChecklistItemMarcar,
    ChecklistItemOut,
    PapeletaActualizar,
    PapeletaOut,
)
from app.application.errors import NoEncontradoError
from app.application.use_cases.papeletas import (
    actualizar_papeleta,
    enviar_papeleta,
    marcar_item_checklist,
    obtener_papeleta,
)

router = APIRouter(prefix="/papeletas", tags=["papeletas"])


@router.get("/{id_}", response_model=PapeletaOut)
async def obtener(id_: UUID, repo: PapeletaRepoDep):
    try:
        return await obtener_papeleta(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{id_}", response_model=PapeletaOut)
async def actualizar(id_: UUID, datos: PapeletaActualizar, repo: PapeletaRepoDep):
    try:
        return await actualizar_papeleta(
            repo, id_, datos.model_dump(exclude_unset=True)
        )
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{id_}/items/{item_id}", response_model=ChecklistItemOut)
async def marcar_item(id_: UUID, item_id: UUID, datos: ChecklistItemMarcar, repo: PapeletaRepoDep):
    try:
        return await marcar_item_checklist(
            repo, id_, item_id, datos.completado, datos.comentario
        )
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{id_}/enviar", response_model=PapeletaOut)
async def enviar(id_: UUID, repo: PapeletaRepoDep):
    try:
        return await enviar_papeleta(repo, id_)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
