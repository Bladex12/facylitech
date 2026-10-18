"""Tokens JWT, contador de intentos en memoria y validación del secreto de arranque."""

import base64
import json
import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from app.infrastructure.config import (
    JWT_SECRET_DESARROLLO,
    Settings,
    resolver_jwt_secret,
)
from app.infrastructure.intentos_login import RegistroIntentosFallidos
from app.infrastructure.tokens import TokenInvalidoError, decodificar_token, emitir_token

SECRETO = "secreto-de-prueba-con-mas-de-32-caracteres!!"
AHORA = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)


def _b64url(datos: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(datos).encode()).rstrip(b"=").decode()


# --- Tokens -----------------------------------------------------------------


def test_emitir_y_decodificar_ida_y_vuelta():
    uid = uuid4()
    token, expira_at = emitir_token(uid, "tecnico", SECRETO, timedelta(hours=24))
    claims = decodificar_token(token, SECRETO)
    assert claims.usuario_id == uid
    assert claims.rol == "tecnico"
    assert claims.expira_at == expira_at.replace(microsecond=0)
    assert claims.expira_at - claims.emitido_at == timedelta(hours=24)


def test_el_token_lleva_los_claims_del_contrato():
    token, _ = emitir_token(uuid4(), "operador", SECRETO, timedelta(hours=12))
    claims = jwt.decode(token, SECRETO, algorithms=["HS256"])
    assert set(claims) == {"sub", "rol", "iat", "exp"}
    assert jwt.get_unverified_header(token)["alg"] == "HS256"


def test_token_expirado_se_rechaza():
    token, _ = emitir_token(
        uuid4(), "operador", SECRETO, timedelta(hours=1), ahora=datetime.now(UTC) - timedelta(hours=2)
    )
    with pytest.raises(TokenInvalidoError):
        decodificar_token(token, SECRETO)


def test_firma_invalida_se_rechaza():
    token, _ = emitir_token(uuid4(), "operador", SECRETO, timedelta(hours=1))
    with pytest.raises(TokenInvalidoError):
        decodificar_token(token, "otro-secreto-distinto-de-32-caracteres-o-mas")


def test_token_manipulado_se_rechaza():
    token, _ = emitir_token(uuid4(), "tecnico", SECRETO, timedelta(hours=1))
    cabecera, _, firma = token.split(".")
    escalado = _b64url({"sub": str(uuid4()), "rol": "operador", "iat": 1, "exp": 4102444800})
    with pytest.raises(TokenInvalidoError):
        decodificar_token(f"{cabecera}.{escalado}.{firma}", SECRETO)


def test_alg_none_se_rechaza():
    cuerpo = {"sub": str(uuid4()), "rol": "operador", "iat": 1, "exp": 4102444800}
    sin_firma = f"{_b64url({'alg': 'none', 'typ': 'JWT'})}.{_b64url(cuerpo)}."
    with pytest.raises(TokenInvalidoError):
        decodificar_token(sin_firma, SECRETO)


def test_otro_algoritmo_hmac_se_rechaza():
    token = jwt.encode(
        {"sub": str(uuid4()), "rol": "operador", "iat": 1, "exp": 4102444800}, SECRETO, algorithm="HS512"
    )
    with pytest.raises(TokenInvalidoError):
        decodificar_token(token, SECRETO)


@pytest.mark.parametrize("faltante", ["sub", "rol", "exp", "iat"])
def test_token_sin_claim_obligatorio_se_rechaza(faltante):
    claims = {"sub": str(uuid4()), "rol": "operador", "iat": 1, "exp": 4102444800}
    del claims[faltante]
    token = jwt.encode(claims, SECRETO, algorithm="HS256")
    with pytest.raises(TokenInvalidoError):
        decodificar_token(token, SECRETO)


def test_sub_que_no_es_uuid_se_rechaza():
    token = jwt.encode(
        {"sub": "no-es-uuid", "rol": "operador", "iat": 1, "exp": 4102444800}, SECRETO, algorithm="HS256"
    )
    with pytest.raises(TokenInvalidoError):
        decodificar_token(token, SECRETO)


@pytest.mark.parametrize("basura", ["", "abc", "a.b.c", "....", "Bearer x"])
def test_basura_se_rechaza(basura):
    with pytest.raises(TokenInvalidoError):
        decodificar_token(basura, SECRETO)


