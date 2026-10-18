from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.infrastructure.config import settings

app = FastAPI(title="Facylitech API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Fotos de evidencia en almacenamiento local (desarrollo): se sirven en /media/...
# Con STORAGE_BACKEND=supabase las URLs son absolutas y esto no se usa.
if settings.storage_backend == "local":
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
