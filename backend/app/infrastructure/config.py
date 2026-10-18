from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


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

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
