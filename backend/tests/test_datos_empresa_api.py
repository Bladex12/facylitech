"""Integración de la sección 1 del contrato de octubre (backend-datos):
campos nuevos, PATCH de edificio/ascensor/orden, cancelar y mensajería."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.infrastructure.db.models import Usuario
from app.infrastructure.geo import punto_desde_coords
from tests.fabricas import como, desactivar_usuario, headers_de
from tests.test_ordenes_trabajo_api import _crear_administracion, _crear_edificio


async def _crear_usuario(client, nombre, email, rol, **extra):
    r = await client.post(
        "/api/v1/usuarios", json={"nombre": nombre, "email": email, "rol": rol, **extra}
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _crear_equipo(client, edificio_id, codigo, categoria=None):
    payload = {
        "edificio_id": edificio_id,
        "codigo": codigo,
        "codigo_qr": f"FCY-T-{codigo}",
        "tipo_equipo": "electromecanico",
    }
    if categoria:
        payload["categoria"] = categoria
    r = await client.post("/api/v1/ascensores", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


async def _crear_orden(client, ascensor_id, tecnico_id=None):
    r = await client.post(
        "/api/v1/ordenes-trabajo",
        json={
            "tipo": "mantencion",
            "prioridad": "media",
            "ascensor_id": ascensor_id,
            "tecnico_id": tecnico_id,
            "fecha_programada": "2026-11-04T08:30:00-03:00",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


# ─── Usuarios ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_usuario_out_incluye_rut_y_ultima_ubicacion(client, db_session):
    tec = await _crear_usuario(client, "Tec RUT", "rut@x.cl", "tecnico", rut="16.368.248-4")
    assert tec["rut"] == "16.368.248-4"
    assert tec["ultima_ubicacion"] is None
    assert tec["ultima_ubicacion_at"] is None

    usuario = (
        await db_session.execute(select(Usuario).where(Usuario.email == "rut@x.cl"))
    ).scalar_one()
    usuario.ultima_ubicacion = punto_desde_coords(-33.45, -70.66)
    usuario.ultima_ubicacion_at = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)
    await db_session.commit()

    r = await client.get(f"/api/v1/usuarios/{tec['id']}")
    assert r.status_code == 200
    data = r.json()
    assert data["ultima_ubicacion"] == pytest.approx({"lat": -33.45, "lon": -70.66})
    assert data["ultima_ubicacion_at"].startswith("2026-10-18T12:00:00")


# ─── Edificios ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_edificio_parcial_y_contactos(client):
    edificio = await _crear_edificio(client)
    assert edificio["contacto_nombre"] is None

    r = await client.patch(
        f"/api/v1/edificios/{edificio['id']}",
        json={
            "manas": "Puerta piso 3 se traba",
            "contacto_nombre": "Jaime Soto",
            "contacto_telefono": "(9) 6478 4239",
            "contacto_email": "jaime@prisma.py",
            "vencimiento_certificacion": "2027-03-01",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["manas"] == "Puerta piso 3 se traba"
    assert data["contacto_nombre"] == "Jaime Soto"
    assert data["vencimiento_certificacion"] == "2027-03-01"
    assert data["nombre"] == edificio["nombre"]  # no enviado -> intacto
    assert data["ubicacion"] == pytest.approx(edificio["ubicacion"])

    # null explícito en un campo anulable lo limpia
    r = await client.patch(f"/api/v1/edificios/{edificio['id']}", json={"manas": None})
    assert r.json()["manas"] is None
    assert r.json()["contacto_nombre"] == "Jaime Soto"


@pytest.mark.asyncio
async def test_patch_edificio_rechaza_null_en_nombre_y_404(client):
    edificio = await _crear_edificio(client)
    r = await client.patch(f"/api/v1/edificios/{edificio['id']}", json={"nombre": None})
    assert r.status_code == 422
    r = await client.patch(
        "/api/v1/edificios/00000000-0000-0000-0000-000000000000", json={"manas": "x"}
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_crear_edificio_tipo_publico(client):
    administracion = await _crear_administracion(client)
    r = await client.post(
        "/api/v1/edificios",
        json={
            "administracion_id": administracion["id"],
            "nombre": "Municipalidad",
            "direccion": "Calle Los Aromos 235",
            "comuna": "Vitacura",
            "tipo": "publico",
            "ubicacion": {"lat": -33.39, "lon": -70.57},
            "contacto_nombre": "Magali Ruiz",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["tipo"] == "publico"
    assert r.json()["contacto_nombre"] == "Magali Ruiz"


@pytest.mark.asyncio
async def test_clientes_tipos_nuevos(client):
    for tipo in ("administracion", "corporativo", "publico"):
        r = await client.post("/api/v1/clientes", json={"nombre": f"C {tipo}", "tipo": tipo})
        assert r.status_code == 201, r.text
        assert r.json()["tipo"] == tipo


# ─── Ascensores ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ascensor_categoria_por_defecto_y_filtro(client):
    edificio = await _crear_edificio(client)
    asc = await _crear_equipo(client, edificio["id"], "A1")
    await _crear_equipo(client, edificio["id"], "MC1", categoria="montacarga")
    await _crear_equipo(client, edificio["id"], "MP1", categoria="montaplatos")
    assert asc["categoria"] == "ascensor"

    r = await client.get(
        "/api/v1/ascensores", params={"edificio_id": edificio["id"], "categoria": "montacarga"}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["items"][0]["codigo"] == "MC1"

    r = await client.get("/api/v1/ascensores", params={"edificio_id": edificio["id"]})
    assert r.json()["total"] == 3

    r = await client.get("/api/v1/ascensores", params={"categoria": "escalera"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_ascensor(client):
    edificio = await _crear_edificio(client)
    asc = await _crear_equipo(client, edificio["id"], "A1")
    r = await client.patch(
        f"/api/v1/ascensores/{asc['id']}",
        json={"estado": "advertencia", "marca": "Otis", "pisos": 14, "torre": "Torre Sur"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert (data["estado"], data["marca"], data["pisos"], data["torre"]) == (
        "advertencia",
        "Otis",
        14,
        "Torre Sur",
    )
    assert data["codigo"] == "A1"
    assert data["edificio"]["id"] == edificio["id"]

    assert (await client.patch(f"/api/v1/ascensores/{asc['id']}", json={"estado": None})).status_code == 422
    assert (await client.patch(f"/api/v1/ascensores/{asc['id']}", json={"pisos": 0})).status_code == 422
    r = await client.patch("/api/v1/ascensores/00000000-0000-0000-0000-000000000000", json={})
    assert r.status_code == 404


# ─── Órdenes de trabajo ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_orden_reasigna_reprograma_y_prioridad(client):
    edificio = await _crear_edificio(client)
    asc = await _crear_equipo(client, edificio["id"], "A1")
    t1 = await _crear_usuario(client, "T1", "t1@x.cl", "tecnico")
    t2 = await _crear_usuario(client, "T2", "t2@x.cl", "tecnico")
    op = await _crear_usuario(client, "Op", "op@x.cl", "operador")
    orden = await _crear_orden(client, asc["id"], t1["id"])

    r = await client.patch(
        f"/api/v1/ordenes-trabajo/{orden['id']}",
        json={
            "tecnico_id": t2["id"],
            "fecha_programada": "2026-11-05T14:00:00-03:00",
            "prioridad": "alta",
            "descripcion": "Reprogramada por la administración",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["tecnico"]["id"] == t2["id"]
    assert data["prioridad"] == "alta"
    assert data["descripcion"] == "Reprogramada por la administración"
    assert datetime.fromisoformat(data["fecha_programada"]) == datetime.fromisoformat(
        "2026-11-05T14:00:00-03:00"
    )
    assert data["semaforo"] == "programado"

    # desasignar
    r = await client.patch(f"/api/v1/ordenes-trabajo/{orden['id']}", json={"tecnico_id": None})
    assert r.status_code == 200
    assert r.json()["tecnico"] is None

    # validaciones
    r = await client.patch(f"/api/v1/ordenes-trabajo/{orden['id']}", json={"tecnico_id": op["id"]})
    assert r.status_code == 422
    r = await client.patch(
        f"/api/v1/ordenes-trabajo/{orden['id']}",
        json={"tecnico_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert r.status_code == 404
    r = await client.patch(f"/api/v1/ordenes-trabajo/{orden['id']}", json={"fecha_programada": None})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_cancelar_orden_y_409_en_cerradas(client):
    edificio = await _crear_edificio(client)
    asc = await _crear_equipo(client, edificio["id"], "A1")
    orden = await _crear_orden(client, asc["id"])

    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/cancelar")
    assert r.status_code == 200
    assert r.json()["estado"] == "cancelado"

    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/cancelar")
    assert r.status_code == 409
    r = await client.patch(f"/api/v1/ordenes-trabajo/{orden['id']}", json={"prioridad": "baja"})
    assert r.status_code == 409

    r = await client.post("/api/v1/ordenes-trabajo/00000000-0000-0000-0000-000000000000/cancelar")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cancelar_orden_en_curso_ok(client):
    edificio = await _crear_edificio(client)
    asc = await _crear_equipo(client, edificio["id"], "A1")
    orden = await _crear_orden(client, asc["id"])
    await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/iniciar")
    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/cancelar")
    assert r.status_code == 200
    assert r.json()["estado"] == "cancelado"


# ─── Mensajería ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mensajeria_flujo_completo(client, operador_prueba):
    op = await _crear_usuario(client, "Operador Central", "op@x.cl", "operador")
    t1 = await _crear_usuario(client, "Ana Técnica", "t1@x.cl", "tecnico")
    t2 = await _crear_usuario(client, "Beto Técnico", "t2@x.cl", "tecnico")
    await _crear_usuario(client, "Inactivo", "t3@x.cl", "tecnico", activo=False)
    client.headers.update(headers_de(op["id"], "operador"))  # los mensajes se piden como `usuario_id`
    await desactivar_usuario(operador_prueba.id)  # el test asume un único operador activo

    # Operador sin mensajes ve igual a todos los técnicos activos
    r = await client.get("/api/v1/mensajes/conversaciones", params={"usuario_id": op["id"]})
    assert r.status_code == 200
    convs = r.json()
    assert [c["contraparte"]["nombre"] for c in convs] == ["Ana Técnica", "Beto Técnico"]
    assert all(c["ultimo_mensaje"] is None and c["no_leidos"] == 0 for c in convs)
    assert convs[0]["contraparte"]["rol"] == "tecnico"

    r = await client.post(
        "/api/v1/mensajes",
        json={"remitente_id": op["id"], "destinatario_id": t2["id"], "texto": "  ¿Llegaste a Torre Prisma?  "},
    )
    assert r.status_code == 201, r.text
    m1 = r.json()
    assert m1["texto"] == "¿Llegaste a Torre Prisma?"
    assert m1["remitente"] == {"id": op["id"], "nombre": "Operador Central"}
    assert m1["destinatario"]["id"] == t2["id"]
    assert m1["leido_at"] is None
    assert m1["orden_trabajo_id"] is None

    with como(client, t2):
        r = await client.post(
            "/api/v1/mensajes",
            json={"remitente_id": t2["id"], "destinatario_id": op["id"], "texto": "Sí, partiendo"},
        )
        assert r.status_code == 201
        r = await client.post(
            "/api/v1/mensajes",
            json={"remitente_id": t2["id"], "destinatario_id": op["id"], "texto": "Equipo 2 detenido"},
        )
        assert r.status_code == 201

    # Conversaciones del operador: Beto primero (último mensaje), 2 no leídos
    convs = (await client.get("/api/v1/mensajes/conversaciones", params={"usuario_id": op["id"]})).json()
    assert [c["contraparte"]["id"] for c in convs] == [t2["id"], t1["id"]]
    assert convs[0]["no_leidos"] == 2
    assert convs[0]["ultimo_mensaje"]["texto"] == "Equipo 2 detenido"

    # Técnico ve al operador
    with como(client, t1):
        convs_t = (
            await client.get("/api/v1/mensajes/conversaciones", params={"usuario_id": t1["id"]})
        ).json()
    assert [c["contraparte"]["id"] for c in convs_t] == [op["id"]]

    # Hilo ascendente
    hilo = (
        await client.get(
            "/api/v1/mensajes/hilo", params={"usuario_id": op["id"], "contraparte_id": t2["id"]}
        )
    ).json()
    assert [m["texto"] for m in hilo] == ["¿Llegaste a Torre Prisma?", "Sí, partiendo", "Equipo 2 detenido"]

    # Marcar leídos
    r = await client.post(
        "/api/v1/mensajes/leer", json={"usuario_id": op["id"], "contraparte_id": t2["id"]}
    )
    assert r.status_code == 204
    convs = (await client.get("/api/v1/mensajes/conversaciones", params={"usuario_id": op["id"]})).json()
    assert convs[0]["no_leidos"] == 0
    hilo = (
        await client.get(
            "/api/v1/mensajes/hilo", params={"usuario_id": op["id"], "contraparte_id": t2["id"]}
        )
    ).json()
    assert hilo[0]["leido_at"] is None  # el que envió el operador no lo marca él
    assert hilo[1]["leido_at"] is not None


@pytest.mark.asyncio
async def test_mensaje_validaciones(client):
    op = await _crear_usuario(client, "Op", "op@x.cl", "operador")
    t1 = await _crear_usuario(client, "T1", "t1@x.cl", "tecnico")
    client.headers.update(headers_de(op["id"], "operador"))

    r = await client.post(
        "/api/v1/mensajes", json={"remitente_id": op["id"], "destinatario_id": t1["id"], "texto": "   "}
    )
    assert r.status_code == 422
    r = await client.post(
        "/api/v1/mensajes", json={"remitente_id": op["id"], "destinatario_id": op["id"], "texto": "hola"}
    )
    assert r.status_code == 422
    r = await client.post(
        "/api/v1/mensajes",
        json={
            "remitente_id": op["id"],
            "destinatario_id": "00000000-0000-0000-0000-000000000000",
            "texto": "hola",
        },
    )
    assert r.status_code == 404
    # Un usuario_id que no es el del token (aunque no exista) es 403, no 404.
    r = await client.get(
        "/api/v1/mensajes/conversaciones", params={"usuario_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_mensaje_ligado_a_orden(client):
    edificio = await _crear_edificio(client)
    asc = await _crear_equipo(client, edificio["id"], "A1")
    op = await _crear_usuario(client, "Op", "op@x.cl", "operador")
    t1 = await _crear_usuario(client, "T1", "t1@x.cl", "tecnico")
    orden = await _crear_orden(client, asc["id"], t1["id"])
    with como(client, t1):
        r = await client.post(
            "/api/v1/mensajes",
            json={
                "remitente_id": t1["id"],
                "destinatario_id": op["id"],
                "texto": "Falta repuesto",
                "orden_trabajo_id": orden["id"],
            },
        )
    assert r.status_code == 201
    assert r.json()["orden_trabajo_id"] == orden["id"]
