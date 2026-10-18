from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.api.v1.deps import AlmacenamientoDep, PapeletaRepoDep
from app.api.v1.schemas.papeletas import (
    ChecklistItemMarcar,
    ChecklistItemOut,
    EvidenciaOut,
    PapeletaActualizar,
    PapeletaOut,
    PiezaCrear,
)
from app.application.errors import (
    AlmacenamientoError,
    ConflictoError,
    NoEncontradoError,
    ValidacionError,
)
from app.application.use_cases.papeletas import (
    actualizar_papeleta,
    agregar_pieza,
    eliminar_evidencia,
    eliminar_pieza,
    enviar_papeleta,
    marcar_item_checklist,
    obtener_papeleta,
    subir_evidencia,
)
from app.domain.evidencias import TAMANO_MAXIMO_BYTES

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


@router.post("/{id_}/evidencias", response_model=EvidenciaOut, status_code=201)
async def subir_foto_evidencia(
    id_: UUID,
    repo: PapeletaRepoDep,
    almacenamiento: AlmacenamientoDep,
    archivo: Annotated[UploadFile, File()],
    tipo: Annotated[str | None, Form()] = None,
):
    """Foto de evidencia (JPEG/PNG/WebP, máx. 8 MB). 409 si la papeleta ya se envió."""
    # Se lee como máximo 1 byte más del límite: basta para detectar el exceso.
    contenido = await archivo.read(TAMANO_MAXIMO_BYTES + 1)
    try:
        return await subir_evidencia(
            repo, almacenamiento, id_, contenido, archivo.content_type, tipo
        )
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictoError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValidacionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AlmacenamientoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.delete("/{id_}/evidencias/{evidencia_id}", response_model=PapeletaOut)
async def borrar_foto_evidencia(
    id_: UUID, evidencia_id: UUID, repo: PapeletaRepoDep, almacenamiento: AlmacenamientoDep
):
    try:
        return await eliminar_evidencia(repo, almacenamiento, id_, evidencia_id)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictoError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AlmacenamientoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
