"""Seed idempotente para Facylitech, con los datos del mockup validado con
el cliente (ver docs/mockup/) — no se inventan nombres de edificios,
ascensores ni técnicos, como pide la Tarea 5 del prompt.

Uso:
    python seed.py

Idempotente para el catálogo (cliente/administración/edificio/ascensor/
usuario/pauta/emergencia: get-or-create por su identificador natural). Las
órdenes de trabajo se limpian y recrean en cada corrida para mantener el
calendario de demo consistente con "hoy".
"""

import asyncio
import random
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import (
    Especialidad,
    EstadoAscensor,
    EstadoDisponibilidadTecnico,
    EstadoEmergencia,
    PrioridadOrdenTrabajo,
    RolUsuario,
    TipoCliente,
    TipoEdificio,
    TipoEquipo,
    TipoOrdenTrabajo,
)
from app.infrastructure.db.models import (
    Administracion,
    Ascensor,
    Cliente,
    Edificio,
    Emergencia,
    OrdenTrabajo,
    Papeleta,
    PapeletaItem,
    PautaItem,
    PautaMantencion,
    PiezaReemplazada,
    Usuario,
)
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.geo import punto_desde_coords

_TZ = ZoneInfo("America/Santiago")

# ─── Clientes / administraciones (no están en el mockup: se completan para
# la jerarquía de 4 niveles que pide el prompt v2) ──────────────────────────

_CLIENTES = {
    "C01": dict(nombre="Inmobiliaria Andes SpA", tipo=TipoCliente.FONDO_INVERSION),
    "C02": dict(nombre="Comunidad Providencia-Vitacura", tipo=TipoCliente.COMUNIDAD),
    "C03": dict(nombre="Hotelera Central Ltda.", tipo=TipoCliente.OTRO),
}

_ADMINISTRACIONES = {
    "C01": dict(
        nombre="Administración Andes",
        contacto_nombre="Elaine Cho",
        contacto_email="elaine.cho@northgate.cl",
        contacto_telefono="+56 9 5511 3001",
        contacto_alternativo="Comité de edificio (suplente): Roberto Arias, +56 9 5511 3002",
    ),
    "C02": dict(
        nombre="Administración Providencia-Vitacura",
        contacto_nombre="Patricia Rojas",
        contacto_email="admin@archway.cl",
        contacto_telefono="+56 9 5511 3003",
        contacto_alternativo="Conserjería 24h: +56 9 5511 3004",
    ),
    "C03": dict(
        nombre="Administración Hotelera Central",
        contacto_nombre="Carlos Muñoz",
        contacto_email="cmunoz@grandhotel.cl",
        contacto_telefono="+56 9 5511 3005",
        contacto_alternativo="Jefe de turno: +56 9 5511 3006",
    ),
}

# ─── Edificios (del mockup: BUILDINGS) ──────────────────────────────────────

