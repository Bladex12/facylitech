from datetime import UTC, datetime

from fastapi import APIRouter

from app.api.v1.deps import MapaRepoDep
from app.api.v1.schemas.mapa import MapaData
from app.api.v1.serializers import construir_mapa_out
from app.application.use_cases.mapa import obtener_datos_mapa
from app.infrastructure.config import settings

router = APIRouter(prefix="/mapa", tags=["mapa"])


@router.get("", response_model=MapaData)
async def obtener(repo: MapaRepoDep):
    """Edificios (equipos, fallas, órdenes de hoy, emergencia activa), técnicos
    con su última ubicación y orden en curso, y emergencias no cerradas."""
    datos = await obtener_datos_mapa(repo, datetime.now(UTC), settings.timezone)
    return construir_mapa_out(datos)
