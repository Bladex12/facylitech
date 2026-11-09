"""crear_operador.py: arranque de una instalación real sin el seed de demostración."""

from httpx import ASGITransport, AsyncClient

import crear_operador as script


async def test_crea_operador_que_inicia_sesion_y_luego_lo_actualiza(
    db_session, _app_con_sesion, monkeypatch
):
    # El script abre su propia sesión: se le entrega la del test (transacción que se revierte).
    class _Sesion:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *exc):
            return False

    monkeypatch.setattr(script, "SessionLocal", lambda: _Sesion())

    usuario, creado = await script.crear_operador("Operadora Real", " Ops@Facylitech.cl ", "clave-segura-1")
    assert creado and usuario.email == "ops@facylitech.cl" and usuario.rol == "operador"

    async with AsyncClient(transport=ASGITransport(app=_app_con_sesion), base_url="http://test") as c:
        login = {"email": "ops@facylitech.cl", "password": "clave-segura-1"}
        r = await c.post("/api/v1/auth/login", json=login)
        assert r.status_code == 200, r.text

        _, creado = await script.crear_operador("Operadora Real", "ops@facylitech.cl", "otra-clave-22")
        assert not creado
        r = await c.post("/api/v1/auth/login", json={**login, "password": "otra-clave-22"})
        assert r.status_code == 200