# --- Contador de intentos ----------------------------------------------------


def test_contador_bloquea_al_quinto_fallo_y_es_insensible_a_mayusculas():
    reg = RegistroIntentosFallidos()
    for i in range(4):
        reg.registrar_fallo("Ana@Facylitech.cl", AHORA + timedelta(seconds=i))
    assert reg.segundos_bloqueado("ana@facylitech.cl", AHORA + timedelta(seconds=4)) == 0
    reg.registrar_fallo(" ana@facylitech.cl ", AHORA + timedelta(seconds=4))
    assert reg.segundos_bloqueado("ANA@FACYLITECH.CL", AHORA + timedelta(seconds=5)) > 0


def test_contador_no_mezcla_correos():
    reg = RegistroIntentosFallidos()
    for _ in range(5):
        reg.registrar_fallo("a@x.cl", AHORA)
    assert reg.segundos_bloqueado("a@x.cl", AHORA) > 0
    assert reg.segundos_bloqueado("b@x.cl", AHORA) == 0


def test_contador_se_libera_pasada_la_ventana():
    reg = RegistroIntentosFallidos()
    for _ in range(5):
        reg.registrar_fallo("a@x.cl", AHORA)
    assert reg.segundos_bloqueado("a@x.cl", AHORA + timedelta(minutes=14)) > 0
    assert reg.segundos_bloqueado("a@x.cl", AHORA + timedelta(minutes=15)) == 0


def test_limpiar_olvida_los_fallos():
    reg = RegistroIntentosFallidos()
    for _ in range(5):
        reg.registrar_fallo("a@x.cl", AHORA)
    reg.limpiar("A@x.cl")
    assert reg.segundos_bloqueado("a@x.cl", AHORA) == 0
    assert len(reg) == 0


def test_contador_limpia_entradas_viejas():
    reg = RegistroIntentosFallidos()
    for i in range(50):
        reg.registrar_fallo(f"u{i}@x.cl", AHORA)
    assert len(reg) == 50
    # Un registro mucho más tarde purga las 50 entradas vencidas.
    reg.registrar_fallo("nuevo@x.cl", AHORA + timedelta(hours=1))
    assert len(reg) == 1


def test_contador_tiene_tope_de_claves():
    reg = RegistroIntentosFallidos()
    reg.MAX_CLAVES = 10
    for i in range(30):
        reg.registrar_fallo(f"u{i}@x.cl", AHORA + timedelta(seconds=i))
    assert len(reg) <= 10
    # Sobreviven los más recientes.
    assert "u29@x.cl" in reg._intentos


# --- Secreto de arranque -----------------------------------------------------


def test_desarrollo_sin_secreto_usa_el_de_desarrollo_con_warning(caplog):
    with caplog.at_level(logging.WARNING, logger="app.infrastructure.config"):
        assert resolver_jwt_secret("development", "") == JWT_SECRET_DESARROLLO
    assert any("JWT_SECRET" in r.message for r in caplog.records)


def test_desarrollo_con_secreto_lo_respeta_sin_warning(caplog):
    with caplog.at_level(logging.WARNING, logger="app.infrastructure.config"):
        assert resolver_jwt_secret("development", "corto") == "corto"
    assert not caplog.records


def test_el_secreto_de_desarrollo_cumple_el_largo_minimo():
    assert len(JWT_SECRET_DESARROLLO) >= 32


@pytest.mark.parametrize("entorno", ["production", "staging", "test", ""])
def test_fuera_de_desarrollo_sin_secreto_no_arranca(entorno):
    with pytest.raises(ValueError, match="JWT_SECRET"):
        resolver_jwt_secret(entorno, "")


def test_fuera_de_desarrollo_secreto_corto_no_arranca():
    with pytest.raises(ValueError, match="32"):
        resolver_jwt_secret("production", "x" * 31)


def test_fuera_de_desarrollo_secreto_largo_arranca():
    assert resolver_jwt_secret("production", "x" * 32) == "x" * 32


def test_settings_valida_el_secreto_al_construirse():
    with pytest.raises(ValueError):
        Settings(environment="production", jwt_secret="", _env_file=None)
    s = Settings(environment="production", jwt_secret="y" * 40, _env_file=None)
    assert s.jwt_secret == "y" * 40
    assert (s.jwt_ttl_operador_horas, s.jwt_ttl_tecnico_horas) == (12, 24)
