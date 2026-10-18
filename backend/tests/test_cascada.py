from datetime import UTC, datetime, timedelta

import pytest

from app.domain.cascada import (
    CascadaError,
    Paso,
    aceptar,
    avanzar_cascada,
    cancelar_abiertas,
    cascada_agotada,
    expira_at,
    nueva_cascada,
    rechazar,
    validar_despacho,
)
from app.domain.enums import EstadoAsignacion as E
from app.domain.enums import EstadoEmergencia

T0 = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)
TR = timedelta(minutes=5)


def _cascada(n: int = 3, t0: datetime = T0) -> list[Paso]:
    return [
        Paso(id=f"a{orden}", orden=orden, estado=estado, notificada_at=notif)
        for orden, estado, notif in nueva_cascada(n, t0)
    ]


def _aplicar(pasos: list[Paso], cambios) -> list[Paso]:
    por_id = {c.id: c for c in cambios}
    resultado = []
    for p in pasos:
        c = por_id.get(p.id)
        if c is None:
            resultado.append(p)
        else:
            resultado.append(
                Paso(p.id, p.orden, c.estado, c.notificada_at, c.respondida_at, c.motivo_rechazo)
            )
    return resultado


def _estados(pasos: list[Paso]) -> list[E]:
    return [p.estado for p in sorted(pasos, key=lambda p: p.orden)]


# --- nueva_cascada / expira_at ----------------------------------------------


def test_nueva_cascada_primero_pendiente_resto_en_espera():
    assert nueva_cascada(3, T0) == [
        (1, E.PENDIENTE, T0),
        (2, E.EN_ESPERA, None),
        (3, E.EN_ESPERA, None),
    ]


def test_nueva_cascada_respeta_orden_inicial():
    assert [o for o, _, _ in nueva_cascada(2, T0, orden_inicial=4)] == [4, 5]


def test_expira_at_solo_para_pendiente():
    assert expira_at(E.PENDIENTE, T0, TR) == T0 + TR
    assert expira_at(E.EN_ESPERA, None, TR) is None
    assert expira_at(E.ACEPTADA, T0, TR) is None


# --- avanzar_cascada: expiración ---------------------------------------------


def test_avanzar_antes_de_vencer_no_cambia_nada():
    assert avanzar_cascada(_cascada(), T0 + TR - timedelta(seconds=1), TR) == []


def test_avanzar_en_el_instante_exacto_expira():
    cambios = avanzar_cascada(_cascada(), T0 + TR, TR)
    assert [(c.id, c.estado) for c in cambios] == [("a1", E.EXPIRADA), ("a2", E.PENDIENTE)]


def test_expiracion_notifica_al_siguiente_desde_el_vencimiento_teorico():
    pasos = _aplicar(_cascada(), avanzar_cascada(_cascada(), T0 + timedelta(minutes=7), TR))
    a1, a2, a3 = pasos
    assert a1.estado == E.EXPIRADA and a1.respondida_at == T0 + TR
    assert a2.estado == E.PENDIENTE and a2.notificada_at == T0 + TR
    assert a3.estado == E.EN_ESPERA


def test_expiraciones_encadenadas_si_nadie_lee():
    pasos = _aplicar(_cascada(), avanzar_cascada(_cascada(), T0 + timedelta(minutes=12), TR))
    assert _estados(pasos) == [E.EXPIRADA, E.EXPIRADA, E.PENDIENTE]
    assert pasos[1].respondida_at == T0 + 2 * TR
    assert pasos[2].notificada_at == T0 + 2 * TR


def test_todas_expiran_cascada_agotada():
    pasos = _aplicar(_cascada(), avanzar_cascada(_cascada(), T0 + timedelta(hours=1), TR))
    assert _estados(pasos) == [E.EXPIRADA] * 3
    assert cascada_agotada(_estados(pasos))


def test_avanzar_es_idempotente():
    pasos = _aplicar(_cascada(), avanzar_cascada(_cascada(), T0 + timedelta(minutes=7), TR))
    assert avanzar_cascada(pasos, T0 + timedelta(minutes=7), TR) == []


def test_avanzar_no_hace_nada_si_alguien_acepto():
    pasos = [
        Paso("a1", 1, E.ACEPTADA, T0, T0),
        Paso("a2", 2, E.EN_ESPERA),  # inconsistente a propósito: no debe promoverse
    ]
    assert avanzar_cascada(pasos, T0 + timedelta(hours=1), TR) == []


def test_avanzar_promueve_si_no_hay_pendiente():
    pasos = [Paso("a1", 1, E.RECHAZADA, T0, T0), Paso("a2", 2, E.EN_ESPERA)]
    cambios = avanzar_cascada(pasos, T0 + timedelta(minutes=1), TR)
    assert [(c.id, c.estado, c.notificada_at) for c in cambios] == [
        ("a2", E.PENDIENTE, T0 + timedelta(minutes=1))
    ]


