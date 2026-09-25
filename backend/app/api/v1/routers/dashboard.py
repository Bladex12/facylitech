from collections import defaultdict
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import EmergenciaRepoDep, OrdenRepoDep
from app.api.v1.schemas.dashboard import (
    CalendarioMesOut,
    DiaCalendario,
    EmergenciaBanner,
    OrdenCalendarioItem,
)
from app.application.use_cases.dashboard import ordenes_del_mes
from app.application.use_cases.emergencias import listar_emergencias
from app.domain.enums import EstadoEmergencia
from app.domain.ordenamiento import clave_orden_listado
from app.domain.semaforo import calcular_semaforo

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_TZ = ZoneInfo("America/Santiago")
_ESTADOS_ABIERTOS = (EstadoEmergencia.ACTIVA, EstadoEmergencia.EN_ATENCION)


@router.get("/calendario", response_model=CalendarioMesOut)
async def calendario(
    orden_repo: OrdenRepoDep,
    emergencia_repo: EmergenciaRepoDep,
    mes: str = Query(..., description="Formato YYYY-MM"),
):
    try:
        anio_str, mes_str = mes.split("-")
        anio, mes_num = int(anio_str), int(mes_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail="Parámetro 'mes' inválido, use YYYY-MM."
        ) from exc

    ordenes = await ordenes_del_mes(orden_repo, anio, mes_num)
    ahora = datetime.now(UTC)

    por_dia: dict = defaultdict(list)
    for orden in ordenes:
        semaforo = calcular_semaforo(orden.estado, orden.fecha_programada, ahora)
        fecha_local = orden.fecha_programada.astimezone(_TZ)
        item = OrdenCalendarioItem(
            id=orden.id,
            codigo=orden.codigo,
            hora=fecha_local.strftime("%H:%M"),
            ascensor_codigo=orden.ascensor.codigo,
            edificio_nombre=orden.ascensor.edificio.nombre,
            tipo=orden.tipo,
            prioridad=orden.prioridad,
            estado=orden.estado,
            semaforo=semaforo,
        )
        clave = clave_orden_listado(semaforo, orden.prioridad, orden.fecha_programada)
        por_dia[fecha_local.date()].append((clave, item))

    dias = [
        DiaCalendario(fecha=fecha, ordenes=[item for _, item in sorted(items, key=lambda t: t[0])])
        for fecha, items in sorted(por_dia.items())
    ]

    emergencias_activas, _ = await listar_emergencias(emergencia_repo, limit=100, offset=0, estado=None)
    banners = [
        EmergenciaBanner(
            id=e.id,
            codigo=e.codigo,
            tipo=e.tipo,
            edificio_nombre=e.edificio.nombre,
            descripcion=e.descripcion,
            reportada_at=e.reportada_at,
        )
        for e in emergencias_activas
        if e.estado in _ESTADOS_ABIERTOS
    ]

    return CalendarioMesOut(anio=anio, mes=mes_num, dias=dias, emergencias_abiertas=banners)