_EDIFICIOS = [
    dict(
        codigo="B01",
        cliente="C01",
        nombre="Northgate Tower",
        direccion="Av. Providencia 1240",
        comuna="Providencia",
        tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.4263,
        lon=-70.6112,
        manas="Avisar siempre al conserje antes de detener cualquier ascensor.",
        instrucciones_reinicio="Tablero eléctrico piso -1, girar llave roja y esperar 10s.",
        vencimiento_certificacion=date(2027, 3, 15),
    ),
    dict(
        codigo="B02",
        cliente="C02",
        nombre="Lakeside Medical Center",
        direccion="Av. Salvador 1800",
        comuna="Providencia",
        tipo=TipoEdificio.HOSPITAL,
        lat=-33.4306,
        lon=-70.6089,
        manas="Uso crítico 24/7: coordinar cualquier detención con enfermería antes de intervenir.",
        instrucciones_reinicio="Reset solo con autorización del jefe de turno; panel B subterráneo.",
        vencimiento_certificacion=date(2026, 11, 30),
    ),
    dict(
        codigo="B03",
        cliente="C01",
        nombre="Meridian Business Park",
        direccion="Av. Apoquindo 3500",
        comuna="Las Condes",
        tipo=TipoEdificio.OFICINA,
        lat=-33.4103,
        lon=-70.5677,
        manas=None,
        instrucciones_reinicio=None,
        vencimiento_certificacion=date(2027, 6, 1),
    ),
    dict(
        codigo="B04",
        cliente="C03",
        nombre="Grand Hotel Central",
        direccion="Av. Libertador 900",
        comuna="Santiago",
        tipo=TipoEdificio.HOTEL,
        lat=-33.4382,
        lon=-70.6519,
        manas="Evitar mantenciones entre 12:00 y 15:00 (check-out/check-in).",
        instrucciones_reinicio="Solicitar llave maestra en recepción para sala de máquinas.",
        vencimiento_certificacion=date(2026, 10, 20),
    ),
    dict(
        codigo="B05",
        cliente="C02",
        nombre="Archway Residences",
        direccion="Av. Vitacura 475",
        comuna="Vitacura",
        tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.3958,
        lon=-70.5847,
        manas=None,
        instrucciones_reinicio=None,
        vencimiento_certificacion=date(2027, 1, 10),
    ),
    dict(
        codigo="B06",
        cliente="C01",
        nombre="Industrial Park Alfa",
        direccion="Av. Vicuña Mackenna 7800",
        comuna="La Florida",
        tipo=TipoEdificio.INDUSTRIAL,
        lat=-33.5089,
        lon=-70.7614,
        manas="Ascensor de carga; verificar peso máximo antes de pruebas. Protocolo LOTO obligatorio.",
        instrucciones_reinicio="Panel industrial, requiere dos personas.",
        vencimiento_certificacion=date(2026, 9, 30),
    ),
]

# ─── Ascensores (del mockup: Building.elevators) ────────────────────────────

_ASCENSORES = [
    dict(edificio="B01", codigo="ELV-01A", marca="Schindler", modelo="3300", anio=2015, pisos=18,
         tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.OPERACIONAL, tasa_fallo=4.2,
         ultima_mantencion=date(2026, 6, 25)),
    dict(edificio="B01", codigo="ELV-01B", marca="Schindler", modelo="3300", anio=2015, pisos=18,
         tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.ADVERTENCIA, tasa_fallo=11.8,
         ultima_mantencion=date(2026, 5, 14)),
    dict(edificio="B02", codigo="ELV-02A", marca="Otis", modelo="Gen2", anio=2019, pisos=12,
         tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.OPERACIONAL, tasa_fallo=1.9,
         ultima_mantencion=date(2026, 6, 20)),
    dict(edificio="B02", codigo="ELV-02B", marca="Otis", modelo="Gen2", anio=2019, pisos=12,
         tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.OPERACIONAL, tasa_fallo=2.3,
         ultima_mantencion=date(2026, 6, 20)),
    dict(edificio="B02", codigo="ELV-02C", marca="Otis", modelo="Gen2", anio=2020, pisos=12,
         tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.CRITICO, tasa_fallo=22.1,
         ultima_mantencion=date(2026, 6, 1)),
    dict(edificio="B03", codigo="ELV-03A", marca="KONE", modelo="MonoSpace", anio=2018, pisos=22,
         tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.OPERACIONAL, tasa_fallo=3.1,
         ultima_mantencion=date(2026, 6, 15)),
    dict(edificio="B03", codigo="ELV-03B", marca="KONE", modelo="MonoSpace", anio=2018, pisos=22,
         tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.OPERACIONAL, tasa_fallo=5.4,
         ultima_mantencion=date(2026, 6, 15)),
    dict(edificio="B04", codigo="ELV-04A", marca="ThyssenKrupp", modelo="Evolution 200", anio=2021,
         pisos=30, tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.OPERACIONAL,
         tasa_fallo=2.7, ultima_mantencion=date(2026, 6, 28)),
    dict(edificio="B04", codigo="ELV-04B", marca="ThyssenKrupp", modelo="Evolution 200", anio=2021,
         pisos=30, tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.ADVERTENCIA,
         tasa_fallo=8.3, ultima_mantencion=date(2026, 6, 10)),
    dict(edificio="B04", codigo="ELV-04C", marca="ThyssenKrupp", modelo="Evolution 200", anio=2012,
         pisos=30, tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.ADVERTENCIA,
         tasa_fallo=14.6, ultima_mantencion=date(2026, 5, 22)),
    dict(edificio="B05", codigo="ELV-05A", marca="Mitsubishi", modelo="Elan", anio=2016, pisos=14,
         tipo_equipo=TipoEquipo.ELECTROMECANICO, estado=EstadoAscensor.OPERACIONAL, tasa_fallo=6.0,
         ultima_mantencion=date(2026, 6, 18)),
    dict(edificio="B06", codigo="ELV-06A", marca="Fujitec", modelo="GETII", anio=2011, pisos=6,
         tipo_equipo=TipoEquipo.HIDRAULICO, estado=EstadoAscensor.CRITICO, tasa_fallo=28.4,
         ultima_mantencion=date(2026, 6, 22)),
]