def test_avanzar_cascada_vacia():
    assert avanzar_cascada([], T0, TR) == []


# --- rechazar ----------------------------------------------------------------


def test_rechazo_avanza_al_siguiente_inmediatamente():
    ahora = T0 + timedelta(minutes=1)
    pasos = _aplicar(_cascada(), rechazar(_cascada(), "a1", ahora, TR, "Estoy lejos"))
    a1, a2, a3 = pasos
    assert a1.estado == E.RECHAZADA
    assert a1.respondida_at == ahora
    assert a1.motivo_rechazo == "Estoy lejos"
    assert a2.estado == E.PENDIENTE and a2.notificada_at == ahora
    assert a3.estado == E.EN_ESPERA


def test_rechazo_del_ultimo_agota_la_cascada():
    pasos = _cascada(1)
    pasos = _aplicar(pasos, rechazar(pasos, "a1", T0, TR))
    assert cascada_agotada(_estados(pasos))


def test_no_se_puede_rechazar_en_espera():
    with pytest.raises(CascadaError):
        rechazar(_cascada(), "a2", T0, TR)


def test_no_se_puede_rechazar_si_ya_expiro():
    with pytest.raises(CascadaError):
        rechazar(_cascada(), "a1", T0 + timedelta(minutes=6), TR)


def test_rechazar_asignacion_ajena_falla():
    with pytest.raises(CascadaError):
        rechazar(_cascada(), "otra", T0, TR)


# --- aceptar -----------------------------------------------------------------


def test_aceptar_cancela_al_resto():
    ahora = T0 + timedelta(minutes=2)
    pasos = _aplicar(_cascada(), aceptar(_cascada(), "a1", ahora, TR))
    assert _estados(pasos) == [E.ACEPTADA, E.CANCELADA, E.CANCELADA]
    assert all(p.respondida_at == ahora for p in pasos)
    assert not cascada_agotada(_estados(pasos))


def test_aceptar_el_segundo_tras_expirar_el_primero():
    ahora = T0 + timedelta(minutes=6)
    pasos = _aplicar(_cascada(), aceptar(_cascada(), "a2", ahora, TR))
    assert _estados(pasos) == [E.EXPIRADA, E.ACEPTADA, E.CANCELADA]


def test_aceptar_expirada_falla():
    with pytest.raises(CascadaError):
        aceptar(_cascada(), "a1", T0 + TR, TR)


def test_aceptar_en_espera_falla():
    with pytest.raises(CascadaError):
        aceptar(_cascada(), "a3", T0, TR)


def test_no_se_puede_aceptar_dos_veces():
    pasos = _aplicar(_cascada(), aceptar(_cascada(), "a1", T0, TR))
    with pytest.raises(CascadaError):
        aceptar(pasos, "a1", T0, TR)


# --- cancelar / re-despacho --------------------------------------------------


def test_cancelar_abiertas_respeta_las_cerradas():
    pasos = _aplicar(_cascada(), rechazar(_cascada(), "a1", T0, TR))
    cambios = cancelar_abiertas(pasos, T0 + timedelta(minutes=1))
    assert {c.id: c.estado for c in cambios} == {"a2": E.CANCELADA, "a3": E.CANCELADA}


def test_re_despacho_tras_cascada_agotada():
    pasos = _aplicar(_cascada(2), avanzar_cascada(_cascada(2), T0 + timedelta(hours=1), TR))
    estados = _estados(pasos)
    assert cascada_agotada(estados)
    validar_despacho(EstadoEmergencia.ACTIVA, estados, ["t9"])  # no lanza
    nueva = nueva_cascada(1, T0 + timedelta(hours=1), orden_inicial=3)
    pasos += [Paso(f"a{o}", o, e, n) for o, e, n in nueva]
    assert not cascada_agotada(_estados(pasos))
    assert _estados(pasos)[-1] == E.PENDIENTE


@pytest.mark.parametrize(
    ("estados", "esperado"),
    [
        ([], False),
        ([E.PENDIENTE], False),
        ([E.RECHAZADA, E.EN_ESPERA], False),
        ([E.ACEPTADA, E.CANCELADA], False),
        ([E.RECHAZADA, E.EXPIRADA], True),
        ([E.CANCELADA, E.CANCELADA], True),
    ],
)
def test_cascada_agotada(estados, esperado):
    assert cascada_agotada(estados) is esperado


def test_validar_despacho_emergencia_cerrada():
    with pytest.raises(CascadaError):
        validar_despacho(EstadoEmergencia.CERRADA, [], ["t1"])


def test_validar_despacho_con_aceptada():
    with pytest.raises(CascadaError):
        validar_despacho(EstadoEmergencia.EN_ATENCION, [E.ACEPTADA], ["t1"])


@pytest.mark.parametrize("tecnicos", [[], ["t1", "t1"]])
def test_validar_despacho_lista_invalida(tecnicos):
    with pytest.raises(ValueError):
        validar_despacho(EstadoEmergencia.ACTIVA, [], tecnicos)
