from app.application.interfaces.repositories import OrdenTrabajoRepository


async def ordenes_del_mes(repo: OrdenTrabajoRepository, anio: int, mes: int):
    return await repo.listar_por_mes(anio, mes)
