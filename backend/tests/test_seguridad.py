"""Reglas puras de seguridad: hash scrypt, validación de contraseña, política anti fuerza bruta."""

import base64
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.seguridad import (
    MAX_INTENTOS_FALLIDOS,
    VENTANA_INTENTOS,
    hash_password,
    segundos_de_bloqueo,
    validar_password_nueva,
    verificar_password,
)

# Parámetros bajos para que los tests sean rápidos (el formato guarda N/r/p, así que
# verificar_password los lee del propio hash).
RAPIDO = {"n": 2**10}


def test_hash_tiene_el_formato_del_contrato():
    h = hash_password("facylitech2026", **RAPIDO)
    esquema, n, r, p, sal, derivado = h.split("$")
    assert (esquema, n, r, p) == ("scrypt", "1024", "8", "1")
    assert len(base64.b64decode(sal)) == 16
    assert len(base64.b64decode(derivado)) == 32
    assert len(h) < 200  # cabe en String(200)


def test_parametros_por_defecto_son_los_del_contrato():
    esquema, n, r, p, *_ = hash_password("x" * 8).split("$")
    assert (esquema, int(n), int(r), int(p)) == ("scrypt", 2**15, 8, 1)


def test_verificar_acepta_la_clave_correcta_y_rechaza_otras():
    h = hash_password("clave-correcta", **RAPIDO)
    assert verificar_password("clave-correcta", h) is True
    assert verificar_password("clave-incorrecta", h) is False
    assert verificar_password("", h) is False
    assert verificar_password("Clave-correcta", h) is False


def test_verificar_con_unicode():
    h = hash_password("contraseña-ñandú-🔒", **RAPIDO)
    assert verificar_password("contraseña-ñandú-🔒", h) is True
    assert verificar_password("contrasena-nandu-🔒", h) is False


def test_la_sal_es_aleatoria():
    a = hash_password("misma-clave", **RAPIDO)
    b = hash_password("misma-clave", **RAPIDO)
    assert a != b
    assert verificar_password("misma-clave", a) and verificar_password("misma-clave", b)


def test_verificar_usa_comparacion_en_tiempo_constante(monkeypatch):
    import hmac as hmac_mod

    llamadas = []
    original = hmac_mod.compare_digest

    def espia(a, b):
        llamadas.append((a, b))
        return original(a, b)

    monkeypatch.setattr("app.domain.seguridad.hmac.compare_digest", espia)
    h = hash_password("clave-correcta", **RAPIDO)
    verificar_password("clave-correcta", h)
    assert len(llamadas) == 1


@pytest.mark.parametrize(
    "hash_malo",
    [
        None,
        "",
        "texto-cualquiera",
        "scrypt",
        "scrypt$1024$8$1$solo$cinco",  # faltan campos
        "scrypt$1024$8$1$c2Fs$aGFzaA$extra",  # sobran campos
        "bcrypt$1024$8$1$c2Fs$aGFzaA==",  # esquema desconocido
        "scrypt$no-numero$8$1$c2Fs$aGFzaA==",
        "scrypt$1024$8$1$@@@@$aGFzaA==",  # base64 inválido
        "scrypt$1024$8$1$c2Fs$@@@@",
        "scrypt$1024$8$1$$aGFzaA==",  # sal vacía
        "scrypt$1024$8$1$c2Fs$",  # hash vacío
        "scrypt$1000$8$1$c2Fs$aGFzaA==",  # N no es potencia de 2
        "scrypt$1$8$1$c2Fs$aGFzaA==",  # N demasiado bajo
        "scrypt$0$8$1$c2Fs$aGFzaA==",
        "scrypt$1024$0$1$c2Fs$aGFzaA==",  # r inválido
        "scrypt$1024$8$0$c2Fs$aGFzaA==",  # p inválido
        f"scrypt${2**30}$8$1$c2Fs$aGFzaA==",  # N exagerado: no debe agotar memoria
    ],
)
def test_hash_mal_formado_devuelve_false_sin_lanzar(hash_malo):
    assert verificar_password("cualquiera", hash_malo) is False


def test_hash_manipulado_no_verifica():
    h = hash_password("clave-correcta", **RAPIDO)
    partes = h.split("$")
    partes[-1] = base64.b64encode(b"\x00" * 32).decode()
    assert verificar_password("clave-correcta", "$".join(partes)) is False


@pytest.mark.parametrize("password", ["12345678", "abcdefgh", "ñandúñandú", "a" * 200, " " * 8])
def test_password_nueva_valida(password):
    assert validar_password_nueva(password) is None


@pytest.mark.parametrize("password", ["", "1234567", "corta", "ñandú"])
def test_password_nueva_corta_da_mensaje(password):
    mensaje = validar_password_nueva(password)
    assert mensaje is not None and "8" in mensaje


# --- Anti fuerza bruta ------------------------------------------------------

AHORA = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)


def _fallos(*minutos_atras: float) -> list[datetime]:
    return [AHORA - timedelta(minutes=m) for m in minutos_atras]


def test_politica_por_defecto_son_5_intentos_en_15_minutos():
    assert MAX_INTENTOS_FALLIDOS == 5
    assert VENTANA_INTENTOS == timedelta(minutes=15)


def test_sin_intentos_no_hay_bloqueo():
    assert segundos_de_bloqueo([], AHORA) == 0


def test_cuatro_fallos_no_bloquean():
    assert segundos_de_bloqueo(_fallos(1, 2, 3, 4), AHORA) == 0


def test_cinco_fallos_bloquean_hasta_que_el_mas_antiguo_salga_de_la_ventana():
    # El más antiguo tiene 10 min: faltan 5 min (300 s) para que salga de la ventana de 15.
    assert segundos_de_bloqueo(_fallos(10, 4, 3, 2, 1), AHORA) == 300


def test_el_orden_de_la_lista_no_importa():
    assert segundos_de_bloqueo(_fallos(1, 2, 3, 4, 10), AHORA) == 300


def test_fallos_fuera_de_la_ventana_no_cuentan():
    assert segundos_de_bloqueo(_fallos(16, 20, 30, 40, 50, 1), AHORA) == 0
    assert segundos_de_bloqueo(_fallos(15, 1, 2, 3, 4), AHORA) == 0  # justo 15 min: ya salió


def test_mas_de_cinco_fallos_espera_por_el_quinto_mas_reciente():
    # 7 fallos: se libera cuando quedan 4 en la ventana, o sea cuando sale el 4º más reciente
    # (hace 8 min -> 7 min de espera).
    fallos = _fallos(14, 13, 12, 8, 3, 2, 1)
    # Con 7 fallos, el 5º más reciente es el de hace 12 min -> faltan 3 min.
    assert segundos_de_bloqueo(fallos, AHORA) == 180


def test_la_espera_minima_es_un_segundo():
    # El 5º más reciente sale de la ventana dentro de 0.2 s: se redondea hacia arriba a 1.
    casi = AHORA - VENTANA_INTENTOS + timedelta(milliseconds=200)
    fallos = [casi, *_fallos(3, 2, 1, 0.5)]
    assert segundos_de_bloqueo(fallos, AHORA) == 1


def test_politica_parametrizable():
    assert segundos_de_bloqueo(_fallos(1, 2), AHORA, maximo=2, ventana=timedelta(minutes=5)) == 180
    assert segundos_de_bloqueo(_fallos(1), AHORA, maximo=2, ventana=timedelta(minutes=5)) == 0
