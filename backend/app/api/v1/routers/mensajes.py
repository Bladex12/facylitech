"""Mensajería simple operador <-> técnico. REST + polling desde el front
(sin WebSockets, fuera de alcance)."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Response

from app.api.v1.deps import MensajeRepoDep, OrdenRepoDep, UsuarioRepoDep
from app.api.v1.schemas.mensajes import (
    Contraparte,
    ConversacionOut,
    MarcarLeidos,
    MensajeCrear,
    MensajeOut,
)
from app.application.errors import DatosInvalidosError, NoEncontradoError
from app.application.use_cases.mensajes import (
    enviar_mensaje,
    listar_conversaciones,
    marcar_leidos,
    obtener_hilo,
)

router = APIRouter(prefix="/mensajes", tags=["mensajes"])


@router.get("/conversaciones", response_model=list[ConversacionOut])
async def conversaciones(usuario_id: UUID, repo: MensajeRepoDep, usuario_repo: UsuarioRepoDep):
    try:
        convs = await listar_conversaciones(repo, usuario_repo, usuario_id)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [
        ConversacionOut(
            contraparte=Contraparte.model_validate(c.contraparte),
            ultimo_mensaje=MensajeOut.model_validate(c.ultimo_mensaje) if c.ultimo_mensaje else None,
            no_leidos=c.no_leidos,
        )
        for c in convs
    ]


@router.get("/hilo", response_model=list[MensajeOut])
async def hilo(
    usuario_id: UUID, contraparte_id: UUID, repo: MensajeRepoDep, usuario_repo: UsuarioRepoDep
):
    try:
        return await obtener_hilo(repo, usuario_repo, usuario_id, contraparte_id)
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("", response_model=MensajeOut, status_code=201)
async def enviar(
    datos: MensajeCrear, repo: MensajeRepoDep, usuario_repo: UsuarioRepoDep, orden_repo: OrdenRepoDep
):
    try:
        return await enviar_mensaje(
            repo,
            usuario_repo,
            datos.remitente_id,
            datos.destinatario_id,
            datos.texto,
            datos.orden_trabajo_id,
            orden_repo,
        )
    except NoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DatosInvalidosError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/leer", status_code=204)
async def leer(datos: MarcarLeidos, repo: MensajeRepoDep):
    await marcar_leidos(repo, datos.usuario_id, datos.contraparte_id)
    return Response(status_code=204)
