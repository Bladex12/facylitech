"""Helpers para crear datos de prueba vía API (tests de integración geo/cascada/evidencias)."""

from uuid import uuid4

# Puntos reales de Santiago.
PLAZA_DE_ARMAS = (-33.4378, -70.6505)
COSTANERA_CENTER = (-33.4173, -70.6067)
ESTACION_CENTRAL = (-33.4510, -70.6790)
MAIPU = (-33.5100, -70.7570)


def _sufijo() -> str:
    return uuid4().hex[:8]


async def crear_edificio(client, ubicacion=PLAZA_DE_ARMAS, nombre="Edificio Geo"):
    r = await client.post("/api/v1/clientes", json={"nombre": "Cliente Geo", "tipo": "otro"})
    assert r.status_code == 201, r.text
    r = await client.post(
        "/api/v1/administraciones",
        json={"cliente_id": r.json()["id"], "nombre": "Administración Geo"},
    )
    assert r.status_code == 201, r.text
    r = await client.post(
        "/api/v1/edificios",
        json={
            "administracion_id": r.json()["id"],
            "nombre": nombre,
            "direccion": "Catedral 1000",
            "comuna": "Santiago",
            "tipo": "oficina",
            "ubicacion": {"lat": ubicacion[0], "lon": ubicacion[1]},
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def crear_ascensor(client, edificio_id, estado="operacional"):
    s = _sufijo()
    r = await client.post(
        "/api/v1/ascensores",
        json={
            "edificio_id": edificio_id,
            "codigo": f"ELV-{s}",
            "codigo_qr": f"FCY-{s}",
            "tipo_equipo": "electromecanico",
            "estado": estado,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def crear_tecnico(
    client,
    nombre="Técnico",
    ubicacion=None,
    disponible=True,
    especialidades=("mecanica",),
    activo=True,
):
    r = await client.post(
        "/api/v1/usuarios",
        json={
            "nombre": nombre,
            "email": f"{_sufijo()}@facylitech.cl",
            "rol": "tecnico",
            "activo": activo,
            "especialidades": list(especialidades),
            "estado_disponibilidad": "disponible" if disponible else "en_terreno",
        },
    )
    assert r.status_code == 201, r.text
    tecnico = r.json()
    if ubicacion is not None:
        r = await client.post(
            f"/api/v1/usuarios/{tecnico['id']}/ubicacion",
            json={"lat": ubicacion[0], "lon": ubicacion[1]},
        )
        assert r.status_code == 200, r.text
        tecnico = r.json()
    return tecnico


async def crear_operador(client):
    r = await client.post(
        "/api/v1/usuarios",
        json={"nombre": "Operador", "email": f"op-{_sufijo()}@facylitech.cl", "rol": "operador"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def crear_emergencia(client, edificio_id, tipo="persona_atrapada", ascensor_id=None):
    r = await client.post(
        "/api/v1/emergencias",
        json={
            "tipo": tipo,
            "edificio_id": edificio_id,
            "ascensor_id": ascensor_id,
            "descripcion": "Persona atrapada entre pisos 3 y 4",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()
