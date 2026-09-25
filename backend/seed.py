"""Seed idempotente de datos de ejemplo para Facylitech (Santiago de Chile).

Uso:
    python seed.py

Idempotente: si un usuario/edificio/ascensor con el mismo identificador natural
(email, código) ya existe, se reutiliza en vez de duplicarse. Las órdenes de
trabajo sí se limpian y recrean cada vez (no tienen identificador natural
estable) para mantener el dataset de demo consistente.
"""

import asyncio
import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import (
    EstadoOrdenTrabajo,
    PrioridadOrdenTrabajo,
    RolUsuario,
    TipoEdificio,
    TipoOrdenTrabajo,
)
from app.infrastructure.db.models import (
    Ascensor,
    Edificio,
    OrdenTrabajo,
    Papeleta,
    PapeletaChecklistItem,
    PautaItem,
    PautaMantencion,
    Usuario,
)
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.geo import punto_desde_coords

_TZ = ZoneInfo("America/Santiago")

_EDIFICIOS = [
    dict(
        nombre="Torre Costanera Providencia",
        direccion="Av. Providencia 1650",
        comuna="Providencia",
        tipo=TipoEdificio.OFICINA,
        lat=-33.4263,
        lon=-70.6112,
        contacto_nombre="Carla Muñoz",
        contacto_email="carla.munoz@edificio-providencia.cl",
        contacto_telefono="+56911111111",
        manas="El ascensor 2 demora en cerrar puertas en horario punta.",
        instrucciones_reinicio="Tablero eléctrico piso -1, girar llave roja y esperar 10s.",
    ),
    dict(
        nombre="Edificio Apoquindo Las Condes",
        direccion="Av. Apoquindo 4501",
        comuna="Las Condes",
        tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.4103,
        lon=-70.5677,
        contacto_nombre="Roberto Silva",
        contacto_email="conserjeria@apoquindo4501.cl",
        contacto_telefono="+56922222222",
        manas="Sensor de puerta del ascensor A se ensucia rápido, limpiar cada visita.",
        instrucciones_reinicio="Presionar botón de emergencia 3 segundos en sala de máquinas.",
    ),
    dict(
        nombre="Clínica Santiago Centro",
        direccion="Alameda 1234",
        comuna="Santiago",
        tipo=TipoEdificio.HOSPITAL,
        lat=-33.4489,
        lon=-70.6693,
        contacto_nombre="Dra. Ximena Rojas",
        contacto_email="mantencion@clinicasantiago.cl",
        contacto_telefono="+56933333333",
        manas="Uso crítico 24/7, coordinar detenciones con enfermería antes de intervenir.",
        instrucciones_reinicio="Reset solo con autorización de jefe de turno; panel B subterráneo.",
    ),
    dict(
        nombre="Edificio Irarrázaval Ñuñoa",
        direccion="Av. Irarrázaval 3200",
        comuna="Ñuñoa",
        tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.4569,
        lon=-70.5975,
        contacto_nombre="Pedro Fuentes",
        contacto_email="administracion@irarrazaval3200.cl",
        contacto_telefono="+56944444444",
        manas="Ascensor único del edificio; avisar a todos los residentes antes de detenerlo.",
        instrucciones_reinicio="Interruptor general en conserjería, etiquetado 'ASCENSOR'.",
    ),
    dict(
        nombre="Hotel Plaza Santiago Centro",
        direccion="Huérfanos 1189",
        comuna="Santiago",
        tipo=TipoEdificio.HOTEL,
        lat=-33.4382,
        lon=-70.6519,
        contacto_nombre="Loreto Vidal",
        contacto_email="mantencion@hotelplazasantiago.cl",
        contacto_telefono="+56955555555",
        manas="Evitar mantenciones entre 12:00 y 15:00 (check-out/check-in).",
        instrucciones_reinicio="Solicitar llave maestra en recepción para sala de máquinas.",
    ),
    dict(
        nombre="Parque Industrial Alfa",
        direccion="Camino a Lonquén 8900",
        comuna="Maipú",
        tipo=TipoEdificio.INDUSTRIAL,
        lat=-33.5089,
        lon=-70.7614,
        contacto_nombre="Ignacio Bravo",
        contacto_email="ibravo@parquealfa.cl",
        contacto_telefono="+56966666666",
        manas="Ascensor de carga; verificar peso máximo antes de pruebas.",
        instrucciones_reinicio="Panel industrial, requiere dos personas (protocolo LOTO).",
    ),
]

