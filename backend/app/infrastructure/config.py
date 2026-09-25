from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://facylitech:facylitech@localhost:5432/facylitech"
    environment: str = "development"
    cors_origins: str = "http://localhost:5173"
    timezone: str = "America/Santiago"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
