from fastapi import APIRouter, Query

from app.api.v1.deps import TecnicoRepoDep
from app.api.v1.schemas.tecnicos import CandidatoTecnicoOut
from app.api.v1.serializers import construir_candidato_out
from app.application.use_cases.cascada import tecnicos_cercanos

router = APIRouter(prefix="/tecnicos", tags=["tecnicos"])


@router.get("/cercanos", response_model=list[CandidatoTecnicoOut])
async def cercanos(
    repo: TecnicoRepoDep,
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    limit: int = Query(5, ge=1, le=50),
):
    """Técnicos activos más cercanos al punto (distancia PostGIS + ETA a 25 km/h)."""
    return [construir_candidato_out(c) for c in await tecnicos_cercanos(repo, lat, lon, limit)]
