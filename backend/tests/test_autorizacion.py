"""Matriz de autorización de docs/contrato-auth.md, recorrida endpoint por endpoint,
más los casos de propiedad (un técnico no ve ni toca lo de otro).

Cada fila de MATRIZ declara el tipo de acceso de un endpoint:

- ``operador``     : solo operador (técnico 403).
- ``autenticado``  : cualquier usuario autenticado.
- ``orden``        : operador, o el técnico dueño de la OT (otro técnico 403).
- ``papeleta``     : ídem, autorizado por la OT de la papeleta.
- ``asignacion``   : solo el técnico dueño de la asignación (operador 403, otro técnico 403).
- ``propio``       : el parámetro de usuario debe ser el del token, sea cual sea el rol.
- ``usuario_get``  : operador cualquiera; técnico solo el propio.

Siempre: sin token -> 401. Un test final verifica que NINGÚN endpoint de la API
quede fuera de la matriz (si se agrega una ruta nueva, hay que clasificarla aquí).
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.api.v1.deps import get_almacenamiento
from app.infrastructure.almacenamiento import AlmacenamientoLocal
from app.main import app
from tests.fabricas import (
    COSTANERA_CENTER,
    crear_ascensor,
    crear_edificio,
    crear_emergencia,
    crear_tecnico,
)

API = "/api/v1"
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


@dataclass
class Mundo:
    """Datos reales sobre los que se prueba cada endpoint."""

    operador: dict
    tec_a: dict  # dueño de la OT, la papeleta y la asignación
    tec_b: dict  # un técnico cualquiera, ajeno a todo
    ids: dict = field(default_factory=dict)
    qr: str = ""


@pytest.fixture
def almacenamiento(tmp_path):
    local = AlmacenamientoLocal(tmp_path)
    app.dependency_overrides[get_almacenamiento] = lambda: local
    yield local
    app.dependency_overrides.pop(get_almacenamiento, None)


@pytest.fixture
async def mundo(client, operador_prueba, almacenamiento) -> Mundo:
    r = await client.get(f"{API}/auth/me")
    operador = r.json()
    cli = await client.post(f"{API}/clientes", json={"nombre": "Cliente Auth", "tipo": "otro"})
    adm = await client.post(
        f"{API}/administraciones", json={"cliente_id": cli.json()["id"], "nombre": "Administración Auth"}
    )
    edificio = await crear_edificio(client)
    ascensor = await crear_ascensor(client, edificio["id"])
    tec_a = await crear_tecnico(client, nombre="Técnico A", ubicacion=COSTANERA_CENTER)
    tec_b = await crear_tecnico(client, nombre="Técnico B", ubicacion=COSTANERA_CENTER)
    pauta = await client.post(
        f"{API}/pautas",
        json={
            "nombre": "Pauta Auth",
            "tipo_equipo": "electromecanico",
            "items": [{"orden": 1, "descripcion": "Revisar", "meses": list(range(1, 13))}],
        },
    )
    assert pauta.status_code == 201, pauta.text
    orden = await client.post(
        f"{API}/ordenes-trabajo",
        json={
            "tipo": "mantencion",
            "prioridad": "media",
            "ascensor_id": ascensor["id"],
            "tecnico_id": tec_a["id"],
            "pauta_id": pauta.json()["id"],
            "fecha_programada": datetime.now(UTC).isoformat(),
        },
    )
    assert orden.status_code == 201, orden.text
    papeleta = await client.post(f"{API}/ordenes-trabajo/{orden.json()['id']}/papeleta")
    assert papeleta.status_code == 201, papeleta.text
    emergencia = await crear_emergencia(client, edificio["id"])
    despacho = await client.post(
        f"{API}/emergencias/{emergencia['id']}/despachar",
        json={"tecnico_ids": [tec_a["id"], tec_b["id"]], "operador_id": operador["id"]},
    )
    assert despacho.status_code == 200, despacho.text
    asignacion_a = despacho.json()["asignaciones"][0]
    assert asignacion_a["tecnico"]["id"] == tec_a["id"]
    return Mundo(
        operador=operador,
        tec_a=tec_a,
        tec_b=tec_b,
        qr=ascensor["codigo_qr"],
        ids={
            "cliente": cli.json()["id"],
            "administracion": adm.json()["id"],
            "edificio": edificio["id"],
            "ascensor": ascensor["id"],
            "pauta": pauta.json()["id"],
            "orden": orden.json()["id"],
            "papeleta": papeleta.json()["id"],
            "item": papeleta.json()["items"][0]["id"],
            "emergencia": emergencia["id"],
            "asignacion": asignacion_a["id"],
        },
    )


# --- Matriz ---------------------------------------------------------------------------


@dataclass
class Ep:
    metodo: str
    ruta: str  # plantilla tal como la declara FastAPI (relativa a /api/v1)
    tipo: str
    recurso: str | None = None  # a qué recurso apunta `{id_}`
    json: object = None  # callable(m, yo) -> cuerpo
    params: object = None  # callable(m, yo) -> query
    archivos: bool = False

    @property
    def clave(self) -> str:
        return f"{self.metodo} {self.ruta}"


def _cuerpo_mensaje(m, yo):
    return {"remitente_id": yo, "destinatario_id": m.operador["id"], "texto": "hola"}


MATRIZ: list[Ep] = [
    # clientes y administraciones: solo operador
    Ep("GET", "/clientes", "operador"),
    Ep("GET", "/clientes/{id_}", "operador", "cliente"),
    Ep("POST", "/clientes", "operador", json=lambda m, yo: {"nombre": "N", "tipo": "otro"}),
    Ep("GET", "/clientes/{id_}/administraciones", "operador", "cliente"),
    Ep("GET", "/administraciones", "operador"),
    Ep("GET", "/administraciones/{id_}", "operador", "administracion"),
    Ep(
        "POST",
        "/administraciones",
        "operador",
        json=lambda m, yo: {"cliente_id": m.ids["cliente"], "nombre": "N"},
    ),
    Ep("GET", "/administraciones/{id_}/edificios", "operador", "administracion"),
    # edificios, ascensores, pautas: lectura autenticada, escritura operador
    Ep("GET", "/edificios", "autenticado"),
    Ep("GET", "/edificios/{id_}", "autenticado", "edificio"),
    Ep("POST", "/edificios", "operador", json=lambda m, yo: {}),
    Ep("PATCH", "/edificios/{id_}", "operador", "edificio", json=lambda m, yo: {"manas": "x"}),
    Ep("GET", "/ascensores", "autenticado"),
    Ep("GET", "/ascensores/qr/{codigo_qr}", "autenticado"),
    Ep("GET", "/ascensores/{id_}", "autenticado", "ascensor"),
    Ep("GET", "/ascensores/{id_}/bitacora", "autenticado", "ascensor"),
    Ep("POST", "/ascensores", "operador", json=lambda m, yo: {}),
    Ep("PATCH", "/ascensores/{id_}", "operador", "ascensor", json=lambda m, yo: {"manas": "x"}),
    Ep("GET", "/pautas", "autenticado"),
    Ep("GET", "/pautas/{id_}", "autenticado", "pauta"),
    Ep("POST", "/pautas", "operador", json=lambda m, yo: {}),
    # usuarios
    Ep("GET", "/usuarios", "operador"),
    Ep("GET", "/usuarios/{id_}", "usuario_get"),
    Ep(
        "POST",
        "/usuarios",
        "operador",
        json=lambda m, yo: {"nombre": "N", "email": f"{uuid4().hex[:8]}@x.cl", "rol": "tecnico"},
    ),
    Ep(
        "PUT",
        "/usuarios/{id_}/password",
        "operador",
        "tec_b",
        json=lambda m, yo: {"password_nueva": "clave-nueva-1"},
    ),
    Ep("POST", "/usuarios/{id_}/ubicacion", "propio", json=lambda m, yo: {"lat": -33.4, "lon": -70.6}),
    # órdenes de trabajo
    Ep("GET", "/ordenes-trabajo", "autenticado"),
    Ep("GET", "/ordenes-trabajo/{id_}", "orden", "orden"),
    Ep(
        "POST",
        "/ordenes-trabajo",
        "operador",
        json=lambda m, yo: {
            "tipo": "mantencion",
            "prioridad": "media",
            "ascensor_id": m.ids["ascensor"],
            "fecha_programada": datetime.now(UTC).isoformat(),
        },
    ),
    Ep(
        "POST",
        "/ordenes-trabajo/replicar",
        "operador",
        json=lambda m, yo: {"mes": "2026-11", "simular": True},
    ),
    Ep("PATCH", "/ordenes-trabajo/{id_}", "operador", "orden", json=lambda m, yo: {"descripcion": "x"}),
    Ep("POST", "/ordenes-trabajo/{id_}/cancelar", "operador", "orden"),
    Ep("POST", "/ordenes-trabajo/{id_}/iniciar", "orden", "orden"),
    Ep("POST", "/ordenes-trabajo/{id_}/completar", "orden", "orden"),
    Ep("POST", "/ordenes-trabajo/{id_}/papeleta", "orden", "orden"),
    # papeletas: se autorizan por la OT de la papeleta
    Ep("GET", "/papeletas/{id_}", "papeleta", "papeleta"),
    Ep("PATCH", "/papeletas/{id_}", "papeleta", "papeleta", json=lambda m, yo: {"observaciones": "x"}),
    Ep(
        "PATCH",
        "/papeletas/{id_}/items/{item_id}",
        "papeleta",
        "papeleta",
        json=lambda m, yo: {"completado": True},
    ),
    Ep("POST", "/papeletas/{id_}/enviar", "papeleta", "papeleta"),
    Ep("POST", "/papeletas/{id_}/piezas", "papeleta", "papeleta", json=lambda m, yo: {"nombre": "Pieza"}),
    Ep("DELETE", "/papeletas/{id_}/piezas/{pieza_id}", "papeleta", "papeleta"),
    Ep("POST", "/papeletas/{id_}/evidencias", "papeleta", "papeleta", archivos=True),
    Ep("DELETE", "/papeletas/{id_}/evidencias/{evidencia_id}", "papeleta", "papeleta"),
    # emergencias: solo operador (el técnico las ve vía /asignaciones)
    Ep("GET", "/emergencias", "operador"),
    Ep("GET", "/emergencias/{id_}", "operador", "emergencia"),
    Ep("POST", "/emergencias", "operador", json=lambda m, yo: {}),
    Ep("PATCH", "/emergencias/{id_}/estado", "operador", "emergencia", json=lambda m, yo: {"estado": "cerrada"}),
    Ep("GET", "/emergencias/{id_}/candidatos", "operador", "emergencia"),
    Ep(
        "POST",
        "/emergencias/{id_}/despachar",
        "operador",
        "emergencia",
        json=lambda m, yo: {"tecnico_ids": [m.tec_b["id"]], "operador_id": yo},
    ),
    # asignaciones
    Ep("GET", "/asignaciones", "autenticado"),
    Ep("POST", "/asignaciones/{id_}/aceptar", "asignacion", "asignacion"),
    Ep("POST", "/asignaciones/{id_}/rechazar", "asignacion", "asignacion"),
    # geo y dashboard: solo operador
    Ep("GET", "/tecnicos/cercanos", "operador", params=lambda m, yo: {"lat": -33.4, "lon": -70.6}),
    Ep("GET", "/mapa", "operador"),
    Ep("GET", "/dashboard/calendario", "operador", params=lambda m, yo: {"mes": "2026-10"}),
    # mensajes: el usuario del parámetro debe ser el del token
    Ep("GET", "/mensajes/conversaciones", "propio", params=lambda m, yo: {"usuario_id": yo}),
    Ep(
        "GET",
        "/mensajes/hilo",
        "propio",
        params=lambda m, yo: {"usuario_id": yo, "contraparte_id": m.operador["id"]},
    ),
    Ep("POST", "/mensajes", "propio", json=_cuerpo_mensaje),
    Ep(
        "POST",
        "/mensajes/leer",
        "propio",
        json=lambda m, yo: {"usuario_id": yo, "contraparte_id": m.operador["id"]},
    ),
    # solo requieren estar autenticados
    Ep("GET", "/auth/me", "autenticado"),
    Ep(
        "POST",
        "/auth/cambiar-password",
        "autenticado",
        json=lambda m, yo: {"password_actual": "x", "password_nueva": "y"},
    ),
]

# Públicos (sin token): salud y login.
PUBLICOS = {"GET /health", "POST /auth/login"}


def _solicitud(m: Mundo, ep: Ep, yo: str | None = None, recurso_propio: str | None = None) -> dict:
    """kwargs de `client.request` para este endpoint. `yo` es el usuario que figura en los
    parámetros de tipo `propio`; `recurso_propio` fuerza el `{id_}` (para `usuarios`)."""
    yo = yo or m.operador["id"]
    ids = {
        "id_": (m.ids.get(ep.recurso) if ep.recurso in m.ids else None) or recurso_propio or str(uuid4()),
        "item_id": m.ids["item"],
        "pieza_id": str(uuid4()),
        "evidencia_id": str(uuid4()),
        "codigo_qr": m.qr,
    }
    if ep.recurso == "tec_b":
        ids["id_"] = m.tec_b["id"]
    kwargs: dict = {"url": API + ep.ruta.format(**ids)}
    if ep.json:
        kwargs["json"] = ep.json(m, yo)
    if ep.params:
        kwargs["params"] = ep.params(m, yo)
    if ep.archivos:
        kwargs["files"] = {"archivo": ("foto.jpg", JPEG, "image/jpeg")}
    return kwargs


def _permitido(r) -> bool:
    """Pasó la autorización: puede dar 200/201/204/404/409/422..., pero nunca 401/403."""
    return r.status_code not in (401, 403) and r.status_code < 500


async def _enviar(cliente, ep: Ep, kwargs: dict, headers: dict | None = None):
    return await cliente.request(ep.metodo, headers=headers, **kwargs)


@pytest.mark.parametrize("ep", MATRIZ, ids=[e.clave for e in MATRIZ])
async def test_matriz_de_autorizacion(ep: Ep, mundo: Mundo, client, cliente_anonimo, cliente_como):
    m = mundo
    tec_a = cliente_como(m.tec_a["id"], "tecnico")
    tec_b = cliente_como(m.tec_b["id"], "tecnico")
    a, b, op = m.tec_a["id"], m.tec_b["id"], m.operador["id"]

    # Sin token: siempre 401 con WWW-Authenticate.
    r = await _enviar(cliente_anonimo, ep, _solicitud(m, ep))
    assert r.status_code == 401, f"anónimo -> {r.status_code} {r.text}"
    assert r.headers["www-authenticate"] == "Bearer"

    if ep.tipo == "operador":
        r = await _enviar(tec_b, ep, _solicitud(m, ep, b))
        assert r.status_code == 403, f"técnico -> {r.status_code} {r.text}"
        r = await _enviar(client, ep, _solicitud(m, ep, op))
        assert _permitido(r), f"operador -> {r.status_code} {r.text}"

    elif ep.tipo == "autenticado":
        for quien, cli, yo in (("técnico", tec_b, b), ("operador", client, op)):
            r = await _enviar(cli, ep, _solicitud(m, ep, yo))
            assert _permitido(r), f"{quien} -> {r.status_code} {r.text}"

    elif ep.tipo in ("orden", "papeleta"):
        r = await _enviar(tec_b, ep, _solicitud(m, ep, b))
        assert r.status_code == 403, f"técnico ajeno -> {r.status_code} {r.text}"
        for quien, cli, yo in (("técnico dueño", tec_a, a), ("operador", client, op)):
            r = await _enviar(cli, ep, _solicitud(m, ep, yo))
            assert _permitido(r), f"{quien} -> {r.status_code} {r.text}"

    elif ep.tipo == "asignacion":
        r = await _enviar(client, ep, _solicitud(m, ep, op))
        assert r.status_code == 403, f"operador -> {r.status_code} {r.text}"
        r = await _enviar(tec_b, ep, _solicitud(m, ep, b))
        assert r.status_code == 403, f"técnico ajeno -> {r.status_code} {r.text}"
        r = await _enviar(tec_a, ep, _solicitud(m, ep, a))
        assert _permitido(r), f"técnico dueño -> {r.status_code} {r.text}"

    elif ep.tipo == "propio":
        # Con su propio id pasa; con el de otro, 403 (aunque el actor sea operador).
        sol = lambda yo: _solicitud(m, ep, yo, recurso_propio=yo)  # noqa: E731
        r = await _enviar(tec_a, ep, sol(a))
        assert _permitido(r), f"técnico, id propio -> {r.status_code} {r.text}"
        r = await _enviar(tec_a, ep, sol(b))
        assert r.status_code == 403, f"técnico, id ajeno -> {r.status_code} {r.text}"
        r = await _enviar(tec_a, ep, sol(op))
        assert r.status_code == 403, f"técnico, id del operador -> {r.status_code} {r.text}"
        r = await _enviar(client, ep, sol(op))
        assert _permitido(r), f"operador, id propio -> {r.status_code} {r.text}"
        r = await _enviar(client, ep, sol(a))
        assert r.status_code == 403, f"operador, id ajeno -> {r.status_code} {r.text}"

    elif ep.tipo == "usuario_get":
        r = await _enviar(tec_a, ep, _solicitud(m, ep, a, recurso_propio=a))
        assert r.status_code == 200, f"técnico, propio -> {r.status_code} {r.text}"
        r = await _enviar(tec_a, ep, _solicitud(m, ep, a, recurso_propio=b))
        assert r.status_code == 403, f"técnico, otro -> {r.status_code} {r.text}"
        r = await _enviar(tec_a, ep, _solicitud(m, ep, a, recurso_propio=op))
        assert r.status_code == 403, f"técnico, operador -> {r.status_code} {r.text}"
        for objetivo in (a, b, op):
            r = await _enviar(client, ep, _solicitud(m, ep, op, recurso_propio=objetivo))
            assert r.status_code == 200, f"operador, {objetivo} -> {r.status_code} {r.text}"

    else:  # pragma: no cover
        pytest.fail(f"tipo desconocido {ep.tipo}")


def test_la_matriz_cubre_todos_los_endpoints_de_la_api():
    # El esquema OpenAPI lista todas las operaciones, vengan de donde vengan.
    rutas = {
        f"{metodo.upper()} {ruta.removeprefix(API)}"
        for ruta, operaciones in app.openapi()["paths"].items()
        if ruta.startswith(API + "/")
        for metodo in operaciones
    }
    assert len(rutas) > 50
    clasificadas = {e.clave for e in MATRIZ} | PUBLICOS
    assert rutas - clasificadas == set(), "endpoints sin clasificar en la matriz de autorización"
    assert clasificadas - rutas == set(), "la matriz lista endpoints que ya no existen"
    assert len(MATRIZ) == len({e.clave for e in MATRIZ})


async def test_endpoints_publicos_funcionan_sin_token(cliente_anonimo):
    assert (await cliente_anonimo.get(f"{API}/health")).status_code == 200
    r = await cliente_anonimo.post(f"{API}/auth/login", json={"email": "a@b.cl", "password": "x"})
    assert r.status_code == 401  # llega al login (credenciales malas), no se corta por falta de token


# --- Propiedad: un técnico no ve ni modifica lo de otro técnico -------------------------


@pytest.fixture
async def dos_tecnicos(client, almacenamiento):
    """Dos técnicos, cada uno con su OT, papeleta, y un mensaje con el operador."""
    edificio = await crear_edificio(client)
    ascensor = await crear_ascensor(client, edificio["id"])
    datos = {}
    for clave in ("a", "b"):
        tec = await crear_tecnico(client, nombre=f"Técnico {clave.upper()}", ubicacion=COSTANERA_CENTER)
        r = await client.post(
            f"{API}/ordenes-trabajo",
            json={
                "tipo": "mantencion",
                "prioridad": "media",
                "ascensor_id": ascensor["id"],
                "tecnico_id": tec["id"],
                "fecha_programada": datetime.now(UTC).isoformat(),
            },
        )
        orden = r.json()
        papeleta = (await client.post(f"{API}/ordenes-trabajo/{orden['id']}/papeleta")).json()
        datos[clave] = {"tec": tec, "orden": orden, "papeleta": papeleta}
    return datos


async def test_tecnico_solo_ve_sus_ordenes_en_el_listado(dos_tecnicos, cliente_como, client):
    a, b = dos_tecnicos["a"], dos_tecnicos["b"]
    tec_a = cliente_como(a["tec"]["id"])

    # Sin filtro: se fuerza el propio.
    r = await tec_a.get(f"{API}/ordenes-trabajo", params={"limit": 100})
    assert r.status_code == 200
    ids = {o["id"] for o in r.json()["items"]}
    assert ids == {a["orden"]["id"]}
    assert r.json()["total"] == 1

    # Con su propio id: igual.
    r = await tec_a.get(f"{API}/ordenes-trabajo", params={"tecnico_id": a["tec"]["id"]})
    assert {o["id"] for o in r.json()["items"]} == {a["orden"]["id"]}

    # Con el de otro: 403.
    r = await tec_a.get(f"{API}/ordenes-trabajo", params={"tecnico_id": b["tec"]["id"]})
    assert r.status_code == 403

    # El operador ve todas.
    r = await client.get(f"{API}/ordenes-trabajo", params={"limit": 100})
    assert {a["orden"]["id"], b["orden"]["id"]} <= {o["id"] for o in r.json()["items"]}


async def test_tecnico_no_accede_a_la_orden_de_otro(dos_tecnicos, cliente_como):
    a, b = dos_tecnicos["a"], dos_tecnicos["b"]
    tec_a = cliente_como(a["tec"]["id"])
    orden_b = b["orden"]["id"]

    assert (await tec_a.get(f"{API}/ordenes-trabajo/{a['orden']['id']}")).status_code == 200
    assert (await tec_a.get(f"{API}/ordenes-trabajo/{orden_b}")).status_code == 403
    assert (await tec_a.post(f"{API}/ordenes-trabajo/{orden_b}/iniciar")).status_code == 403
    assert (await tec_a.post(f"{API}/ordenes-trabajo/{orden_b}/completar")).status_code == 403
    assert (await tec_a.post(f"{API}/ordenes-trabajo/{orden_b}/papeleta")).status_code == 403
    # Y la orden de B no cambió.
    tec_b = cliente_como(b["tec"]["id"])
    assert (await tec_b.get(f"{API}/ordenes-trabajo/{orden_b}")).json()["estado"] == "programado"


async def test_tecnico_no_puede_gestionar_ordenes_aunque_sean_suyas(dos_tecnicos, cliente_como):
    a = dos_tecnicos["a"]
    tec_a = cliente_como(a["tec"]["id"])
    orden = a["orden"]["id"]
    assert (await tec_a.patch(f"{API}/ordenes-trabajo/{orden}", json={"prioridad": "alta"})).status_code == 403
    assert (await tec_a.post(f"{API}/ordenes-trabajo/{orden}/cancelar")).status_code == 403
    r = await tec_a.post(
        f"{API}/ordenes-trabajo",
        json={
            "tipo": "mantencion",
            "prioridad": "media",
            "ascensor_id": a["orden"]["ascensor"]["id"],
            "tecnico_id": a["tec"]["id"],
            "fecha_programada": datetime.now(UTC).isoformat(),
        },
    )
    assert r.status_code == 403


async def test_tecnico_no_accede_a_la_papeleta_de_otro(dos_tecnicos, cliente_como):
    a, b = dos_tecnicos["a"], dos_tecnicos["b"]
    tec_a = cliente_como(a["tec"]["id"])
    pap_b = b["papeleta"]["id"]

    assert (await tec_a.get(f"{API}/papeletas/{a['papeleta']['id']}")).status_code == 200
    assert (await tec_a.get(f"{API}/papeletas/{pap_b}")).status_code == 403
    assert (await tec_a.patch(f"{API}/papeletas/{pap_b}", json={"observaciones": "hackeado"})).status_code == 403
    assert (await tec_a.post(f"{API}/papeletas/{pap_b}/enviar")).status_code == 403
    assert (await tec_a.post(f"{API}/papeletas/{pap_b}/piezas", json={"nombre": "X"})).status_code == 403
    r = await tec_a.post(
        f"{API}/papeletas/{pap_b}/evidencias", files={"archivo": ("f.jpg", JPEG, "image/jpeg")}
    )
    assert r.status_code == 403
    # La papeleta de B quedó intacta.
    tec_b = cliente_como(b["tec"]["id"])
    pap = (await tec_b.get(f"{API}/papeletas/{pap_b}")).json()
    assert pap["observaciones"] is None and pap["estado"] == "borrador"
    assert pap["piezas"] == [] and pap["evidencias"] == []


async def test_tecnico_dueno_si_puede_trabajar_su_orden_de_punta_a_punta(dos_tecnicos, cliente_como):
    a = dos_tecnicos["a"]
    tec_a = cliente_como(a["tec"]["id"])
    assert (await tec_a.post(f"{API}/ordenes-trabajo/{a['orden']['id']}/iniciar")).status_code == 200
    r = await tec_a.patch(f"{API}/papeletas/{a['papeleta']['id']}", json={"observaciones": "ok"})
    assert r.status_code == 200
    r = await tec_a.post(
        f"{API}/papeletas/{a['papeleta']['id']}/evidencias", files={"archivo": ("f.jpg", JPEG, "image/jpeg")}
    )
    assert r.status_code == 201
    assert (await tec_a.post(f"{API}/papeletas/{a['papeleta']['id']}/enviar")).status_code == 200
    assert (await tec_a.post(f"{API}/ordenes-trabajo/{a['orden']['id']}/completar")).status_code == 200


async def test_tecnico_no_ve_ni_modifica_la_ubicacion_de_otro(dos_tecnicos, cliente_como, client):
    a, b = dos_tecnicos["a"]["tec"], dos_tecnicos["b"]["tec"]
    tec_a = cliente_como(a["id"])
    antes = (await client.get(f"{API}/usuarios/{b['id']}")).json()["ultima_ubicacion"]

    assert (await tec_a.get(f"{API}/usuarios/{b['id']}")).status_code == 403
    r = await tec_a.post(f"{API}/usuarios/{b['id']}/ubicacion", json={"lat": -1.0, "lon": -1.0})
    assert r.status_code == 403
    # Ni siquiera el operador registra la ubicación de un técnico.
    r = await client.post(f"{API}/usuarios/{b['id']}/ubicacion", json={"lat": -1.0, "lon": -1.0})
    assert r.status_code == 403
    assert (await client.get(f"{API}/usuarios/{b['id']}")).json()["ultima_ubicacion"] == antes
    # La propia sí.
    r = await tec_a.post(f"{API}/usuarios/{a['id']}/ubicacion", json={"lat": -33.5, "lon": -70.7})
    assert r.status_code == 200
    assert r.json()["ultima_ubicacion"]["lat"] == pytest.approx(-33.5)
    # Y no hay forma de listar técnicos ni mapa.
    assert (await tec_a.get(f"{API}/usuarios")).status_code == 403
    assert (await tec_a.get(f"{API}/mapa")).status_code == 403
    assert (await tec_a.get(f"{API}/tecnicos/cercanos", params={"lat": -33.4, "lon": -70.6})).status_code == 403


async def test_tecnico_no_lee_ni_escribe_mensajes_de_otro(dos_tecnicos, cliente_como, client, operador_prueba):
    a, b = dos_tecnicos["a"]["tec"], dos_tecnicos["b"]["tec"]
    op = str(operador_prueba.id)
    tec_a, tec_b = cliente_como(a["id"]), cliente_como(b["id"])

    # B escribe al operador; A no puede leer esa conversación ni suplantar a B.
    r = await tec_b.post(
        f"{API}/mensajes", json={"remitente_id": b["id"], "destinatario_id": op, "texto": "secreto de B"}
    )
    assert r.status_code == 201
    r = await tec_a.get(f"{API}/mensajes/hilo", params={"usuario_id": b["id"], "contraparte_id": op})
    assert r.status_code == 403
    r = await tec_a.get(f"{API}/mensajes/conversaciones", params={"usuario_id": b["id"]})
    assert r.status_code == 403
    r = await tec_a.post(
        f"{API}/mensajes", json={"remitente_id": b["id"], "destinatario_id": op, "texto": "suplantado"}
    )
    assert r.status_code == 403
    r = await tec_a.post(f"{API}/mensajes/leer", json={"usuario_id": b["id"], "contraparte_id": op})
    assert r.status_code == 403
    # A ni siquiera ve el mensaje a través de su propio hilo con el operador.
    r = await tec_a.get(f"{API}/mensajes/hilo", params={"usuario_id": a["id"], "contraparte_id": op})
    assert r.status_code == 200 and r.json() == []
    # El operador sí puede leer el hilo, pero como él mismo.
    r = await client.get(f"{API}/mensajes/hilo", params={"usuario_id": op, "contraparte_id": b["id"]})
    assert [m["texto"] for m in r.json()] == ["secreto de B"]
    r = await client.get(f"{API}/mensajes/hilo", params={"usuario_id": b["id"], "contraparte_id": op})
    assert r.status_code == 403


async def test_asignaciones_solo_las_propias_y_solo_el_dueno_responde(client, cliente_como, operador_prueba):
    edificio = await crear_edificio(client)
    await crear_ascensor(client, edificio["id"])
    a = await crear_tecnico(client, nombre="Asig A", ubicacion=COSTANERA_CENTER)
    b = await crear_tecnico(client, nombre="Asig B", ubicacion=COSTANERA_CENTER)
    em = await crear_emergencia(client, edificio["id"])
    r = await client.post(
        f"{API}/emergencias/{em['id']}/despachar",
        json={"tecnico_ids": [a["id"], b["id"]], "operador_id": str(operador_prueba.id)},
    )
    asig_a, asig_b = r.json()["asignaciones"]
    tec_a, tec_b = cliente_como(a["id"]), cliente_como(b["id"])

    # Listado: sin filtro se fuerza el propio; con el de otro, 403.
    r = await tec_a.get(f"{API}/asignaciones", params={"estado": "todas"})
    assert [x["id"] for x in r.json()] == [asig_a["id"]]
    r = await tec_a.get(f"{API}/asignaciones", params={"tecnico_id": b["id"], "estado": "todas"})
    assert r.status_code == 403
    r = await client.get(f"{API}/asignaciones", params={"tecnico_id": b["id"], "estado": "todas"})
    assert [x["id"] for x in r.json()] == [asig_b["id"]]  # el operador ve las de cualquiera

    # Responder: ni el operador ni otro técnico.
    for accion in ("aceptar", "rechazar"):
        assert (await client.post(f"{API}/asignaciones/{asig_a['id']}/{accion}")).status_code == 403
        assert (await tec_b.post(f"{API}/asignaciones/{asig_a['id']}/{accion}")).status_code == 403
    # Sigue pendiente.
    pendientes = (await tec_a.get(f"{API}/asignaciones")).json()
    assert [x["id"] for x in pendientes] == [asig_a["id"]]
    # El dueño sí.
    assert (await tec_a.post(f"{API}/asignaciones/{asig_a['id']}/aceptar")).status_code == 200


async def test_despachar_exige_que_operador_id_sea_el_del_token(client, cliente_como, operador_prueba):
    edificio = await crear_edificio(client)
    await crear_ascensor(client, edificio["id"])
    a = await crear_tecnico(client, nombre="Desp A", ubicacion=COSTANERA_CENTER)
    em = await crear_emergencia(client, edificio["id"])
    otro = (
        await client.post(
            f"{API}/usuarios", json={"nombre": "Otro Op", "email": f"{uuid4().hex[:8]}@x.cl", "rol": "operador"}
        )
    ).json()
    r = await client.post(
        f"{API}/emergencias/{em['id']}/despachar", json={"tecnico_ids": [a["id"]], "operador_id": otro["id"]}
    )
    assert r.status_code == 403
    r = await client.post(
        f"{API}/emergencias/{em['id']}/despachar",
        json={"tecnico_ids": [a["id"]], "operador_id": str(operador_prueba.id)},
    )
    assert r.status_code == 200


async def test_lectura_de_catalogos_esta_abierta_al_tecnico_pero_no_la_escritura(dos_tecnicos, cliente_como):
    a = dos_tecnicos["a"]
    tec_a = cliente_como(a["tec"]["id"])
    ascensor = a["orden"]["ascensor"]["id"]
    for ruta in ("/edificios", "/ascensores", "/pautas"):
        assert (await tec_a.get(API + ruta)).status_code == 200
    assert (await tec_a.get(f"{API}/ascensores/{ascensor}")).status_code == 200
    assert (await tec_a.get(f"{API}/ascensores/{ascensor}/bitacora")).status_code == 200
    assert (await tec_a.patch(f"{API}/ascensores/{ascensor}", json={"manas": "x"})).status_code == 403
    for ruta in ("/clientes", "/administraciones", "/emergencias", "/dashboard/calendario?mes=2026-10"):
        assert (await tec_a.get(API + ruta)).status_code == 403


async def test_las_respuestas_de_ot_y_papeleta_no_exponen_datos_financieros(dos_tecnicos, cliente_como):
    """RNF-05: el técnico nunca ve información financiera. Hoy el modelo no tiene ningún
    campo de costo/precio/tarifa; este test falla si alguien lo agrega a OT, papeleta o equipo."""
    a = dos_tecnicos["a"]
    tec_a = cliente_como(a["tec"]["id"])
    respuestas = [
        await tec_a.get(f"{API}/ordenes-trabajo/{a['orden']['id']}"),
        await tec_a.get(f"{API}/ordenes-trabajo"),
        await tec_a.get(f"{API}/papeletas/{a['papeleta']['id']}"),
        await tec_a.get(f"{API}/ascensores/{a['orden']['ascensor']['id']}/bitacora"),
    ]
    prohibidas = ("costo", "precio", "tarifa", "valor", "monto", "factura", "cobro", "presupuesto")
    for r in respuestas:
        assert r.status_code == 200
        texto = r.text.lower()
        for palabra in prohibidas:
            assert f'"{palabra}' not in texto, f"{r.request.url}: campo financiero '{palabra}'"
