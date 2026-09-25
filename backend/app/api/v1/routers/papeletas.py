from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.v1.deps import PapeletaRepoDep
from app.api.v1.schemas.papeletas import (
    ChecklistItemMarcar,
    ChecklistItemOut,
    PapeletaActualizar,
    PapeletaOut,
    PiezaCrear,
)
from app.application.errors import NoEncontradoError
from app.application.use_cases.papeletas import (
    actualizar_papeleta,
    agregar_pieza,
    eliminar_pieza,
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


@router.post("/{id_}/piezas", response_model=PapeletaOut, status_code=201)
async def crear_pieza(id_: UUID, datos: PiezaCrear, repo: PapeletaRepoDep):
    return await agregar_pieza(repo, id_, datos.nombre, datos.marca, datos.es_original)


@router.delete("/{id_}/piezas/{pieza_id}", response_model=PapeletaOut)
async def borrar_pieza(id_: UUID, pieza_id: UUID, repo: PapeletaRepoDep):
    return await eliminar_pieza(repo, id_, pieza_id)