_TECNICOS = [
    "Martín Olivares",
    "Agustín Reyes",
    "Maria Poddubnaya",
    "Felipe Gutiérrez",
]

_PAUTAS = [
    dict(
        nombre="Mantención preventiva estándar",
        descripcion="Chequeo mensual básico de ascensores.",
        items=[
            "Inspeccionar motor operador de puerta",
            "Ajustar tiempos de puerta",
            "Probar todos los botones",
            "Revisión sensores y pastillas de freno",
            "Lubricar rieles de cabina",
        ],
    ),
    dict(
        nombre="Revisión de emergencia",
        descripcion="Checklist rápido ante falla reportada.",
        items=[
            "Verificar alimentación eléctrica",
            "Probar botón de emergencia y comunicación",
            "Revisar sensores y pastillas de freno",
        ],
    ),
]


async def _get_or_create_edificio(session: AsyncSession, datos: dict) -> Edificio:
    existente = (
        await session.execute(select(Edificio).where(Edificio.nombre == datos["nombre"]))
    ).scalar_one_or_none()
    if existente:
        return existente
    edificio = Edificio(
        nombre=datos["nombre"],
        direccion=datos["direccion"],
        comuna=datos["comuna"],
        tipo=datos["tipo"],
        ubicacion=punto_desde_coords(datos["lat"], datos["lon"]),
        contacto_nombre=datos["contacto_nombre"],
        contacto_email=datos["contacto_email"],
        contacto_telefono=datos["contacto_telefono"],
        manas=datos["manas"],
        instrucciones_reinicio=datos["instrucciones_reinicio"],
    )
    session.add(edificio)
    await session.flush()
    return edificio


async def _get_or_create_ascensor(
    session: AsyncSession, edificio: Edificio, codigo: str, torre: str, numero: str
) -> Ascensor:
    existente = (
        await session.execute(select(Ascensor).where(Ascensor.codigo == codigo))
    ).scalar_one_or_none()
    if existente:
        return existente
    ascensor = Ascensor(
        edificio_id=edificio.id, codigo=codigo, torre=torre, numero=numero
    )
    session.add(ascensor)
    await session.flush()
    return ascensor


async def _get_or_create_usuario(
    session: AsyncSession, nombre: str, email: str, rol: RolUsuario
) -> Usuario:
    existente = (
        await session.execute(select(Usuario).where(Usuario.email == email))
    ).scalar_one_or_none()
    if existente:
        return existente
    usuario = Usuario(nombre=nombre, email=email, rol=rol, activo=True)
    session.add(usuario)
    await session.flush()
    return usuario


async def _get_or_create_pauta(session: AsyncSession, datos: dict) -> PautaMantencion:
    existente = (
        await session.execute(
            select(PautaMantencion).where(PautaMantencion.nombre == datos["nombre"])
        )
    ).scalar_one_or_none()
    if existente:
        return existente
    pauta = PautaMantencion(
        nombre=datos["nombre"],
        descripcion=datos["descripcion"],
        items=[
            PautaItem(orden=i, descripcion=desc) for i, desc in enumerate(datos["items"], start=1)
        ],
    )
    session.add(pauta)
    await session.flush()
    return pauta


async def _limpiar_ordenes(session: AsyncSession) -> None:
    await session.execute(delete(PapeletaChecklistItem))
    await session.execute(delete(Papeleta))
    await session.execute(delete(OrdenTrabajo))
    await session.flush()