# ─── Técnicos + operador (del mockup: TECHNICIANS) ──────────────────────────

_TECNICOS = [
    dict(codigo="T01", nombre="Marcus Delgado", email="marcus@facylitech.cl",
         telefono="+56 9 5511 4201", zona="Zona Norte",
         especialidades=[Especialidad.PERSONA_ATRAPADA, Especialidad.MECANICA],
         estado_disponibilidad=EstadoDisponibilidadTecnico.EN_TERRENO),
    dict(codigo="T02", nombre="Priya Nair", email="priya@facylitech.cl",
         telefono="+56 9 5511 4202", zona="Zona Central",
         especialidades=[Especialidad.CORTE_ENERGIA, Especialidad.MECANICA],
         estado_disponibilidad=EstadoDisponibilidadTecnico.DISPONIBLE),
    dict(codigo="T03", nombre="James Kowalski", email="james@facylitech.cl",
         telefono="+56 9 5511 4203", zona="Zona Este",
         especialidades=[Especialidad.INCENDIO, Especialidad.PERSONA_ATRAPADA],
         estado_disponibilidad=EstadoDisponibilidadTecnico.EN_TERRENO),
    dict(codigo="T04", nombre="Sonia Ferreira", email="sonia@facylitech.cl",
         telefono="+56 9 5511 4204", zona="Zona Sur",
         especialidades=[Especialidad.MECANICA, Especialidad.INUNDACION],
         estado_disponibilidad=EstadoDisponibilidadTecnico.DISPONIBLE),
    dict(codigo="T05", nombre="Omar Benali", email="omar@facylitech.cl",
         telefono="+56 9 5511 4205", zona="Zona Oeste",
         especialidades=[Especialidad.CORTE_ENERGIA, Especialidad.INCENDIO],
         estado_disponibilidad=EstadoDisponibilidadTecnico.DISPONIBLE),
]

_OPERADOR = dict(nombre="Alex Moreau", email="operador@facylitech.cl", telefono="+56 9 5511 4000")

# ─── Pautas de mantención (tipo_equipo + matriz de frecuencia `meses`) ──────

