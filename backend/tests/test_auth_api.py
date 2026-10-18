"""Integración de la autenticación: login, /auth/me, cambiar contraseña, reset por
operador, tokens inválidos, anti fuerza bruta y que el hash nunca salga por la API."""

import base64
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
import pytest
from sqlalchemy import delete

from app.infrastructure.config import settings
from app.infrastructure.db.models import Usuario
from app.infrastructure.tokens import emitir_token
from tests.fabricas import desactivar_usuario, headers_de, token_para

API = "/api/v1"
PASSWORD = "clave-de-prueba-1"


async def _crear(client, rol="tecnico", password=PASSWORD, activo=True, nombre=None, email=None):
    cuerpo = {
        "nombre": nombre or f"Usuario {rol}",
        "email": email or f"{uuid4().hex[:10]}@facylitech.cl",
        "rol": rol,
        "activo": activo,
    }
    if password is not None:
        cuerpo["password"] = password
    r = await client.post(f"{API}/usuarios", json=cuerpo)
    assert r.status_code == 201, r.text
    return r.json()


async def _login(cliente, email, password=PASSWORD):
    return await cliente.post(f"{API}/auth/login", json={"email": email, "password": password})


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _b64url(datos: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(datos).encode()).rstrip(b"=").decode()


# --- Login ------------------------------------------------------------------


@pytest.mark.parametrize("rol,horas", [("operador", 12), ("tecnico", 24)])
async def test_login_ok_devuelve_token_con_la_duracion_del_rol(client, cliente_anonimo, rol, horas):
    u = await _crear(client, rol)
    r = await _login(cliente_anonimo, u["email"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert set(cuerpo) == {"access_token", "token_type", "expira_at", "usuario"}
    assert cuerpo["token_type"] == "bearer"
    expira = datetime.fromisoformat(cuerpo["expira_at"])
    assert expira.tzinfo is not None
    assert abs((expira - datetime.now(UTC)) - timedelta(hours=horas)) < timedelta(minutes=1)
    assert cuerpo["usuario"]["id"] == u["id"]
    assert cuerpo["usuario"]["rol"] == rol
    claims = jwt.decode(cuerpo["access_token"], settings.jwt_secret, algorithms=["HS256"])
    assert claims["sub"] == u["id"] and claims["rol"] == rol


async def test_login_ignora_mayusculas_y_espacios_del_correo(client, cliente_anonimo):
    u = await _crear(client, email="Mixto.Caso@Facylitech.cl")
    r = await _login(cliente_anonimo, "  mixto.caso@FACYLITECH.cl ")
    assert r.status_code == 200, r.text
    assert r.json()["usuario"]["id"] == u["id"]


async def test_el_token_del_login_sirve_en_auth_me(client, cliente_anonimo):
    u = await _crear(client)
    token = (await _login(cliente_anonimo, u["email"])).json()["access_token"]
    r = await cliente_anonimo.get(f"{API}/auth/me", headers=_bearer(token))
    assert r.status_code == 200
    assert r.json()["id"] == u["id"]


async def test_login_con_clave_mala_inexistente_inactivo_o_sin_hash_dan_el_mismo_401(
    client, cliente_anonimo
):
    ok = await _crear(client)
    inactivo = await _crear(client, activo=False)
    sin_hash = await _crear(client, password=None)

    respuestas = [
        await _login(cliente_anonimo, ok["email"], "clave-equivocada"),
        await _login(cliente_anonimo, "no-existe@facylitech.cl"),
        await _login(cliente_anonimo, inactivo["email"]),  # con la clave correcta
        await _login(cliente_anonimo, sin_hash["email"]),
    ]
    for r in respuestas:
        assert r.status_code == 401, r.text
        assert r.headers["www-authenticate"] == "Bearer"
        assert r.json() == respuestas[0].json()  # mismo cuerpo: no revela qué falló
    assert "detalle" in respuestas[0].json()


async def test_login_con_cuerpo_incompleto_es_422(cliente_anonimo):
    r = await cliente_anonimo.post(f"{API}/auth/login", json={"email": "a@b.cl"})
    assert r.status_code == 422


async def test_429_tras_cinco_intentos_fallidos_con_retry_after(client, cliente_anonimo):
    u = await _crear(client)
    for _ in range(5):
        assert (await _login(cliente_anonimo, u["email"], "mala-clave")).status_code == 401
    r = await _login(cliente_anonimo, u["email"], "mala-clave")
    assert r.status_code == 429
    assert 1 <= int(r.headers["retry-after"]) <= 15 * 60
    assert "detalle" in r.json()
    # Bloqueado incluso con la clave correcta.
    assert (await _login(cliente_anonimo, u["email"])).status_code == 429
    # Otro correo no se ve afectado.
    otro = await _crear(client)
    assert (await _login(cliente_anonimo, otro["email"])).status_code == 200


async def test_el_bloqueo_aplica_tambien_a_correos_inexistentes(cliente_anonimo):
    for _ in range(5):
        assert (await _login(cliente_anonimo, "fantasma@facylitech.cl")).status_code == 401
    assert (await _login(cliente_anonimo, "FANTASMA@facylitech.cl")).status_code == 429


async def test_un_login_correcto_reinicia_el_contador(client, cliente_anonimo):
    u = await _crear(client)
    for _ in range(4):
        await _login(cliente_anonimo, u["email"], "mala-clave")
    assert (await _login(cliente_anonimo, u["email"])).status_code == 200
    for _ in range(4):
        assert (await _login(cliente_anonimo, u["email"], "mala-clave")).status_code == 401
    assert (await _login(cliente_anonimo, u["email"])).status_code == 200


# --- /auth/me y tokens inválidos ---------------------------------------------


async def test_me_devuelve_al_usuario_autenticado(client, operador_prueba):
    r = await client.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["id"] == str(operador_prueba.id)
    assert r.json()["rol"] == "operador"


async def _assert_401(r):
    assert r.status_code == 401, r.text
    assert r.headers["www-authenticate"] == "Bearer"
    assert "detalle" in r.json()


async def test_me_sin_token_es_401(cliente_anonimo):
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me"))


@pytest.mark.parametrize(
    "cabecera", ["Bearer", "Bearer ", "Basic abc", "token-sin-esquema", "Bearer a.b.c", "Bearer basura"]
)
async def test_me_con_cabecera_mal_formada_es_401(cliente_anonimo, cabecera):
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers={"Authorization": cabecera}))


