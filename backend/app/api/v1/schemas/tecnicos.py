from pydantic import BaseModel

from app.api.v1.schemas.usuarios import UsuarioOut


class CandidatoTecnicoOut(BaseModel):
    tecnico: UsuarioOut
    distancia_m: float | None
    # Estimado simple: distancia / 25 km/h (tráfico urbano Santiago).
    eta_min: int | None
    especialidad_match: bool
    disponible: bool
    ordenes_en_curso: int