_PAUTAS = [
    dict(
        nombre="Mantención preventiva electromecánica",
        tipo_equipo=TipoEquipo.ELECTROMECANICO,
        descripcion="Checklist estándar para ascensores de tracción.",
        items=[
            dict(descripcion="Inspeccionar motor operador de puerta", meses=list(range(1, 13))),
            dict(descripcion="Ajustar tiempos de puerta", meses=[1, 4, 7, 10]),
            dict(descripcion="Probar todos los botones", meses=list(range(1, 13))),
            dict(descripcion="Revisión sensores y pastillas de freno", meses=[1, 3, 5, 7, 9, 11]),
            dict(descripcion="Lubricar rieles de cabina", meses=[2, 5, 8, 11]),
        ],
    ),
    dict(
        nombre="Mantención preventiva hidráulica",
        tipo_equipo=TipoEquipo.HIDRAULICO,
        descripcion="Checklist estándar para ascensores hidráulicos.",
        items=[
            dict(descripcion="Verificar nivel de aceite hidráulico", meses=list(range(1, 13))),
            dict(descripcion="Revisar válvulas de control", meses=[1, 4, 7, 10]),
            dict(descripcion="Inspeccionar pistón y sellos", meses=[3, 9]),
        ],
    ),
]

# ─── Emergencias (del mockup: EMERGENCIES) ──────────────────────────────────

_EMERGENCIAS = [
    dict(
        codigo="EM-001",
        tipo=Especialidad.PERSONA_ATRAPADA,
        edificio="B04",
        ascensor="ELV-04B",
        descripcion="2 huéspedes atrapados entre pisos 14-15. La puerta del ascensor no responde.",
        solicitante="Recepción Grand Hotel Central",
        estado=EstadoEmergencia.EN_ATENCION,
        horas_atras=3,
    ),
    dict(
        codigo="EM-002",
        tipo=Especialidad.MECANICA,
        edificio="B06",
        ascensor="ELV-06A",
        descripcion="Ascensor no se mueve. Panel de control muestra error E-42 (falla de freno).",
        solicitante="Jefe de planta Industrial Park Alfa",
        estado=EstadoEmergencia.ACTIVA,
        horas_atras=6,
    ),
]


async def _get_or_create_cliente(session: AsyncSession, codigo: str) -> Cliente:
    datos = _CLIENTES[codigo]
    existente = (
        await session.execute(select(Cliente).where(Cliente.nombre == datos["nombre"]))
    ).scalar_one_or_none()
    if existente:
        return existente
    cliente = Cliente(**datos)
    session.add(cliente)
    await session.flush()
    return cliente


async def _get_or_create_administracion(
    session: AsyncSession, codigo_cliente: str, cliente: Cliente
) -> Administracion:
    datos = _ADMINISTRACIONES[codigo_cliente]
    existente = (
        await session.execute(select(Administracion).where(Administracion.nombre == datos["nombre"]))
    ).scalar_one_or_none()
    if existente:
        return existente
    administracion = Administracion(cliente_id=cliente.id, **datos)
    session.add(administracion)
    await session.flush()
    return administracion


async def _get_or_create_edificio(
    session: AsyncSession, datos: dict, administracion: Administracion
) -> Edificio:
    existente = (
        await session.execute(select(Edificio).where(Edificio.nombre == datos["nombre"]))
    ).scalar_one_or_none()
    if existente:
        return existente
    edificio = Edificio(
        administracion_id=administracion.id,
        nombre=datos["nombre"],
        direccion=datos["direccion"],
        comuna=datos["comuna"],
        tipo=datos["tipo"],
        ubicacion=punto_desde_coords(datos["lat"], datos["lon"]),
        manas=datos["manas"],
        instrucciones_reinicio=datos["instrucciones_reinicio"],
        vencimiento_certificacion=datos["vencimiento_certificacion"],
    )
    session.add(edificio)
    await session.flush()
    return edificio


