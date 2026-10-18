from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.domain.enums import RolUsuario


class UsuarioMensaje(BaseModel):
    id: UUID
    nombre: str

    model_config = {"from_attributes": True}


class MensajeOut(BaseModel):
    id: UUID
    remitente: UsuarioMensaje
    destinatario: UsuarioMensaje
    orden_trabajo_id: UUID | None
    texto: str
    created_at: datetime
    leido_at: datetime | None

    model_config = {"from_attributes": True}


class MensajeCrear(BaseModel):
    remitente_id: UUID
    destinatario_id: UUID
    texto: str
    orden_trabajo_id: UUID | None = None

    @field_validator("texto")
    @classmethod
    def _texto_no_vacio(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("El texto del mensaje no puede estar vacío.")
        return valor


class MarcarLeidos(BaseModel):
    usuario_id: UUID
    contraparte_id: UUID


class Contraparte(BaseModel):
    id: UUID
    nombre: str
    rol: RolUsuario

    model_config = {"from_attributes": True}


class ConversacionOut(BaseModel):
    contraparte: Contraparte
    ultimo_mensaje: MensajeOut | None
    no_leidos: int
