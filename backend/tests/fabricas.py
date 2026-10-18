"""Helpers para crear datos de prueba vía API (tests de integración geo/cascada/evidencias)."""

from contextlib import contextmanager
from datetime import timedelta
from uuid import UUID, uuid4

from app.infrastructure.config import settings
from app.infrastructure.tokens import emitir_token

# Puntos reales de Santiago.
PLAZA_DE_ARMAS = (-33.4378, -70.6505)
COSTANERA_CENTER = (-33.4173, -70.6067)
ESTACION_CENTRAL = (-33.4510, -70.6790)
MAIPU = (-33.5100, -70.7570)


def token_para(usuario_id: UUID | str, rol: str, ttl: timedelta = timedelta(hours=1)) -> str:
    """Token válido firmado con el secreto de la app (para tests que no pasan por /auth/login)."""
    token, _ = emitir_token(UUID(str(usuario_id)), str(rol), settings.jwt_secret, ttl)
    return token


def headers_de(usuario_id: UUID | str, rol: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token_para(usuario_id, rol)}"}


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
            "activo": True,  # se desactiva al final: un inactivo ya no puede autenticarse
            "especialidades": list(especialidades),
            "estado_disponibilidad": "disponible" if disponible else "en_terreno",
        },
    )
    assert r.status_code == 201, r.text
    tecnico = r.json()
    if ubicacion is not None:
        # La ubicación solo la puede registrar el propio técnico: se autentica como él.
        r = await client.post(
            f"/api/v1/usuarios/{tecnico['id']}/ubicacion",
            json={"lat": ubicacion[0], "lon": ubicacion[1]},
            headers=headers_de(tecnico["id"], "tecnico"),
        )
        assert r.status_code == 200, r.text
        tecnico = r.json()
    if not activo:
        await desactivar_usuario(tecnico["id"])
        tecnico["activo"] = False
    return tecnico


async def desactivar_usuario(usuario_id) -> None:
    """Desactiva un usuario directamente en la BD de la sesión de test (no hay endpoint
    para ello). Usa la sesión que el fixture `client` inyectó en la app."""
    from app.infrastructure.db.models import Usuario
    from app.infrastructure.db.session import get_session
    from app.main import app

    async for sesion in app.dependency_overrides[get_session]():
        usuario = await sesion.get(Usuario, UUID(str(usuario_id)))
        usuario.activo = False
        await sesion.commit()


async def crear_operador(client):
    """Crea un operador y deja al `client` autenticado como él (hay endpoints, p.ej.
    despachar, que exigen que el `operador_id` del cuerpo sea el del token)."""
    r = await client.post(
        "/api/v1/usuarios",
        json={"nombre": "Operador", "email": f"op-{_sufijo()}@facylitech.cl", "rol": "operador"},
    )
    assert r.status_code == 201, r.text
    operador = r.json()
    client.headers.update(headers_de(operador["id"], "operador"))
    return operador


@contextmanager
def como(client, usuario):
    """Ejecuta el bloque autenticado como `usuario` (dict de la API con `id` y `rol`)
    y restaura la autenticación anterior del cliente al salir."""
    anterior = client.headers.get("Authorization")
    client.headers.update(headers_de(usuario["id"], usuario["rol"]))
    try:
        yield client
    finally:
        if anterior is None:
            client.headers.pop("Authorization", None)
        else:
            client.headers["Authorization"] = anterior


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