async def _get_or_create_ascensor(session: AsyncSession, datos: dict, edificio: Edificio) -> Ascensor:
    existente = (
        await session.execute(select(Ascensor).where(Ascensor.codigo == datos["codigo"]))
    ).scalar_one_or_none()
    if existente:
        return existente
    codigo_qr = f"FCY-{datos['edificio']}-{datos['codigo'].removeprefix('ELV-')}"
    ascensor = Ascensor(
        edificio_id=edificio.id,
        codigo=datos["codigo"],
        codigo_qr=codigo_qr,
        marca=datos["marca"],
        modelo=datos["modelo"],
        anio_instalacion=datos["anio"],
        pisos=datos["pisos"],
        tipo_equipo=datos["tipo_equipo"],
        estado=datos["estado"],
        tasa_fallo=datos["tasa_fallo"],
        ultima_mantencion=datos["ultima_mantencion"],
    )
    session.add(ascensor)
    await session.flush()
    return ascensor


async def _get_or_create_usuario(session: AsyncSession, email: str, **campos) -> Usuario:
    existente = (
        await session.execute(select(Usuario).where(Usuario.email == email))
    ).scalar_one_or_none()
    if existente:
        return existente
    usuario = Usuario(email=email, activo=True, **campos)
    session.add(usuario)
    await session.flush()
    return usuario


async def _get_or_create_pauta(session: AsyncSession, datos: dict) -> PautaMantencion:
    existente = (
        await session.execute(select(PautaMantencion).where(PautaMantencion.nombre == datos["nombre"]))
    ).scalar_one_or_none()
    if existente:
        return existente
    pauta = PautaMantencion(
        nombre=datos["nombre"],
        tipo_equipo=datos["tipo_equipo"],
        descripcion=datos["descripcion"],
        items=[
            PautaItem(orden=i, descripcion=it["descripcion"], meses=it["meses"], activo=True)
            for i, it in enumerate(datos["items"], start=1)
        ],
    )
    session.add(pauta)
    await session.flush()
    return pauta


async def _get_or_create_emergencia(
    session: AsyncSession, datos: dict, edificios: dict, ascensores: dict, ahora: datetime
) -> Emergencia:
    existente = (
        await session.execute(select(Emergencia).where(Emergencia.codigo == datos["codigo"]))
    ).scalar_one_or_none()
    if existente:
        existente.estado = datos["estado"]
        await session.flush()
        return existente
    emergencia = Emergencia(
        codigo=datos["codigo"],
        tipo=datos["tipo"],
        edificio_id=edificios[datos["edificio"]].id,
        ascensor_id=ascensores[datos["ascensor"]].id,
        reportada_at=ahora - timedelta(hours=datos["horas_atras"]),
        descripcion=datos["descripcion"],
        solicitante=datos["solicitante"],
        estado=datos["estado"],
    )
    session.add(emergencia)
    await session.flush()
    return emergencia


async def _limpiar_ordenes(session: AsyncSession) -> None:
    await session.execute(delete(PiezaReemplazada))
    await session.execute(delete(PapeletaItem))
    await session.execute(delete(Papeleta))
    await session.execute(delete(OrdenTrabajo))
    await session.flush()


# WO base extraídas del mockup (INITIAL_JOBS): (codigo, ascensor, tipo, tecnico, prioridad, dias_offset)
_ORDENES_MOCKUP = [
    ("WO-2845", "ELV-02A", TipoOrdenTrabajo.MANTENCION, "T02", PrioridadOrdenTrabajo.MEDIA, -6, "completado"),
    ("WO-2846", "ELV-03A", TipoOrdenTrabajo.INSPECCION, "T03", PrioridadOrdenTrabajo.ALTA, -4, "vencido"),
    ("WO-2847", "ELV-01A", TipoOrdenTrabajo.MANTENCION, "T01", PrioridadOrdenTrabajo.MEDIA, 3, "programado"),
    ("WO-2848", "ELV-02C", TipoOrdenTrabajo.REPARACION, "T02", PrioridadOrdenTrabajo.CRITICA, 0, "en_curso"),
    ("WO-2849", "ELV-05A", TipoOrdenTrabajo.MANTENCION, "T04", PrioridadOrdenTrabajo.BAJA, 5, "programado"),
    ("WO-2850", "ELV-04A", TipoOrdenTrabajo.MANTENCION, "T01", PrioridadOrdenTrabajo.MEDIA, 8, "programado"),
    ("WO-2851", "ELV-06A", TipoOrdenTrabajo.REPARACION, "T03", PrioridadOrdenTrabajo.ALTA, 4, "programado"),
    ("WO-2852", "ELV-01B", TipoOrdenTrabajo.MANTENCION, "T05", PrioridadOrdenTrabajo.MEDIA, 10, "programado"),
]