async def test_token_expirado_es_401(client, operador_prueba, cliente_anonimo):
    token, _ = emitir_token(
        operador_prueba.id,
        "operador",
        settings.jwt_secret,
        timedelta(hours=1),
        ahora=datetime.now(UTC) - timedelta(hours=2),
    )
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers=_bearer(token)))


async def test_token_con_firma_ajena_es_401(operador_prueba, cliente_anonimo):
    token, _ = emitir_token(
        operador_prueba.id, "operador", "otro-secreto-de-mas-de-treinta-y-dos-caracteres", timedelta(hours=1)
    )
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers=_bearer(token)))


async def test_token_manipulado_para_escalar_rol_es_401(client, cliente_anonimo):
    tecnico = await _crear(client, "tecnico")
    cabecera, _, firma = token_para(tecnico["id"], "tecnico").split(".")
    cuerpo = _b64url({"sub": tecnico["id"], "rol": "operador", "iat": 1, "exp": 4102444800})
    falso = f"{cabecera}.{cuerpo}.{firma}"
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers=_bearer(falso)))
    await _assert_401(await cliente_anonimo.get(f"{API}/usuarios", headers=_bearer(falso)))


async def test_token_con_alg_none_es_401(operador_prueba, cliente_anonimo):
    cuerpo = {"sub": str(operador_prueba.id), "rol": "operador", "iat": 1, "exp": 4102444800}
    sin_firma = f"{_b64url({'alg': 'none', 'typ': 'JWT'})}.{_b64url(cuerpo)}."
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers=_bearer(sin_firma)))


async def test_token_sin_sub_o_sin_rol_es_401(operador_prueba, cliente_anonimo):
    sin_rol = jwt.encode(
        {"sub": str(operador_prueba.id), "iat": 1, "exp": 4102444800}, settings.jwt_secret, "HS256"
    )
    sin_sub = jwt.encode({"rol": "operador", "iat": 1, "exp": 4102444800}, settings.jwt_secret, "HS256")
    for token in (sin_rol, sin_sub):
        await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers=_bearer(token)))


async def test_token_de_usuario_que_no_existe_es_401(cliente_anonimo):
    token = token_para(uuid4(), "operador")
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers=_bearer(token)))


async def test_token_valido_de_usuario_desactivado_es_401(client, cliente_anonimo):
    tecnico = await _crear(client, "tecnico")
    h = headers_de(tecnico["id"], "tecnico")
    assert (await cliente_anonimo.get(f"{API}/auth/me", headers=h)).status_code == 200
    await desactivar_usuario(tecnico["id"])
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers=h))
    await _assert_401(await cliente_anonimo.get(f"{API}/ordenes-trabajo", headers=h))


