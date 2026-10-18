from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

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


@app.exception_handler(StarletteHTTPException)
async def _error_http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Errores HTTP con `detalle` (formato del contrato y de `ErrorResponse`) y,
    por compatibilidad, también `detail` (el default de FastAPI). Conserva los
    headers (`WWW-Authenticate` en 401, `Retry-After` en 429)."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detalle": exc.detail, "detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )

# Fotos de evidencia en almacenamiento local (desarrollo): se sirven en /media/...
# Con STORAGE_BACKEND=supabase las URLs son absolutas y esto no se usa.
if settings.storage_backend == "local":
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
