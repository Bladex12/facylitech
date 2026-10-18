from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.domain.enums import RolUsuario
from app.domain.mensajeria import MensajeDatos, resumir_conversaciones, rol_contraparte_por_defecto

T0 = datetime(2026, 10, 18, 9, 0, tzinfo=UTC)


def _m(rem, dest, minutos, leido=False):
    return MensajeDatos(uuid4(), rem, dest, T0 + timedelta(minutes=minutos), T0 if leido else None)


def test_rol_contraparte_por_defecto():
    assert rol_contraparte_por_defecto(RolUsuario.OPERADOR) == RolUsuario.TECNICO
    assert rol_contraparte_por_defecto(RolUsuario.TECNICO) == RolUsuario.OPERADOR


def test_una_conversacion_por_contraparte_ordenada_por_ultimo_mensaje():
    yo, a, b = uuid4(), uuid4(), uuid4()
    mensajes = [_m(yo, a, 1), _m(b, yo, 2), _m(a, yo, 5), _m(yo, b, 3)]
    resumen = resumir_conversaciones(yo, mensajes)
    assert [r.contraparte_id for r in resumen] == [a, b]
    assert resumen[0].ultimo_mensaje_id == mensajes[2].id
    assert resumen[1].ultimo_mensaje_id == mensajes[3].id


def test_no_leidos_cuenta_solo_lo_recibido_sin_leer():
    yo, a = uuid4(), uuid4()
    mensajes = [_m(a, yo, 1), _m(a, yo, 2, leido=True), _m(a, yo, 3), _m(yo, a, 4)]
    (resumen,) = resumir_conversaciones(yo, mensajes)
    assert resumen.no_leidos == 2


def test_contrapartes_por_defecto_sin_mensajes_van_al_final_sin_duplicar():
    yo, a, b, c = uuid4(), uuid4(), uuid4(), uuid4()
    resumen = resumir_conversaciones(yo, [_m(b, yo, 1)], [a, b, c, yo])
    assert [r.contraparte_id for r in resumen] == [b, a, c]
    assert resumen[1].ultimo_mensaje_id is None
    assert resumen[1].no_leidos == 0


def test_ignora_mensajes_de_terceros():
    yo, a, b = uuid4(), uuid4(), uuid4()
    assert resumir_conversaciones(yo, [_m(a, b, 1)]) == []


async def test_enviar_mensaje_con_orden_inexistente_da_404(client, db_session):
    import uuid as _uuid

    from app.infrastructure.db.models import Usuario

    a = Usuario(nombre="Op", email=f"op-{_uuid.uuid4()}@x.cl", rol="operador")
    b = Usuario(nombre="Tec", email=f"tec-{_uuid.uuid4()}@x.cl", rol="tecnico")
    db_session.add_all([a, b])
    await db_session.flush()
    resp = await client.post(
        "/api/v1/mensajes",
        json={
            "remitente_id": str(a.id),
            "destinatario_id": str(b.id),
            "texto": "hola",
            "orden_trabajo_id": str(_uuid.uuid4()),
        },
    )
    assert resp.status_code == 404