async def test_token_valido_de_usuario_eliminado_es_401(client, cliente_anonimo, db_session):
    tecnico = await _crear(client, "tecnico")
    h = headers_de(tecnico["id"], "tecnico")
    assert (await cliente_anonimo.get(f"{API}/auth/me", headers=h)).status_code == 200
    await db_session.execute(delete(Usuario).where(Usuario.id == UUID(tecnico["id"])))
    await db_session.commit()
    db_session.expunge_all()
    await _assert_401(await cliente_anonimo.get(f"{API}/auth/me", headers=h))


async def test_token_cuyo_rol_ya_no_coincide_con_la_bd_es_401(client, cliente_anonimo):
    tecnico = await _crear(client, "tecnico")
    # Token emitido como operador para un usuario que en la BD es técnico.
    await _assert_401(
        await cliente_anonimo.get(f"{API}/auth/me", headers=headers_de(tecnico["id"], "operador"))
    )


async def test_endpoints_publicos_no_piden_token(cliente_anonimo):
    assert (await cliente_anonimo.get(f"{API}/health")).status_code == 200
    # /media es público (las <img> no pueden mandar headers); una ruta inexistente es 404, no 401.
    assert (await cliente_anonimo.get("/media/no-existe/foto.jpg")).status_code == 404


async def test_los_errores_http_conservan_detail_y_agregan_detalle(cliente_anonimo):
    r = await cliente_anonimo.get(f"{API}/auth/me")
    assert r.json()["detalle"] == r.json()["detail"]


# --- Cambiar contraseña -------------------------------------------------------


async def test_cambiar_password_ok_y_se_puede_iniciar_sesion_con_la_nueva(client, cliente_anonimo):
    u = await _crear(client, "tecnico")
    token = (await _login(cliente_anonimo, u["email"])).json()["access_token"]
    r = await cliente_anonimo.post(
        f"{API}/auth/cambiar-password",
        headers=_bearer(token),
        json={"password_actual": PASSWORD, "password_nueva": "otra-clave-nueva"},
    )
    assert r.status_code == 204 and r.content == b""
    assert (await _login(cliente_anonimo, u["email"], PASSWORD)).status_code == 401
    assert (await _login(cliente_anonimo, u["email"], "otra-clave-nueva")).status_code == 200


@pytest.mark.parametrize(
    "actual,nueva",
    [
        ("incorrecta-total", "otra-clave-nueva"),  # actual equivocada
        (PASSWORD, "corta"),  # nueva < 8
        (PASSWORD, PASSWORD),  # igual a la actual
    ],
)
async def test_cambiar_password_invalido_es_400_y_no_cierra_sesion(client, cliente_anonimo, actual, nueva):
    u = await _crear(client, "tecnico")
    h = headers_de(u["id"], "tecnico")
    r = await cliente_anonimo.post(
        f"{API}/auth/cambiar-password", headers=h, json={"password_actual": actual, "password_nueva": nueva}
    )
    assert r.status_code == 400, r.text  # nunca 401: el front cierra sesión ante un 401
    assert "detalle" in r.json()
    assert (await _login(cliente_anonimo, u["email"], PASSWORD)).status_code == 200  # no cambió


async def test_cambiar_password_sin_token_es_401(cliente_anonimo):
    r = await cliente_anonimo.post(
        f"{API}/auth/cambiar-password", json={"password_actual": "x", "password_nueva": "y" * 10}
    )
    assert r.status_code == 401


async def test_cambiar_password_de_usuario_sin_hash_da_400(client, cliente_anonimo):
    u = await _crear(client, "tecnico", password=None)
    r = await cliente_anonimo.post(
        f"{API}/auth/cambiar-password",
        headers=headers_de(u["id"], "tecnico"),
        json={"password_actual": "lo-que-sea", "password_nueva": "clave-nueva-ok"},
    )
    assert r.status_code == 400


# --- Reset por operador / crear con contraseña ---------------------------------


async def test_operador_restablece_la_password_de_otro_usuario(client, cliente_anonimo):
    u = await _crear(client, "tecnico", password=None)
    assert (await _login(cliente_anonimo, u["email"], "clave-fijada-1")).status_code == 401
    r = await client.put(f"{API}/usuarios/{u['id']}/password", json={"password_nueva": "clave-fijada-1"})
    assert r.status_code == 204 and r.content == b""
    assert (await _login(cliente_anonimo, u["email"], "clave-fijada-1")).status_code == 200
    # Y reemplaza una clave anterior.
    await client.put(f"{API}/usuarios/{u['id']}/password", json={"password_nueva": "clave-fijada-2"})
    assert (await _login(cliente_anonimo, u["email"], "clave-fijada-1")).status_code == 401
    assert (await _login(cliente_anonimo, u["email"], "clave-fijada-2")).status_code == 200


