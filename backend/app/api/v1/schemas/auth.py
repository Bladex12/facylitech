from datetime import datetime

from pydantic import BaseModel, Field

from app.api.v1.schemas.usuarios import UsuarioOut


class LoginIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=200)


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_at: datetime
    usuario: UsuarioOut


class CambiarPasswordIn(BaseModel):
    # Sin min_length: el contrato exige 400 (no 422) para "nueva < 8", y lo valida el caso de uso.
    password_actual: str = Field(max_length=200)
    password_nueva: str = Field(max_length=200)


class RestablecerPasswordIn(BaseModel):
    password_nueva: str = Field(min_length=8, max_length=200)
