"""Replicar el cronograma de mantenciones al mes siguiente (botón del mockup).

Regla: cada mantención se corre **4 semanas** (5 si con 4 todavía cae en el
mismo mes), a la misma hora local. Así se conserva el día de la semana y el
intervalo entre visitas queda entre 28 y 35 días. Con el cronograma que entregó
la empresa (mié 07, jue 08, vie 09 de octubre) da mié 04, jue 05, vie 06 de
noviembre, igual que el ciclo siguiente que ellos describieron, y nunca cae en
domingo si el origen no lo era. Todas las fechas de un mes caen en el siguiente.

El mockup copiaba el mismo número de día (07 -> 07), lo que mueve el trabajo a
otro día de la semana y genera "conflictos con domingo"; ver docs/decisiones.md.

Funciones puras: reciben primitivos/enums, nada de ORM ni FastAPI.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID

from app.domain.enums import EstadoOrdenTrabajo, TipoOrdenTrabajo


class MotivoOmision(StrEnum):
    YA_PROGRAMADA = "ya_programada"  # el equipo ya tiene una mantención en el mes de destino
    DUPLICADA_EN_ORIGEN = "duplicada_en_origen"  # 2+ mantenciones del mismo equipo en el origen


@dataclass(frozen=True)
class OrdenOrigen:
    id: UUID
    codigo: str
    ascensor_id: UUID
    tipo: TipoOrdenTrabajo
    estado: EstadoOrdenTrabajo
    fecha_local: datetime  # con tzinfo de la zona de la empresa


@dataclass(frozen=True)
class OrdenPlanificada:
    origen: OrdenOrigen
    fecha_local: datetime


@dataclass(frozen=True)
class OrdenOmitida:
    origen: OrdenOrigen
    motivo: MotivoOmision


@dataclass(frozen=True)
class PlanReplicacion:
    crear: list[OrdenPlanificada]
    omitidas: list[OrdenOmitida]


def mes_siguiente(anio: int, mes: int) -> tuple[int, int]:
    return (anio + 1, 1) if mes == 12 else (anio, mes + 1)


def fecha_equivalente(fecha_local: datetime) -> datetime:
    """La fecha del ciclo siguiente: +4 semanas, o +5 si con 4 sigue en el mismo mes.

    La aritmética sobre un datetime con zona conserva la hora local (08:30 sigue
    siendo 08:30 aunque cambie el horario de verano).
    """
    siguiente = fecha_local + timedelta(weeks=4)
    if (siguiente.year, siguiente.month) == (fecha_local.year, fecha_local.month):
        siguiente = fecha_local + timedelta(weeks=5)
    return siguiente


def planificar_replicacion(
    ordenes_origen: list[OrdenOrigen], ascensores_ya_programados: set[UUID]
) -> PlanReplicacion:
    """Qué mantenciones del mes de origen se crean en el destino y cuáles se omiten.

    Solo se replican mantenciones (no emergencias, reparaciones ni inspecciones,
    que son puntuales) que no estén canceladas; el estado en origen da igual
    (una vencida también debe hacerse el mes siguiente). No se duplica un equipo
    que ya tenga mantención en el destino: así replicar dos veces es inofensivo.
    """
    crear: list[OrdenPlanificada] = []
    omitidas: list[OrdenOmitida] = []
    vistos: set[UUID] = set()
    candidatas = sorted(
        (
            o
            for o in ordenes_origen
            if o.tipo == TipoOrdenTrabajo.MANTENCION and o.estado != EstadoOrdenTrabajo.CANCELADO
        ),
        key=lambda o: (o.fecha_local, o.codigo),
    )
    for o in candidatas:
        if o.ascensor_id in ascensores_ya_programados:
            omitidas.append(OrdenOmitida(o, MotivoOmision.YA_PROGRAMADA))
        elif o.ascensor_id in vistos:
            omitidas.append(OrdenOmitida(o, MotivoOmision.DUPLICADA_EN_ORIGEN))
        else:
            vistos.add(o.ascensor_id)
            crear.append(OrdenPlanificada(o, fecha_equivalente(o.fecha_local)))
    return PlanReplicacion(crear=crear, omitidas=omitidas)
