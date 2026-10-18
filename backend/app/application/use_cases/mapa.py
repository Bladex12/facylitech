from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.application.interfaces.repositories import MapaRepository


async def obtener_datos_mapa(repo: MapaRepository, ahora: datetime, zona_horaria: str):
    """Edificios (con conteos del día local), técnicos y emergencias no cerradas."""
    tz = ZoneInfo(zona_horaria)
    hoy = ahora.astimezone(tz).date()
    inicio = datetime.combine(hoy, time.min, tzinfo=tz)
    return await repo.datos(inicio, inicio + timedelta(days=1))