_NOTAS = {
    "WO-2845": "Todo normal, sin observaciones.",
    "WO-2846": "Certificación anual vencida — auditoría pendiente.",
    "WO-2847": "Chequeo de sensores de puerta y pastillas de freno.",
    "WO-2848": "Seguimiento al reemplazo del gobernador de sobrevelocidad.",
    "WO-2849": "Lubricación de rutina.",
    "WO-2850": "Inquilino reportó puerta lenta en piso 12.",
    "WO-2851": "Evaluación de modernización — sistema hidráulico crítico.",
    "WO-2852": "Seguimiento de fuga de aceite detectada el mes pasado.",
}


async def seed() -> None:
    async with SessionLocal() as session:
        clientes = {cod: await _get_or_create_cliente(session, cod) for cod in _CLIENTES}
        administraciones = {
            cod: await _get_or_create_administracion(session, cod, clientes[cod]) for cod in _CLIENTES
        }
        edificios = {
            d["codigo"]: await _get_or_create_edificio(session, d, administraciones[d["cliente"]])
            for d in _EDIFICIOS
        }
        ascensores = {
            d["codigo"]: await _get_or_create_ascensor(session, d, edificios[d["edificio"]])
            for d in _ASCENSORES
        }
        tecnicos = {
            t["codigo"]: await _get_or_create_usuario(
                session,
                t["email"],
                nombre=t["nombre"],
                rol=RolUsuario.TECNICO,
                telefono=t["telefono"],
                zona=t["zona"],
                especialidades=[e.value for e in t["especialidades"]],
                estado_disponibilidad=t["estado_disponibilidad"],
            )
            for t in _TECNICOS
        }
        operador = await _get_or_create_usuario(
            session, _OPERADOR["email"], nombre=_OPERADOR["nombre"], rol=RolUsuario.OPERADOR,
            telefono=_OPERADOR["telefono"],
        )
        pautas = {p["tipo_equipo"]: await _get_or_create_pauta(session, p) for p in _PAUTAS}
        await session.commit()

        ahora = datetime.now(_TZ)
        emergencias = {
            e["codigo"]: await _get_or_create_emergencia(session, e, edificios, ascensores, ahora)
            for e in _EMERGENCIAS
        }
        await session.commit()

        await _limpiar_ordenes(session)

        ordenes: list[OrdenTrabajo] = []
        for codigo, cod_ascensor, tipo, cod_tecnico, prioridad, dias_offset, _hint in _ORDENES_MOCKUP:
            ascensor = ascensores[cod_ascensor]
            hora = 9 if dias_offset <= 0 else random.Random(codigo).choice([9, 10, 11, 14, 15, 16])
            fecha = (ahora + timedelta(days=dias_offset)).replace(
                hour=hora, minute=0, second=0, microsecond=0
            )
            pauta = pautas[ascensor.tipo_equipo]
            ordenes.append(
                OrdenTrabajo(
                    codigo=codigo,
                    tipo=tipo,
                    prioridad=prioridad,
                    estado="en_curso" if _hint == "en_curso" else (
                        "completado" if _hint == "completado" else "programado"
                    ),
                    ascensor_id=ascensor.id,
                    tecnico_id=tecnicos[cod_tecnico].id,
                    pauta_id=pauta.id,
                    fecha_programada=fecha,
                    descripcion=_NOTAS[codigo],
                    inicio_real=fecha if _hint in ("en_curso", "completado") else None,
                    fin_real=fecha + timedelta(hours=2) if _hint == "completado" else None,
                )
            )

        # Volumen adicional (~10 órdenes) repartidas en septiembre/octubre 2026
        rng = random.Random(42)
        tipos_normales = [TipoOrdenTrabajo.MANTENCION, TipoOrdenTrabajo.REPARACION, TipoOrdenTrabajo.INSPECCION]
        prioridades_normales = [
            PrioridadOrdenTrabajo.BAJA, PrioridadOrdenTrabajo.MEDIA, PrioridadOrdenTrabajo.ALTA,
        ]
        ascensores_lista = list(ascensores.values())
        tecnicos_lista = list(tecnicos.values())
        usados = {o.codigo for o in ordenes}
        siguiente = 2853
        for _ in range(10):
            while f"WO-{siguiente}" in usados:
                siguiente += 1
            codigo = f"WO-{siguiente}"
            usados.add(codigo)
            siguiente += 1

            dias_offset = rng.randint(-10, 20)
            hora = rng.choice([8, 9, 10, 11, 14, 15, 16, 17])
            fecha = (ahora + timedelta(days=dias_offset)).replace(
                hour=hora, minute=0, second=0, microsecond=0
            )
            ascensor = rng.choice(ascensores_lista)
            tecnico = rng.choice(tecnicos_lista)
            pauta = pautas[ascensor.tipo_equipo]
            tipo = rng.choice(tipos_normales)
            prioridad = rng.choice(prioridades_normales)
            estado = "en_curso" if -1 <= dias_offset <= 0 and rng.random() < 0.5 else "programado"

            ordenes.append(
                OrdenTrabajo(
                    codigo=codigo,
                    tipo=tipo,
                    prioridad=prioridad,
                    estado=estado,
                    ascensor_id=ascensor.id,
                    tecnico_id=tecnico.id,
                    pauta_id=pauta.id,
                    fecha_programada=fecha,
                    descripcion=f"{tipo.value.capitalize()} programada — {ascensor.codigo}",
                    inicio_real=fecha if estado == "en_curso" else None,
                )
            )

        # 2 órdenes de emergencia ligadas a EM-001 / EM-002
        ordenes.append(
            OrdenTrabajo(
                codigo="WO-2900",
                tipo=TipoOrdenTrabajo.EMERGENCIA,
                prioridad=PrioridadOrdenTrabajo.CRITICA,
                estado="en_curso",
                ascensor_id=ascensores["ELV-04B"].id,
                tecnico_id=tecnicos["T04"].id,
                pauta_id=None,
                emergencia_id=emergencias["EM-001"].id,
                fecha_programada=emergencias["EM-001"].reportada_at,
                inicio_real=emergencias["EM-001"].reportada_at,
                descripcion=_EMERGENCIAS[0]["descripcion"],
            )
        )
        ordenes.append(
            OrdenTrabajo(
                codigo="WO-2901",
                tipo=TipoOrdenTrabajo.EMERGENCIA,
                prioridad=PrioridadOrdenTrabajo.CRITICA,
                estado="programado",
                ascensor_id=ascensores["ELV-06A"].id,
                tecnico_id=None,
                pauta_id=None,
                emergencia_id=emergencias["EM-002"].id,
                fecha_programada=emergencias["EM-002"].reportada_at,
                descripcion=_EMERGENCIAS[1]["descripcion"],
            )
        )

        session.add_all(ordenes)
        await session.commit()

        print(
            f"Seed OK: {len(edificios)} edificios, {len(ascensores)} ascensores, "
            f"{1 + len(tecnicos)} usuarios, {len(pautas)} pautas, {len(emergencias)} emergencias, "
            f"{len(ordenes)} órdenes."
        )
        print(f"Operador demo: {operador.email}")


if __name__ == "__main__":
    asyncio.run(seed())
