"""Mensajería simple operador <-> técnico (REST + polling, sin WebSockets)."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.application.errors import DatosInvalidosError, NoEncontradoError
from app.application.interfaces.repositories import MensajeRepository, UsuarioRepository
from app.domain.mensajeria import MensajeDatos, resumir_conversaciones, rol_contraparte_por_defecto
from app.infrastructure.db.models import Mensaje, Usuario


@dataclass
class Conversacion:
    contraparte: Usuario
    ultimo_mensaje: Mensaje | None
    no_leidos: int


async def _usuario(usuario_repo: UsuarioRepository, id_: UUID) -> Usuario:
    usuario = await usuario_repo.obtener(id_)
    if usuario is None:
        raise NoEncontradoError(f"Usuario {id_} no encontrado.")
    return usuario


async def listar_conversaciones(
    repo: MensajeRepository, usuario_repo: UsuarioRepository, usuario_id: UUID
) -> list[Conversacion]:
    usuario = await _usuario(usuario_repo, usuario_id)
    mensajes = await repo.de_usuario(usuario_id)
    por_defecto = await usuario_repo.listar_activos(rol_contraparte_por_defecto(usuario.rol))

    resumen = resumir_conversaciones(
        usuario_id,
        [
            MensajeDatos(m.id, m.remitente_id, m.destinatario_id, m.created_at, m.leido_at)
            for m in mensajes
        ],
        [u.id for u in por_defecto],
    )

    mensajes_por_id = {m.id: m for m in mensajes}
    usuarios: dict[UUID, Usuario] = {u.id: u for u in por_defecto}
    for m in mensajes:
        usuarios.setdefault(m.remitente_id, m.remitente)
        usuarios.setdefault(m.destinatario_id, m.destinatario)

    return [
        Conversacion(
            contraparte=usuarios[r.contraparte_id],
            ultimo_mensaje=mensajes_por_id.get(r.ultimo_mensaje_id) if r.ultimo_mensaje_id else None,
            no_leidos=r.no_leidos,
        )
        for r in resumen
    ]


async def obtener_hilo(
    repo: MensajeRepository, usuario_repo: UsuarioRepository, usuario_id: UUID, contraparte_id: UUID
) -> list[Mensaje]:
    await _usuario(usuario_repo, usuario_id)
    await _usuario(usuario_repo, contraparte_id)
    return await repo.hilo(usuario_id, contraparte_id)


async def enviar_mensaje(
    repo: MensajeRepository,
    usuario_repo: UsuarioRepository,
    remitente_id: UUID,
    destinatario_id: UUID,
    texto: str,
    orden_trabajo_id: UUID | None = None,
) -> Mensaje:
    if remitente_id == destinatario_id:
        raise DatosInvalidosError("No se puede enviar un mensaje a uno mismo.")
    texto = texto.strip()
    if not texto:
        raise DatosInvalidosError("El texto del mensaje no puede estar vacío.")
    await _usuario(usuario_repo, remitente_id)
    await _usuario(usuario_repo, destinatario_id)
    # created_at se fija en la aplicación (no con now() de Postgres, que es la
    # hora de inicio de la transacción) para que el orden del hilo sea estable.
    mensaje = Mensaje(
        remitente_id=remitente_id,
        destinatario_id=destinatario_id,
        texto=texto,
        orden_trabajo_id=orden_trabajo_id,
        created_at=datetime.now(UTC),
    )
    return await repo.crear(mensaje)


async def marcar_leidos(
    repo: MensajeRepository, usuario_id: UUID, contraparte_id: UUID
) -> int:
    return await repo.marcar_leidos(usuario_id, contraparte_id, datetime.now(UTC))
