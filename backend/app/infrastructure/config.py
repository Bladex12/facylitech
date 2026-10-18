import logging
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

logger = logging.getLogger(__name__)

JWT_SECRET_DESARROLLO = "desarrollo-inseguro-cambiar-en-produccion-0123456789"
JWT_SECRET_LARGO_MINIMO = 32


def resolver_jwt_secret(environment: str, secreto: str) -> str:
    """Secreto efectivo de firma. En `development` se usa uno por defecto (con
    warning) si falta; en cualquier otro entorno es obligatorio y de >= 32
    caracteres, o el backend no arranca (ValueError)."""
    if environment == "development":
        if not secreto:
            logger.warning(
                "JWT_SECRET no definido: se usa un secreto de desarrollo INSEGURO. "
                "Defina JWT_SECRET (>= 32 caracteres) fuera de desarrollo."
            )
            return JWT_SECRET_DESARROLLO
        return secreto
    if len(secreto) < JWT_SECRET_LARGO_MINIMO:
        raise ValueError(
            f"JWT_SECRET es obligatorio con ENVIRONMENT={environment!r} y debe tener al menos "
            f"{JWT_SECRET_LARGO_MINIMO} caracteres."
        )
    return secreto


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://facylitech:facylitech@localhost:5432/facylitech"
    environment: str = "development"
    cors_origins: str = "http://localhost:5173"
    timezone: str = "America/Santiago"

    # Despacho en cascada: minutos que tiene un técnico notificado para
    # aceptar/rechazar antes de que se notifique al siguiente.
    tiempo_respuesta_emergencia_min: int = 5

    # Almacenamiento de fotos de evidencia: "local" (disco, servido en /media)
    # o "supabase" (Supabase Storage vía REST).
    storage_backend: str = "local"
    media_dir: str = str(BACKEND_DIR / "media")
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_bucket: str = "evidencias"

    # Autenticación (docs/contrato-auth.md). El secreto firma los JWT (HS256).
    jwt_secret: str = ""
    jwt_ttl_operador_horas: int = 12
    jwt_ttl_tecnico_horas: int = 24
    # Solo para seed.py: contraseña de los usuarios de demostración.
    seed_password: str = "facylitech2026"

    @model_validator(mode="after")
    def _validar_jwt_secret(self):
        self.jwt_secret = resolver_jwt_secret(self.environment, self.jwt_secret)
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