async def test_reset_de_password_validaciones(client, cliente_anonimo):
    u = await _crear(client, "tecnico")
    r = await client.put(f"{API}/usuarios/{u['id']}/password", json={"password_nueva": "corta"})
    assert r.status_code == 422
    r = await client.put(f"{API}/usuarios/{uuid4()}/password", json={"password_nueva": "clave-larga-ok"})
    assert r.status_code == 404
    r = await cliente_anonimo.put(f"{API}/usuarios/{u['id']}/password", json={"password_nueva": "clave-larga-ok"})
    assert r.status_code == 401


async def test_tecnico_no_puede_restablecer_passwords(client, cliente_como):
    a = await _crear(client, "tecnico")
    b = await _crear(client, "tecnico")
    for objetivo in (a, b):  # ni la de otro ni la propia
        r = await cliente_como(a["id"]).put(
            f"{API}/usuarios/{objetivo['id']}/password", json={"password_nueva": "clave-larga-ok"}
        )
        assert r.status_code == 403


async def test_crear_usuario_con_password_corta_es_422(client):
    r = await client.post(
        f"{API}/usuarios",
        json={"nombre": "X", "email": f"{uuid4().hex[:8]}@x.cl", "rol": "tecnico", "password": "corta"},
    )
    assert r.status_code == 422


async def test_usuario_creado_sin_password_existe_pero_no_puede_entrar(client, cliente_anonimo):
    u = await _crear(client, password=None)
    assert (await client.get(f"{API}/usuarios/{u['id']}")).status_code == 200
    assert (await _login(cliente_anonimo, u["email"], "")).status_code == 401
    assert (await _login(cliente_anonimo, u["email"], "cualquier-cosa")).status_code == 401


# --- El hash nunca se expone ---------------------------------------------------


async def test_el_hash_no_aparece_en_ninguna_respuesta(client, cliente_anonimo, cliente_como):
    u = await _crear(client, "tecnico", nombre="Con Hash")
    await _crear(client, "operador")
    login = await _login(cliente_anonimo, u["email"])
    tec = cliente_como(u["id"], "tecnico")
    respuestas = [
        login,
        await tec.get(f"{API}/auth/me"),
        await tec.get(f"{API}/usuarios/{u['id']}"),
        await client.get(f"{API}/usuarios/{u['id']}"),
        await client.get(f"{API}/usuarios", params={"limit": 100}),
        await client.get(f"{API}/usuarios", params={"rol": "tecnico", "limit": 100}),
        await tec.get(f"{API}/mensajes/conversaciones", params={"usuario_id": u["id"]}),
        await client.get(f"{API}/tecnicos/cercanos", params={"lat": -33.4, "lon": -70.6, "limit": 50}),
        await client.get(f"{API}/mapa"),
        await tec.post(f"{API}/usuarios/{u['id']}/ubicacion", json={"lat": -33.4, "lon": -70.6}),
    ]
    for r in respuestas:
        assert r.status_code == 200, (r.request.url, r.text)
        assert "password_hash" not in r.text and "scrypt$" not in r.text, r.request.url
    creado = await client.post(
        f"{API}/usuarios",
        json={"nombre": "Nuevo", "email": f"{uuid4().hex[:8]}@x.cl", "rol": "tecnico", "password": PASSWORD},
    )
    assert creado.status_code == 201
    assert "password" not in creado.json() and "password_hash" not in creado.text
    assert PASSWORD not in creado.text


def test_ningun_schema_de_salida_declara_el_hash():
    from app.main import app

    esquemas = app.openapi()["components"]["schemas"]
    for nombre, esquema in esquemas.items():
        props = set(esquema.get("properties", {}))
        assert "password_hash" not in props, nombre
    # `password` solo existe en los cuerpos de entrada.
    con_password = {n for n, e in esquemas.items() if "password" in e.get("properties", {})}
    assert con_password == {"UsuarioCrear", "LoginIn"}


async def test_el_hash_si_se_guarda_en_la_bd(client, db_session):
    u = await _crear(client, "tecnico")
    fila = await db_session.get(Usuario, UUID(u["id"]))
    assert fila.password_hash.startswith("scrypt$")
    assert PASSWORD not in fila.password_hash