async def seed() -> None:
    async with SessionLocal() as session:
        edificios = [await _get_or_create_edificio(session, d) for d in _EDIFICIOS]

        ascensores: list[Ascensor] = []
        for i, edificio in enumerate(edificios, start=1):
            for letra in ("A", "B"):
                codigo = f"ELV-{i:02d}{letra}"
                ascensores.append(
                    await _get_or_create_ascensor(session, edificio, codigo, letra, "1")
                )

        operador = await _get_or_create_usuario(
            session, "Leonardo Causa", "operador@facylitech.cl", RolUsuario.OPERADOR
        )
        tecnicos = [
            await _get_or_create_usuario(
                session, nombre, f"{nombre.split()[0].lower()}@facylitech.cl", RolUsuario.TECNICO
            )
            for nombre in _TECNICOS
        ]

        pautas = [await _get_or_create_pauta(session, d) for d in _PAUTAS]
        await session.commit()

        await _limpiar_ordenes(session)

        ahora = datetime.now(_TZ)
        rng = random.Random(42)
        tipos_normales = [TipoOrdenTrabajo.MANTENCION, TipoOrdenTrabajo.REPARACION]
        prioridades_normales = [
            PrioridadOrdenTrabajo.BAJA,
            PrioridadOrdenTrabajo.MEDIA,
            PrioridadOrdenTrabajo.ALTA,
        ]

        ordenes: list[OrdenTrabajo] = []
        for i in range(18):
            dias_offset = rng.randint(-10, 20)  # mezcla septiembre y octubre 2026
            hora = rng.choice([9, 10, 11, 14, 15, 16])
            fecha = (ahora + timedelta(days=dias_offset)).replace(
                hour=hora, minute=0, second=0, microsecond=0
            )
            ascensor = rng.choice(ascensores)
            tecnico = rng.choice(tecnicos)
            pauta = rng.choice(pautas)
            tipo = rng.choice(tipos_normales)
            prioridad = rng.choice(prioridades_normales)

            if dias_offset < -1:
                estado = EstadoOrdenTrabajo.PROGRAMADO  # queda vencida (semáforo calculado)
            elif -1 <= dias_offset <= 0:
                estado = rng.choice([EstadoOrdenTrabajo.EN_CURSO, EstadoOrdenTrabajo.COMPLETADO])
            else:
                estado = EstadoOrdenTrabajo.PROGRAMADO

            ordenes.append(
                OrdenTrabajo(
                    codigo=f"WO-{2850 + i}",
                    tipo=tipo,
                    prioridad=prioridad,
                    estado=estado,
                    ascensor_id=ascensor.id,
                    tecnico_id=tecnico.id,
                    pauta_id=pauta.id,
                    fecha_programada=fecha,
                    descripcion=f"{tipo.value.capitalize()} programada — {ascensor.codigo}",
                )
            )

        # 2 emergencias críticas abiertas
        for i, ascensor in enumerate(rng.sample(ascensores, 2)):
            fecha = ahora - timedelta(hours=rng.randint(1, 12))
            ordenes.append(
                OrdenTrabajo(
                    codigo=f"WO-{2850 + 18 + i}",
                    tipo=TipoOrdenTrabajo.EMERGENCIA,
                    prioridad=PrioridadOrdenTrabajo.CRITICA,
                    estado=EstadoOrdenTrabajo.PROGRAMADO,
                    ascensor_id=ascensor.id,
                    tecnico_id=rng.choice(tecnicos).id,
                    pauta_id=None,
                    fecha_programada=fecha,
                    descripcion="Falla mecánica — atrapamiento reportado",
                )
            )

        session.add_all(ordenes)
        await session.commit()

        print(f"Seed OK: {len(edificios)} edificios, {len(ascensores)} ascensores, "
              f"{1 + len(tecnicos)} usuarios, {len(pautas)} pautas, {len(ordenes)} órdenes.")
        print(f"Operador demo: {operador.email}")


if __name__ == "__main__":
    asyncio.run(seed())
