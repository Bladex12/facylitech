"""Seed de Facylitech con los DATOS DE SIMULACIÓN ENTREGADOS POR LA EMPRESA.

Fuente: documento "UDD N.° 6-1005 — Data Simulación App Gestión Operativa"
(A. Valdivia, 05-oct-2026): clientes, comunidades, equipos, pisos,
direcciones, contactos, los 3 técnicos con RUT y el cronograma de mantención
del 7 al 9 de octubre de 2026. Reemplaza a los datos ficticios del mockup.

Lo que el documento NO trae y se simuló/aproximó (ver docs/datos-simulacion.md):
coordenadas, teléfono/email/especialidades/zona de los técnicos, operador,
marcas/modelos/años, mañas, instrucciones de reinicio, pautas, historial de
papeletas, OTs no-mantención, emergencias y mensajes. Todo valor simulado se
marca con `# SIMULADO` en este archivo.

Uso:
    python seed.py

Idempotente: vacía las tablas de negocio (TRUNCATE ... CASCADE) y las
recrea. Los UUID son deterministas (uuid5), así que las sesiones (token) y
los ids de usuario siguen siendo válidos después de re-sembrar. Todos los usuarios quedan
con la contraseña SEED_PASSWORD (default "facylitech2026"), que se imprime al final.
"""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.domain.enums import (
    CategoriaEquipo,
    Especialidad,
    EstadoAscensor,
    EstadoDisponibilidadTecnico,
    EstadoEmergencia,
    EstadoOrdenTrabajo,
    EstadoPapeleta,
    PrioridadOrdenTrabajo,
    RolUsuario,
    TipoCliente,
    TipoEdificio,
    TipoEquipo,
    TipoOrdenTrabajo,
)
from app.domain.pauta import items_del_mes
from app.domain.replicacion import fecha_equivalente
from app.domain.seguridad import hash_password
from app.infrastructure.config import settings
from app.infrastructure.db.models import (
    Administracion,
    Ascensor,
    Cliente,
    Edificio,
    Emergencia,
    Mensaje,
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
_NS = uuid.UUID("6f1d3c52-7a0e-4f7b-9d61-0c1e5a2b9f10")


def _id(*partes: str) -> uuid.UUID:
    """UUID determinista para que re-sembrar no cambie los ids."""
    return uuid.uuid5(_NS, ":".join(partes))


# ═══════════════════════════════════════════════════════════════════════════
# 1. Clientes y administraciones (dato de la empresa)
#    Jerarquía de la empresa: Fondo de inversión → Administración →
#    Comunidad/Edificio → sector → equipos. Los clientes corporativos y
#    públicos no tienen administración externa: se modelan con una
#    `administracion` homónima "(gestión directa)" (FK not-null intacta).
# ═══════════════════════════════════════════════════════════════════════════

_CLIENTES = {
    "VALORA": dict(nombre="Valora Prime Capital", tipo=TipoCliente.FONDO_INVERSION),
    "NEXOS": dict(nombre="Nexos propiedades y Gestión", tipo=TipoCliente.ADMINISTRACION),
    "TORREON": dict(nombre="Torreón Administraciones", tipo=TipoCliente.ADMINISTRACION),
    "AETHER": dict(nombre="Clínica Aether", tipo=TipoCliente.CORPORATIVO),
    "ECO": dict(nombre="Ecohabitat Hotel", tipo=TipoCliente.CORPORATIVO),
    "MUNI": dict(nombre="Municipalidad", tipo=TipoCliente.PUBLICO),
}

_ADMINISTRACIONES = {
    "GHC": dict(
        cliente="VALORA",
        nombre="Gestión Hogar y Comunidad",
        contacto_nombre="Pedro Armas",
        contacto_telefono="(2) 3487 2390",
        contacto_email="pedro@ghc.py",
    ),
    "VUA": dict(
        cliente="VALORA",
        nombre="Vértice Urbano Administraciones",
        contacto_nombre="Jorge Fuentes",
        contacto_telefono="(9) 6573 8327",
        contacto_email="jorge@vua.py",
    ),
    "NEXOS": dict(
        cliente="NEXOS",
        nombre="Nexos propiedades y Gestión",
        contacto_nombre="Cínthia Gálvez",
        contacto_telefono="(9) 2094 5128",
        contacto_email="cindy@nexus.py",
    ),
    "TORREON": dict(
        cliente="TORREON",
        nombre="Torreón Administraciones",
        contacto_nombre="Juan Ortega",
        contacto_telefono="(2) 6758 7623",
        contacto_email="juan@alva.py",
    ),
    "AETHER": dict(
        cliente="AETHER",
        nombre="Clínica Aether (gestión directa)",
        contacto_nombre="Santiago Silva",
        contacto_telefono="(2) 5648 9327",
        contacto_email="santiago@clinica.py",
        contacto_alternativo="Celular: (9) 7603 6159",
    ),
    "ECO": dict(
        cliente="ECO",
        nombre="Ecohabitat Hotel (gestión directa)",
        contacto_nombre="Miguel Alva",
        contacto_telefono="(9) 5932 7640",
        contacto_email="miguel@eco.py",
    ),
    "MUNI": dict(
        cliente="MUNI",
        nombre="Municipalidad (gestión directa)",
        contacto_nombre="Juan Ortega",
        contacto_telefono="(9) 6540 9847",
        contacto_email="juan@muni.py",
    ),
}


# ═══════════════════════════════════════════════════════════════════════════
# 2. Comunidades / edificios y sus equipos (dato de la empresa)
#    lat/lon: APROXIMADAS (el documento no trae coordenadas) — punto
#    plausible en la calle/comuna indicada, no geocodificado.
# ═══════════════════════════════════════════════════════════════════════════


@dataclass
class Grupo:
    """Equipos de un mismo sector y categoría (sector -> `ascensor.torre`)."""

    sector: str | None
    categoria: CategoriaEquipo
    cantidad: int
    pisos: list[int]  # uno por equipo, o uno solo repetido
    tipo_equipo: TipoEquipo = TipoEquipo.ELECTROMECANICO
    marca: str | None = None  # SIMULADO
    modelo: str | None = None  # SIMULADO
    anio: int | None = None  # SIMULADO


@dataclass
class EdificioDatos:
    abrev: str
    admin: str
    nombre: str
    direccion: str
    comuna: str
    tipo: TipoEdificio
    lat: float  # APROXIMADO
    lon: float  # APROXIMADO
    grupos: list[Grupo]
    contacto_nombre: str | None = None
    contacto_telefono: str | None = None
    contacto_email: str | None = None
    manas: str | None = None  # SIMULADO
    instrucciones_reinicio: str | None = None  # SIMULADO
    vencimiento_certificacion: date | None = None  # SIMULADO
    equipos: list[str] = field(default_factory=list)  # códigos, se llena al crear


_A = CategoriaEquipo.ASCENSOR
_MC = CategoriaEquipo.MONTACARGA
_MP = CategoriaEquipo.MONTAPLATOS

_EDIFICIOS: list[EdificioDatos] = [
    EdificioDatos(
        abrev="PRI", admin="GHC", nombre="Torre Prisma",
        direccion="Calle Los Alerces 452", comuna="Santiago", tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.4521, lon=-70.6598,
        grupos=[Grupo(None, _A, 3, [14], marca="Otis", modelo="Gen2", anio=2016)],
        contacto_nombre="Jaime Soto", contacto_telefono="(9) 6478 4239", contacto_email="jaime@prisma.py",
        manas="El ascensor 2 suele quedar desnivelado en el piso 9; avisar a conserjería antes de detenerlo.",
        instrucciones_reinicio="Sala de máquinas en azotea: bajar el interruptor general del equipo, "
        "esperar 10 s y subir. Llave en conserjería.",
        vencimiento_certificacion=date(2027, 3, 15),
    ),
    EdificioDatos(
        abrev="TRA", admin="GHC", nombre="Terraza Raíces",
        direccion="Avenida Las Rosas 89", comuna="Maipú", tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.5098, lon=-70.7571,
        grupos=[Grupo(None, _A, 2, [8])],
        contacto_nombre="Luis Peña", contacto_telefono="(9) 1543 9848", contacto_email="luis@terraza.py",
    ),
    EdificioDatos(
        abrev="BIO", admin="VUA", nombre="Torre Bioma",
        direccion="Av. Providencia 1280", comuna="Providencia", tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.4293, lon=-70.6187,
        grupos=[
            Grupo(None, _A, 2, [8], marca="Schindler", modelo="3300", anio=2019),
            Grupo(None, _MC, 1, [3], marca="Schindler", modelo="2400", anio=2019),
        ],
        instrucciones_reinicio="Montacarga: reset en tablero del subterráneo -1, botón azul.",
    ),
    EdificioDatos(
        abrev="AMB", admin="NEXOS", nombre="Edificio Ámbar",
        direccion="Camino Real 3450", comuna="Las Condes", tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.4087, lon=-70.5468,
        grupos=[Grupo(None, _A, 4, [18], marca="TK Elevator", modelo="Synergy", anio=2014)],
        manas="Ascensor 3 con operador de puerta lento; revisar antes de cerrar la orden.",
        vencimiento_certificacion=date(2026, 12, 1),
    ),
    EdificioDatos(
        abrev="NOV", admin="NEXOS", nombre="Nova Horizon",
        direccion="Calle San Martín 721", comuna="Ñuñoa", tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.4566, lon=-70.5979,
        # Pisos por ascensor: 8-6-6-8 (dato de la empresa)
        grupos=[Grupo(None, _A, 4, [8, 6, 6, 8])],
    ),
    EdificioDatos(
        abrev="PIN", admin="NEXOS", nombre="Pinnacle Residences",
        direccion="Av. Vicuña Mackenna 4800", comuna="Macul", tipo=TipoEdificio.RESIDENCIAL,
        lat=-33.4972, lon=-70.6139,
        grupos=[
            Grupo("Bloque A", _A, 2, [14], marca="Mitsubishi", modelo="NEXIEZ", anio=2018),
            Grupo("Bloque B", _A, 2, [14], marca="Mitsubishi", modelo="NEXIEZ", anio=2018),
            Grupo("Bloque C", _A, 2, [14], marca="Mitsubishi", modelo="NEXIEZ", anio=2019),
        ],
        manas="Condominio: pedir acceso en portería central (Bloque B).",
    ),
    EdificioDatos(
        abrev="ALV", admin="TORREON", nombre="Alva Corporate Center",
        direccion="Av. El Sol 44", comuna="La Florida", tipo=TipoEdificio.OFICINA,
        lat=-33.5203, lon=-70.5987,
        grupos=[
            Grupo("Torre Sur", _A, 6, [24], marca="Schindler", modelo="5500", anio=2017),
            Grupo("Torre Norte", _A, 6, [24], marca="Schindler", modelo="5500", anio=2017),
        ],
        manas="Horario de oficina: evitar detener más de un ascensor por torre entre 08:00 y 10:00.",
        vencimiento_certificacion=date(2027, 5, 30),
    ),
    EdificioDatos(
        abrev="AET", admin="AETHER", nombre="Clínica Aether",
        direccion="Calle Los Jazmines 910", comuna="Peñalolén", tipo=TipoEdificio.HOSPITAL,
        lat=-33.4852, lon=-70.5463,
        # Excel: 18 ascensores / 2 montacargas / 2 montaplatos (pisos 12/5/3).
        # Diagrama: Pab. A 6 asc, Pab. B 4 asc + 2 mc + 2 mp, Pab. C 6 asc (=16).
        # Se usa el Excel (18) y se reparte A=7, B=4, C=7. Ver docs/datos-simulacion.md.
        grupos=[
            Grupo("Pabellón A", _A, 7, [12], marca="Otis", modelo="Gen2 Comfort", anio=2020),
            Grupo("Pabellón B", _A, 4, [12], marca="Otis", modelo="Gen2 Comfort", anio=2020),
            Grupo("Pabellón B", _MC, 2, [5], marca="Orona", modelo="M33", anio=2020),
            Grupo("Pabellón B", _MP, 2, [3]),
            Grupo("Pabellón C", _A, 7, [12], marca="Otis", modelo="Gen2 Comfort", anio=2021),
        ],
        manas="Uso crítico 24/7: coordinar con enfermería de turno antes de detener cualquier equipo; "
        "nunca dos camilleros del mismo pabellón a la vez.",
        instrucciones_reinicio="Reset solo con autorización del jefe de turno; "
        "tablero en subterráneo, Pabellón B.",
        vencimiento_certificacion=date(2026, 11, 30),
    ),
    EdificioDatos(
        abrev="ECO", admin="ECO", nombre="Ecohabitat Hotel",
        direccion="Av. Libertador 1502", comuna="Santiago", tipo=TipoEdificio.HOTEL,
        lat=-33.4456, lon=-70.6578,
        # Diagrama: todo en "Pabellón B".
        grupos=[
            Grupo("Pabellón B", _A, 4, [12], marca="Orona", modelo="3G", anio=2012),
            Grupo("Pabellón B", _MC, 2, [3], marca="Orona", modelo="M33", anio=2012),
        ],
        manas="Evitar mantenciones entre 12:00 y 15:00 (check-out/check-in).",
        instrucciones_reinicio="Solicitar llave maestra en recepción para sala de máquinas.",
    ),
    EdificioDatos(
        abrev="MUN", admin="MUNI", nombre="Municipalidad",
        direccion="Calle Los Aromos 235", comuna="Vitacura", tipo=TipoEdificio.PUBLICO,
        lat=-33.3903, lon=-70.5852,
        # Excel: 4 ascensores / 2 montacargas. Diagrama: 2 asc + 2 mc. Se usa el Excel.
        grupos=[
            Grupo(None, _A, 4, [3], tipo_equipo=TipoEquipo.HIDRAULICO),
            Grupo(None, _MC, 2, [2], tipo_equipo=TipoEquipo.HIDRAULICO),
        ],
        contacto_nombre="Magali Ruiz", contacto_telefono="(9) 7092 4276", contacto_email="magali@muni.py",
    ),
]

_EDIF = {e.abrev: e for e in _EDIFICIOS}

_PREFIJO_CATEGORIA = {_A: "A", _MC: "MC", _MP: "MP"}


# ═══════════════════════════════════════════════════════════════════════════
# 3. Usuarios. Técnicos: nombre + RUT son dato de la empresa; el resto SIMULADO.
# ═══════════════════════════════════════════════════════════════════════════

_TECNICOS = {
    "MELVIN": dict(
        nombre="Melvin Zúñiga", rut="16.368.248-4",
        email="melvin.zuniga@facylitech.cl", telefono="+56 9 5511 4201",  # SIMULADO
        zona="Centro / Oriente",  # SIMULADO
        especialidades=[Especialidad.PERSONA_ATRAPADA, Especialidad.MECANICA],  # SIMULADO
    ),
    "JORGE": dict(
        nombre="Jorge Candia", rut="16.498.146-7",
        email="jorge.candia@facylitech.cl", telefono="+56 9 5511 4202",  # SIMULADO
        zona="Oriente / Sur-Oriente",  # SIMULADO
        especialidades=[Especialidad.MECANICA, Especialidad.CORTE_ENERGIA],  # SIMULADO
    ),
    "JUAN": dict(
        nombre="Juan Cubillos", rut="15.298.537-5",
        email="juan.cubillos@facylitech.cl", telefono="+56 9 5511 4203",  # SIMULADO
        zona="Sur-Oriente / Poniente",  # SIMULADO
        especialidades=[Especialidad.PERSONA_ATRAPADA, Especialidad.INUNDACION],  # SIMULADO
    ),
}

# La empresa no entregó operador: cuenta genérica (no usar nombres de las contrapartes reales).
_OPERADOR = dict(nombre="Operador Central", email="operador@facylitech.cl", telefono="+56 2 2345 6789")


# ═══════════════════════════════════════════════════════════════════════════
# 4. Pautas (SIMULADAS, adaptadas de las del mockup). meses[] por ítem (RNF-04).
# ═══════════════════════════════════════════════════════════════════════════

_TODOS = list(range(1, 13))

_PAUTAS = {
    "ELECTRO": dict(
        nombre="Mantención preventiva electromecánica",
        tipo_equipo=TipoEquipo.ELECTROMECANICO,
        descripcion="Checklist estándar para ascensores de tracción.",
        items=[
            ("Inspeccionar motor operador de puerta", _TODOS),
            ("Ajustar tiempos de puerta", [1, 4, 7, 10]),
            ("Probar todos los botones de cabina y pisos", _TODOS),
            ("Revisión sensores y pastillas de freno", [1, 3, 5, 7, 9, 11]),
            ("Lubricar rieles de cabina", [2, 5, 8, 11]),
            ("Revisar cables de tracción y poleas", [3, 6, 9, 12]),
            ("Probar intercomunicador y alarma de cabina", _TODOS),
            ("Verificar nivelación en cada piso", [1, 4, 7, 10]),
        ],
    ),
    "HIDRA": dict(
        nombre="Mantención preventiva hidráulica",
        tipo_equipo=TipoEquipo.HIDRAULICO,
        descripcion="Checklist estándar para ascensores hidráulicos.",
        items=[
            ("Verificar nivel de aceite hidráulico", _TODOS),
            ("Revisar válvulas de control", [1, 4, 7, 10]),
            ("Inspeccionar pistón y sellos", [3, 9]),
            ("Probar botones y alarma de cabina", _TODOS),
            ("Revisar fugas en sala de bombas", [2, 4, 6, 8, 10, 12]),
        ],
    ),
    "CARGA": dict(
        nombre="Mantención preventiva montacargas y montaplatos",
        tipo_equipo=TipoEquipo.ELECTROMECANICO,
        descripcion="Checklist para montacargas y montaplatos (se elige por categoría de equipo).",
        items=[
            ("Verificar enclavamientos de puertas en cada parada", _TODOS),
            ("Probar botoneras de llamada y envío", _TODOS),
            ("Revisar límite de carga y placa de capacidad", [1, 4, 7, 10]),
            ("Lubricar guías", [2, 5, 8, 11]),
            ("Inspeccionar cadenas / cables y poleas", [3, 6, 9, 12]),
        ],
    ),
}


def _pauta_para(categoria: CategoriaEquipo, tipo_equipo: TipoEquipo) -> str:
    if categoria != CategoriaEquipo.ASCENSOR:
        return "CARGA"
    return "HIDRA" if tipo_equipo == TipoEquipo.HIDRAULICO else "ELECTRO"


# ═══════════════════════════════════════════════════════════════════════════
# 5. Cronograma de mantención (dato de la empresa) — octubre 2026.
#    mañana 08:30–13:00, tarde 14:00–18:00, día completo = ambos tramos.
#    Edificios que aparecen 2 días reparten sus equipos entre esos días.
# ═══════════════════════════════════════════════════════════════════════════

_MANANA = [(time(8, 30), time(13, 0))]
_TARDE = [(time(14, 0), time(18, 0))]
_DIA = _MANANA + _TARDE

# (día del ciclo 0..2, técnico, edificio, tramo)
_CRONOGRAMA = [
    (0, "MELVIN", "PRI", _MANANA), (0, "MELVIN", "ECO", _TARDE),
    (0, "JORGE", "MUN", _MANANA), (0, "JORGE", "AMB", _TARDE),
    (0, "JUAN", "AET", _DIA),
    (1, "MELVIN", "PIN", _MANANA), (1, "MELVIN", "NOV", _TARDE),
    (1, "JORGE", "ALV", _DIA),
    (1, "JUAN", "AET", _DIA),
    (2, "MELVIN", "NOV", _MANANA), (2, "MELVIN", "BIO", _TARDE),
    (2, "JORGE", "ALV", _DIA),
    (2, "JUAN", "TRA", _DIA),
]

# Primer ciclo: el cronograma que entregó la empresa (mié 07, jue 08, vie 09 de octubre).
_PRIMER_CICLO = date(2026, 10, 7)

# OTs del último ciclo ya iniciado que quedan SIN completar -> semáforo VENCIDO (alerta SLA).
_PENDIENTES = {"AET-A17", "AET-A18", "BIO-MC1"}

_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
          "septiembre", "octubre", "noviembre", "diciembre"]


