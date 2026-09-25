from fastapi import APIRouter
from sqlalchemy import text

from app.api.v1.deps import SessionDep

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(session: SessionDep):
    postgis_version = (await session.execute(text("SELECT PostGIS_Version()"))).scalar_one()
    return {"estado": "ok", "base_de_datos": "conectada", "postgis": postgis_version}
