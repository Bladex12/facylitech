from fastapi import APIRouter

from app.api.v1.routers import (
    administraciones,
    ascensores,
    clientes,
    dashboard,
    edificios,
    emergencias,
    health,
    ordenes_trabajo,
    papeletas,
    pautas,
    usuarios,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(clientes.router)
api_router.include_router(administraciones.router)
api_router.include_router(edificios.router)
api_router.include_router(ascensores.router)
api_router.include_router(usuarios.router)
api_router.include_router(pautas.router)
api_router.include_router(emergencias.router)
api_router.include_router(ordenes_trabajo.router)
api_router.include_router(papeletas.router)
api_router.include_router(dashboard.router)