def _ciclos(hoy: date) -> list[date]:
    """Miércoles de inicio de cada ciclo mensual, desde octubre hasta el primero que
    empieza después de hoy. "Será ideal reutilizar la misma data en un ciclo
    siguiente" (la empresa): cada ciclo se obtiene con la misma regla del botón
    "Replicar" (domain/replicacion.py), así el seed se mantiene vigente sin importar
    cuándo se corra (los ciclos pasados quedan completados y siempre hay uno próximo).
    """
    ciclos = [_PRIMER_CICLO]
    while ciclos[-1] <= hoy:
        siguiente = fecha_equivalente(datetime.combine(ciclos[-1], time(12), _TZ))
        ciclos.append(siguiente.date())
    return ciclos


def _repartir(dia: date, tramos, n: int) -> list[datetime]:
    """Horas de inicio de n equipos repartidos parejo dentro de los tramos del día."""
    minutos = [
        (datetime.combine(dia, a, _TZ), (datetime.combine(dia, b) - datetime.combine(dia, a)).seconds // 60)
        for a, b in tramos
    ]
    total = sum(m for _, m in minutos)
    paso = total / n
    horas = []
    for i in range(n):
        offset = round(i * paso)
        for inicio, largo in minutos:
            if offset < largo:
                horas.append(inicio + timedelta(minutes=offset))
                break
            offset -= largo
    return horas


def _plan_mantencion(dia_base: date) -> list[tuple[datetime, str, str, int]]:
    """(fecha_programada, técnico, código de equipo, duración estimada en minutos)."""
    visitas_por_edificio: dict[str, list[tuple[int, str, list]]] = {}
    for dia, tec, edif, tramo in _CRONOGRAMA:
        visitas_por_edificio.setdefault(edif, []).append((dia, tec, tramo))

    plan = []
    for edif, visitas in visitas_por_edificio.items():
        equipos = _EDIF[edif].equipos
        k = len(visitas)
        tamano = -(-len(equipos) // k)  # techo
        for i, (dia, tec, tramo) in enumerate(visitas):
            porcion = equipos[i * tamano : (i + 1) * tamano]
            if not porcion:
                continue
            fecha = dia_base + timedelta(days=dia)
            horas = _repartir(fecha, tramo, len(porcion))
            minutos_tramo = sum(
                (datetime.combine(fecha, b) - datetime.combine(fecha, a)).seconds // 60 for a, b in tramo
            )
            duracion = max(30, min(90, minutos_tramo // len(porcion) - 10))
            plan.extend((h, tec, cod, duracion) for h, cod in zip(horas, porcion, strict=True))
    return plan


# Textos SIMULADOS para el historial de papeletas.
_TRABAJOS = [
    "Mantención mensual según pauta. Equipo operativo.",
    "Mantención mensual. Se ajustan tiempos de puerta y se limpia foso.",
    "Mantención mensual. Se lubrican guías y se prueba alarma de cabina.",
    "Mantención mensual sin observaciones.",
]
_PIEZAS = {  # índice de equipo (orden global) -> piezas reemplazadas (SIMULADO)
    2: [("Zapata de puerta de piso", "Otis", True)],
    9: [("Contacto de puerta de cabina", None, False)],
    15: [("Botón de llamada piso 4", "Schindler", True)],
    23: [("Correa operador de puerta", "Orona", True), ("Fusible 10A tablero", None, False)],
    31: [("Rodamiento polea desviadora", "Otis", True)],
    40: [("Pulsador de alarma", None, False)],
    52: [("Guiador de cabina (zapata deslizante)", "Mitsubishi", True)],
}


@dataclass
class OtNueva:
    fecha: datetime
    tipo: TipoOrdenTrabajo
    prioridad: PrioridadOrdenTrabajo
    estado: EstadoOrdenTrabajo
    equipo: str
    tecnico: str | None
    descripcion: str
    inicio_real: datetime | None = None
    fin_real: datetime | None = None
    papeleta: dict | None = None
    emergencia: str | None = None


_TABLAS = [
    "mensaje",
    "evidencia",
    "pieza_reemplazada",
    "papeleta_item",
    "papeleta",
    "orden_trabajo",
    "emergencia",
    "pauta_item",
    "pauta_mantencion",
    "usuario",
    "ascensor",
    "edificio",
    "administracion",
    "cliente",
]


async def seed() -> None:
    ahora = datetime.now(_TZ).replace(second=0, microsecond=0)
    hoy = ahora.date()

    async with SessionLocal() as session:
        # CASCADE también vacía tablas que dependan de éstas (p.ej. asignacion_emergencia).
        await session.execute(text(f"TRUNCATE {', '.join(_TABLAS)} CASCADE"))

        # ── Clientes / administraciones ─────────────────────────────────────
        clientes = {k: Cliente(id=_id("cliente", k), **v) for k, v in _CLIENTES.items()}
        session.add_all(clientes.values())
        admins = {}
        for k, v in _ADMINISTRACIONES.items():
            datos = {c: x for c, x in v.items() if c != "cliente"}
            admins[k] = Administracion(id=_id("admin", k), cliente_id=clientes[v["cliente"]].id, **datos)
        session.add_all(admins.values())
        await session.flush()

        # ── Edificios y equipos ─────────────────────────────────────────────
        edificios: dict[str, Edificio] = {}
        equipos: dict[str, Ascensor] = {}
        for e in _EDIFICIOS:
            edificio = Edificio(
                id=_id("edificio", e.abrev),
                administracion_id=admins[e.admin].id,
                nombre=e.nombre,
                direccion=e.direccion,
                comuna=e.comuna,
                tipo=e.tipo,
                ubicacion=punto_desde_coords(e.lat, e.lon),
                manas=e.manas,
                instrucciones_reinicio=e.instrucciones_reinicio,
                vencimiento_certificacion=e.vencimiento_certificacion,
                contacto_nombre=e.contacto_nombre,
                contacto_telefono=e.contacto_telefono,
                contacto_email=e.contacto_email,
            )
            edificios[e.abrev] = edificio
            session.add(edificio)

            e.equipos = []
            contador_cat: dict[CategoriaEquipo, int] = {}
            for g in e.grupos:
                for j in range(g.cantidad):
                    n = contador_cat[g.categoria] = contador_cat.get(g.categoria, 0) + 1
                    pref = _PREFIJO_CATEGORIA[g.categoria]
                    sufijo = f"{pref}{n:02d}" if g.categoria == _A else f"{pref}{n}"
                    codigo = f"{e.abrev}-{sufijo}"
                    equipos[codigo] = Ascensor(
                        id=_id("equipo", codigo),
                        edificio_id=edificio.id,
                        codigo=codigo,
                        codigo_qr=f"FCY-{codigo}",
                        torre=g.sector,
                        numero=str(j + 1),
                        marca=g.marca,
                        modelo=g.modelo,
                        anio_instalacion=g.anio,
                        pisos=g.pisos[j] if len(g.pisos) > 1 else g.pisos[0],
                        tipo_equipo=g.tipo_equipo,
                        categoria=g.categoria,
                        estado=EstadoAscensor.OPERACIONAL,
                    )
                    e.equipos.append(codigo)
        session.add_all(equipos.values())

        # Estados SIMULADOS coherentes con las emergencias / reparación de hoy
        equipos["PRI-A02"].estado = EstadoAscensor.CRITICO
        equipos["AET-A05"].estado = EstadoAscensor.CRITICO
        equipos["AMB-A03"].estado = EstadoAscensor.ADVERTENCIA
        equipos["ECO-A02"].manas = "Puerta de cabina rebota al cerrar en piso 7."  # SIMULADO
        equipos["PRI-A02"].manas = "Queda desnivelado en piso 9."  # SIMULADO
        await session.flush()

        # ── Usuarios ────────────────────────────────────────────────────────
        tecnicos: dict[str, Usuario] = {}
        for k, t in _TECNICOS.items():
            tecnicos[k] = Usuario(
                id=_id("usuario", k),
                rol=RolUsuario.TECNICO,
                activo=True,
                nombre=t["nombre"],
                rut=t["rut"],
                email=t["email"],
                telefono=t["telefono"],
                zona=t["zona"],
                especialidades=[x.value for x in t["especialidades"]],
            )
        operador = Usuario(id=_id("usuario", "OPERADOR"), rol=RolUsuario.OPERADOR, activo=True, **_OPERADOR)
        # Todos los usuarios de demostración comparten SEED_PASSWORD (solo demo; cada uno
        # con su propia sal). Sin esto no podrían iniciar sesión.
        for usuario in (*tecnicos.values(), operador):
            usuario.password_hash = hash_password(settings.seed_password)
        session.add_all([*tecnicos.values(), operador])

        # Última ubicación de hoy (SIMULADA) para la cercanía PostGIS.
        ubic = {
            # Jorge: en Edificio Ámbar (reparación en curso)
            "JORGE": (-33.4089, -70.5472, EstadoDisponibilidadTecnico.EN_TERRENO, 25),
            # Melvin: disponible en Providencia (cerca de Torre Prisma / Torre Bioma)
            "MELVIN": (-33.4262, -70.6148, EstadoDisponibilidadTecnico.DISPONIBLE, 8),
            # Juan: disponible en Ñuñoa (cerca de Clínica Aether)
            "JUAN": (-33.4589, -70.5935, EstadoDisponibilidadTecnico.DISPONIBLE, 14),
        }
        for k, (lat, lon, disp, hace_min) in ubic.items():
            tecnicos[k].ultima_ubicacion = punto_desde_coords(lat, lon)
            tecnicos[k].ultima_ubicacion_at = ahora - timedelta(minutes=hace_min)
            tecnicos[k].estado_disponibilidad = disp

        # ── Pautas ──────────────────────────────────────────────────────────
        pautas: dict[str, PautaMantencion] = {}
        for k, p in _PAUTAS.items():
            pautas[k] = PautaMantencion(
                id=_id("pauta", k),
                nombre=p["nombre"],
                tipo_equipo=p["tipo_equipo"],
                descripcion=p["descripcion"],
                items=[
                    PautaItem(id=_id("pauta_item", k, str(i)), orden=i, descripcion=d, meses=m, activo=True)
                    for i, (d, m) in enumerate(p["items"], start=1)
                ],
            )
        session.add_all(pautas.values())
        await session.flush()

        # ── Emergencias (SIMULADAS) ─────────────────────────────────────────
        emergencias_datos = [
            # Histórica, cerrada (con OT de emergencia completada -> bitácora)
            dict(codigo="EM-001", tipo=Especialidad.PERSONA_ATRAPADA, edificio="ECO", equipo="ECO-A02",
                 reportada_at=datetime(2026, 10, 2, 22, 40, tzinfo=_TZ),
                 descripcion="Huésped atrapado en cabina entre pisos 6 y 7. Rescatado sin lesiones.",
                 solicitante="Recepción Ecohabitat Hotel", estado=EstadoEmergencia.CERRADA),
            # Activas, SIN despachar (el operador debe aprobar la cascada)
            dict(codigo="EM-002", tipo=Especialidad.MECANICA, edificio="AET", equipo="AET-A05",
                 reportada_at=ahora - timedelta(minutes=40),
                 descripcion="Ascensor camillero Pabellón A detenido en piso 4 con ruido metálico en "
                 "sala de máquinas. Sin pasajeros.",
                 solicitante="Santiago Silva (Clínica Aether)", estado=EstadoEmergencia.ACTIVA),
            dict(codigo="EM-003", tipo=Especialidad.PERSONA_ATRAPADA, edificio="PRI", equipo="PRI-A02",
                 reportada_at=ahora - timedelta(minutes=12),
                 descripcion="2 residentes atrapados entre pisos 8 y 9. Puerta no abre.",
                 solicitante="Conserjería Torre Prisma", estado=EstadoEmergencia.ACTIVA),
        ]
        emergencias: dict[str, Emergencia] = {}
        for d in emergencias_datos:
            emergencias[d["codigo"]] = Emergencia(
                id=_id("emergencia", d["codigo"]),
                codigo=d["codigo"],
                tipo=d["tipo"],
                edificio_id=edificios[d["edificio"]].id,
                ascensor_id=equipos[d["equipo"]].id,
                reportada_at=d["reportada_at"],
                descripcion=d["descripcion"],
                solicitante=d["solicitante"],
                estado=d["estado"],
            )
        session.add_all(emergencias.values())
        await session.flush()

        # ── Órdenes de trabajo ──────────────────────────────────────────────
        ots: list[OtNueva] = []
        orden_global = {cod: i for i, cod in enumerate(equipos)}

        # Ciclos mensuales (ver _ciclos): lo que ya pasó, completado con su papeleta;
        # lo que viene, programado. Del último ciclo iniciado quedan _PENDIENTES sin
        # ejecutar -> vencidas (alerta de incumplimiento de SLA).
        ciclos = _ciclos(hoy)
        ultimo_iniciado = max((c for c in ciclos if c <= hoy), default=None)
        for ciclo in ciclos:
            nombre_ciclo = f"ciclo {_MESES[ciclo.month - 1]}"
            for fecha, tec, cod, duracion in _plan_mantencion(ciclo):
                idx = orden_global[cod]
                if ciclo == ultimo_iniciado and cod in _PENDIENTES and fecha < ahora:
                    ots.append(OtNueva(
                        fecha, TipoOrdenTrabajo.MANTENCION, PrioridadOrdenTrabajo.MEDIA,
                        EstadoOrdenTrabajo.PROGRAMADO, cod, tec,
                        f"Mantención mensual ({nombre_ciclo}). Pendiente: no se alcanzó a ejecutar.",
                    ))
                    continue
                inicio = fecha + timedelta(minutes=idx % 7)
                fin = inicio + timedelta(minutes=duracion)
                if fin > ahora:
                    ots.append(OtNueva(fecha, TipoOrdenTrabajo.MANTENCION, PrioridadOrdenTrabajo.MEDIA,
                                       EstadoOrdenTrabajo.PROGRAMADO, cod, tec,
                                       f"Mantención mensual ({nombre_ciclo})."))
                    continue
                ots.append(OtNueva(
                    fecha, TipoOrdenTrabajo.MANTENCION, PrioridadOrdenTrabajo.MEDIA,
                    EstadoOrdenTrabajo.COMPLETADO, cod, tec, f"Mantención mensual ({nombre_ciclo}).",
                    inicio, fin,
                    papeleta=dict(
                        trabajo_realizado=_TRABAJOS[(idx + ciclo.month) % len(_TRABAJOS)],
                        falla_detectada=None if idx not in _PIEZAS or ciclo != _PRIMER_CICLO
                        else "Desgaste detectado en revisión de rutina.",
                        piezas=_PIEZAS.get(idx, []) if ciclo == _PRIMER_CICLO else [],
                        receptor_nombre=_EDIF[cod.split("-")[0]].contacto_nombre or "Conserjería",
                        mes=ciclo.month,
                    ),
                ))

        # OT de la emergencia histórica EM-001 (completada)
        em1 = emergencias["EM-001"].reportada_at
        ots.append(OtNueva(
            em1, TipoOrdenTrabajo.EMERGENCIA, PrioridadOrdenTrabajo.CRITICA, EstadoOrdenTrabajo.COMPLETADO,
            "ECO-A02", "MELVIN", emergencias_datos[0]["descripcion"],
            em1 + timedelta(minutes=28), em1 + timedelta(minutes=95),
            papeleta=dict(
                falla_detectada="Falla en contacto de puerta de cabina: el equipo se detuvo por seguridad.",
                trabajo_realizado="Rescate de pasajero, limpieza y ajuste de contacto de puerta. "
                "Pruebas de funcionamiento OK.",
                piezas=[("Contacto de puerta de cabina", "Orona", True)],
                receptor_nombre="Miguel Alva",
                mes=10,
                causada_por_terceros=False,
            ),
            emergencia="EM-001",
        ))

        # OTs no-mantención alrededor de hoy (SIMULADAS)
        def _a_las(dias: int, h: int, m: int = 0) -> datetime:
            return datetime.combine(hoy + timedelta(days=dias), time(h, m), _TZ)

        inicio_rep = ahora - timedelta(hours=2)
        ots += [
            OtNueva(inicio_rep - timedelta(minutes=15), TipoOrdenTrabajo.REPARACION, PrioridadOrdenTrabajo.ALTA,
                    EstadoOrdenTrabajo.EN_CURSO, "AMB-A03", "JORGE",
                    "Operador de puerta lento (reportado por la administración). Cambio de correa y ajuste.",
                    inicio_real=inicio_rep),
            OtNueva(_a_las(1, 10), TipoOrdenTrabajo.INSPECCION, PrioridadOrdenTrabajo.MEDIA,
                    EstadoOrdenTrabajo.PROGRAMADO, "AET-A01", "JUAN",
                    "Inspección previa a la recertificación anual (Pabellón A)."),
            OtNueva(_a_las(3, 11), TipoOrdenTrabajo.PRIMERA_VISITA, PrioridadOrdenTrabajo.BAJA,
                    EstadoOrdenTrabajo.PROGRAMADO, "MUN-MC1", "MELVIN",
                    "Primera visita: levantamiento de montacargas (cantidad no coincide entre Excel y diagrama)."),
            OtNueva(_a_las(2, 15), TipoOrdenTrabajo.REPARACION, PrioridadOrdenTrabajo.MEDIA,
                    EstadoOrdenTrabajo.PROGRAMADO, "ECO-A02", None,
                    "Seguimiento EM-001: revisar rebote de puerta de cabina en piso 7. Sin técnico asignado."),
        ]

        # Códigos WO-2850.. en orden cronológico (consistente con siguiente_codigo()).
        ots.sort(key=lambda o: o.fecha)
        ordenes: list[OrdenTrabajo] = []
        for n, o in enumerate(ots):
            equipo = equipos[o.equipo]
            pauta_k = _pauta_para(equipo.categoria, equipo.tipo_equipo)
            con_pauta = o.tipo in (TipoOrdenTrabajo.MANTENCION, TipoOrdenTrabajo.INSPECCION)
            codigo = f"WO-{2850 + n}"
            orden = OrdenTrabajo(
                id=_id("orden", o.equipo, o.tipo, o.fecha.isoformat()),
                codigo=codigo,
                tipo=o.tipo,
                prioridad=o.prioridad,
                estado=o.estado,
                ascensor_id=equipo.id,
                tecnico_id=tecnicos[o.tecnico].id if o.tecnico else None,
                pauta_id=pautas[pauta_k].id if con_pauta else None,
                emergencia_id=emergencias[o.emergencia].id if o.emergencia else None,
                fecha_programada=o.fecha,
                inicio_real=o.inicio_real,
                fin_real=o.fin_real,
                descripcion=o.descripcion,
            )
            if o.papeleta:
                p = o.papeleta
                items_pauta = items_del_mes(pautas[pauta_k].items, p["mes"]) if con_pauta else []
                orden.papeleta = Papeleta(
                    id=_id("papeleta", codigo),
                    trabajo_realizado=p["trabajo_realizado"],
                    falla_detectada=p["falla_detectada"],
                    causada_por_terceros=p.get("causada_por_terceros", False),
                    hora_inicio=o.inicio_real,
                    hora_fin=o.fin_real,
                    estado=EstadoPapeleta.ENVIADA,
                    receptor_nombre=p["receptor_nombre"],
                    items=[
                        PapeletaItem(
                            pauta_item_id=it.id,
                            descripcion=it.descripcion,
                            completado=True,
                            completado_at=o.inicio_real + timedelta(minutes=5 * (i + 1)),
                        )
                        for i, it in enumerate(items_pauta)
                    ],
                    piezas=[
                        PiezaReemplazada(nombre=nm, marca=mc, es_original=orig)
                        for nm, mc, orig in p["piezas"]
                    ],
                )
            if o.estado == EstadoOrdenTrabajo.COMPLETADO and o.tipo == TipoOrdenTrabajo.MANTENCION:
                previo = equipo.ultima_mantencion
                if previo is None or o.fecha.date() > previo:
                    equipo.ultima_mantencion = o.fecha.date()
            ordenes.append(orden)
        session.add_all(ordenes)

        # ── Mensajes de ejemplo (SIMULADOS) ─────────────────────────────────
        mensajes = [
            (operador, tecnicos["JUAN"], "Juan, mañana a las 10:00 inspección en Clínica Aether, Pabellón A.",
             ahora - timedelta(hours=20), True),
            (tecnicos["JUAN"], operador, "Recibido. Llevo el checklist de recertificación.",
             ahora - timedelta(hours=19, minutes=40), True),
            (operador, tecnicos["JORGE"], "¿Cómo va la reparación en Edificio Ámbar?",
             ahora - timedelta(minutes=50), True),
            (tecnicos["JORGE"], operador, "Cambiando la correa del operador de puerta del ascensor 3. "
             "Termino en ~1 hora.", ahora - timedelta(minutes=35), False),
        ]
        session.add_all(
            Mensaje(
                id=_id("mensaje", str(i)),
                remitente_id=rem.id,
                destinatario_id=dest.id,
                texto=txt,
                created_at=cuando,
                leido_at=cuando + timedelta(minutes=3) if leido else None,
            )
            for i, (rem, dest, txt, cuando, leido) in enumerate(mensajes)
        )

        await session.commit()

        completadas = sum(1 for o in ots if o.estado == EstadoOrdenTrabajo.COMPLETADO)
        vencidas = sum(1 for o in ots if o.estado == EstadoOrdenTrabajo.PROGRAMADO and o.fecha < ahora)
        por_cat = {c.value: sum(1 for e in equipos.values() if e.categoria == c) for c in CategoriaEquipo}
        print(
            f"Seed OK: {len(clientes)} clientes, {len(admins)} administraciones, {len(edificios)} edificios, "
            f"{len(equipos)} equipos {por_cat}, {len(tecnicos)} técnicos + 1 operador, {len(pautas)} pautas, "
            f"{len(emergencias)} emergencias, {len(ordenes)} órdenes ({completadas} completadas, "
            f"{vencidas} vencidas), {len(mensajes)} mensajes."
        )
        print("Cuentas de demostración (todas con la misma contraseña, definida por SEED_PASSWORD):")
        for usuario in (operador, *tecnicos.values()):
            print(f"  {usuario.rol.value:<8} {usuario.email}")
        print(f"Contraseña: {settings.seed_password}")


if __name__ == "__main__":
    asyncio.run(seed())
