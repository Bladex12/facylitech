from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import update

from app.infrastructure.db.models import AsignacionEmergencia
from tests.fabricas import (
    COSTANERA_CENTER,
    ESTACION_CENTRAL,
    MAIPU,
    crear_ascensor,
    crear_edificio,
    crear_emergencia,
    crear_operador,
    crear_tecnico,
)


async def _escenario(client, con_ascensor=True, ascensor_en_emergencia=False):
    edificio = await crear_edificio(client)
    ascensor = await crear_ascensor(client, edificio["id"]) if con_ascensor else None
    t1 = await crear_tecnico(client, nombre="T1", ubicacion=COSTANERA_CENTER)
    t2 = await crear_tecnico(client, nombre="T2", ubicacion=ESTACION_CENTRAL)
    t3 = await crear_tecnico(client, nombre="T3", ubicacion=MAIPU)
    operador = await crear_operador(client)
    emergencia = await crear_emergencia(
        client, edificio["id"], ascensor_id=ascensor["id"] if ascensor_en_emergencia else None
    )
    return {
        "edificio": edificio,
        "ascensor": ascensor,
        "tecnicos": [t1, t2, t3],
        "operador": operador,
        "emergencia": emergencia,
    }


async def _despachar(client, esc, tecnicos=None):
    tecnicos = tecnicos if tecnicos is not None else esc["tecnicos"]
    return await client.post(
        f"/api/v1/emergencias/{esc['emergencia']['id']}/despachar",
        json={"tecnico_ids": [t["id"] for t in tecnicos], "operador_id": esc["operador"]["id"]},
    )


async def _retroceder_notificacion(db_session, asignacion_id: str, minutos: int):
    """Simula el paso del tiempo moviendo `notificada_at` hacia atrás."""
    await db_session.execute(
        update(AsignacionEmergencia)
        .where(AsignacionEmergencia.id == UUID(asignacion_id))
        .values(notificada_at=datetime.now(UTC) - timedelta(minutes=minutos))
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_emergencia_out_ampliado_sin_despacho(client):
    esc = await _escenario(client)
    em = esc["emergencia"]
    assert em["asignaciones"] == []
    assert em["cascada_agotada"] is False
    assert em["orden_trabajo_id"] is None
    assert em["ubicacion"]["lat"] == pytest.approx(esc["edificio"]["ubicacion"]["lat"])

    r = await client.get("/api/v1/emergencias")
    assert r.status_code == 200
    assert "asignaciones" in r.json()["items"][0]


@pytest.mark.asyncio
async def test_despachar_crea_cascada_en_orden(client):
    esc = await _escenario(client)
    r = await _despachar(client, esc)
    assert r.status_code == 200, r.text
    asignaciones = r.json()["asignaciones"]
    assert [a["tecnico"]["nombre"] for a in asignaciones] == ["T1", "T2", "T3"]
    assert [a["orden"] for a in asignaciones] == [1, 2, 3]
    assert [a["estado"] for a in asignaciones] == ["pendiente", "en_espera", "en_espera"]
    primera = asignaciones[0]
    assert primera["notificada_at"] is not None
    expira = datetime.fromisoformat(primera["expira_at"]) - datetime.fromisoformat(
        primera["notificada_at"]
    )
    assert expira == timedelta(minutes=5)
    assert asignaciones[1]["expira_at"] is None
    assert primera["distancia_m"] > 0

    # El técnico ve solo su pendiente, con la emergencia embebida.
    r = await client.get("/api/v1/asignaciones", params={"tecnico_id": esc["tecnicos"][0]["id"]})
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["emergencia"]["codigo"] == esc["emergencia"]["codigo"]
    r = await client.get("/api/v1/asignaciones", params={"tecnico_id": esc["tecnicos"][1]["id"]})
    assert r.json() == []
    r = await client.get(
        "/api/v1/asignaciones",
        params={"tecnico_id": esc["tecnicos"][1]["id"], "estado": "todas"},
    )
    assert [a["estado"] for a in r.json()] == ["en_espera"]


@pytest.mark.asyncio
async def test_despachar_valida_entrada(client):
    esc = await _escenario(client)
    r = await _despachar(client, esc, tecnicos=[])
    assert r.status_code == 422
    r = await _despachar(client, esc, tecnicos=[esc["tecnicos"][0], esc["tecnicos"][0]])
    assert r.status_code == 422
    r = await _despachar(client, esc, tecnicos=[esc["operador"]])  # no es técnico
    assert r.status_code == 422
    r = await client.post(
        f"/api/v1/emergencias/{esc['emergencia']['id']}/despachar",
        json={"tecnico_ids": [esc["tecnicos"][0]["id"]], "operador_id": esc["tecnicos"][1]["id"]},
    )
    assert r.status_code == 422  # operador_id no es operador
    r = await client.post(
        "/api/v1/emergencias/00000000-0000-0000-0000-000000000000/despachar",
        json={"tecnico_ids": [esc["tecnicos"][0]["id"]], "operador_id": esc["operador"]["id"]},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_rechazo_avanza_y_cascada_agotada_y_re_despacho(client):
    esc = await _escenario(client)
    asignaciones = (await _despachar(client, esc, esc["tecnicos"][:2])).json()["asignaciones"]

    r = await client.post(
        f"/api/v1/asignaciones/{asignaciones[0]['id']}/rechazar", json={"motivo": "Sin batería"}
    )
    assert r.status_code == 200
    assert r.json()["estado"] == "rechazada"
    assert r.json()["motivo_rechazo"] == "Sin batería"

    em = (await client.get(f"/api/v1/emergencias/{esc['emergencia']['id']}")).json()
    assert [a["estado"] for a in em["asignaciones"]] == ["rechazada", "pendiente"]
    assert em["cascada_agotada"] is False

    # Rechazar sin body también vale.
    r = await client.post(f"/api/v1/asignaciones/{asignaciones[1]['id']}/rechazar")
    assert r.status_code == 200
    em = (await client.get(f"/api/v1/emergencias/{esc['emergencia']['id']}")).json()
    assert em["cascada_agotada"] is True

    # Rechazar de nuevo -> 409
    r = await client.post(f"/api/v1/asignaciones/{asignaciones[1]['id']}/rechazar")
    assert r.status_code == 409

    # Re-despacho: nueva cascada a continuación de la anterior.
    r = await _despachar(client, esc, [esc["tecnicos"][2]])
    assert r.status_code == 200
    em = r.json()
    assert [(a["orden"], a["estado"]) for a in em["asignaciones"]] == [
        (1, "rechazada"),
        (2, "rechazada"),
        (3, "pendiente"),
    ]
    assert em["cascada_agotada"] is False


@pytest.mark.asyncio
async def test_re_despacho_cancela_la_cascada_en_curso(client):
    esc = await _escenario(client)
    await _despachar(client, esc, esc["tecnicos"][:2])
    em = (await _despachar(client, esc, [esc["tecnicos"][2]])).json()
    assert [a["estado"] for a in em["asignaciones"]] == ["cancelada", "cancelada", "pendiente"]


@pytest.mark.asyncio
async def test_expiracion_perezosa(client, db_session):
    esc = await _escenario(client)
    asignaciones = (await _despachar(client, esc)).json()["asignaciones"]
    await _retroceder_notificacion(db_session, asignaciones[0]["id"], minutos=7)

    em = (await client.get(f"/api/v1/emergencias/{esc['emergencia']['id']}")).json()
    assert [a["estado"] for a in em["asignaciones"]] == ["expirada", "pendiente", "en_espera"]
    # El 2º se notificó en el vencimiento teórico del 1º (hace ~2 min), no "ahora".
    notificada = datetime.fromisoformat(em["asignaciones"][1]["notificada_at"])
    assert datetime.now(UTC) - notificada > timedelta(minutes=1)

    # Aceptar la expirada -> 409; la lista del técnico 1 ya no la muestra.
    r = await client.post(f"/api/v1/asignaciones/{asignaciones[0]['id']}/aceptar")
    assert r.status_code == 409
    r = await client.get("/api/v1/asignaciones", params={"tecnico_id": esc["tecnicos"][0]["id"]})
    assert r.json() == []
    r = await client.get("/api/v1/asignaciones", params={"tecnico_id": esc["tecnicos"][1]["id"]})
    assert [a["id"] for a in r.json()] == [asignaciones[1]["id"]]


@pytest.mark.asyncio
async def test_aceptar_crea_ot_y_cancela_al_resto(client):
    esc = await _escenario(client)
    asignaciones = (await _despachar(client, esc)).json()["asignaciones"]

    r = await client.post(f"/api/v1/asignaciones/{asignaciones[0]['id']}/aceptar")
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "aceptada"
    assert r.json()["expira_at"] is None

    em = (await client.get(f"/api/v1/emergencias/{esc['emergencia']['id']}")).json()
    assert em["estado"] == "en_atencion"
    assert [a["estado"] for a in em["asignaciones"]] == ["aceptada", "cancelada", "cancelada"]
    assert em["orden_trabajo_id"] is not None

    orden = (await client.get(f"/api/v1/ordenes-trabajo/{em['orden_trabajo_id']}")).json()
    assert orden["tipo"] == "emergencia"
    assert orden["prioridad"] == "critica"
    assert orden["estado"] == "programado"
    assert orden["tecnico"]["id"] == esc["tecnicos"][0]["id"]
    assert orden["emergencia_id"] == esc["emergencia"]["id"]
    # La emergencia no tenía ascensor: se usa el primero del edificio.
    assert orden["ascensor"]["id"] == esc["ascensor"]["id"]

    tecnico = (await client.get(f"/api/v1/usuarios/{esc['tecnicos'][0]['id']}")).json()
    assert tecnico["estado_disponibilidad"] == "en_terreno"

    # Ya hay un técnico que aceptó: no se puede re-despachar ni aceptar otra.
    assert (await _despachar(client, esc)).status_code == 409
    r = await client.post(f"/api/v1/asignaciones/{asignaciones[1]['id']}/aceptar")
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_aceptar_usa_el_ascensor_de_la_emergencia(client):
    esc = await _escenario(client, ascensor_en_emergencia=True)
    asignaciones = (await _despachar(client, esc)).json()["asignaciones"]
    await client.post(f"/api/v1/asignaciones/{asignaciones[0]['id']}/aceptar")
    em = (await client.get(f"/api/v1/emergencias/{esc['emergencia']['id']}")).json()
    orden = (await client.get(f"/api/v1/ordenes-trabajo/{em['orden_trabajo_id']}")).json()
    assert orden["ascensor"]["id"] == esc["ascensor"]["id"]


@pytest.mark.asyncio
async def test_aceptar_en_edificio_sin_equipos_es_409(client):
    esc = await _escenario(client, con_ascensor=False)
    asignaciones = (await _despachar(client, esc)).json()["asignaciones"]
    r = await client.post(f"/api/v1/asignaciones/{asignaciones[0]['id']}/aceptar")
    assert r.status_code == 409
    em = (await client.get(f"/api/v1/emergencias/{esc['emergencia']['id']}")).json()
    assert em["asignaciones"][0]["estado"] == "pendiente"  # nada quedó a medias


@pytest.mark.asyncio
async def test_cerrar_emergencia_cancela_asignaciones_abiertas(client):
    esc = await _escenario(client)
    asignaciones = (await _despachar(client, esc)).json()["asignaciones"]
    await client.post(f"/api/v1/asignaciones/{asignaciones[0]['id']}/rechazar")

    r = await client.patch(
        f"/api/v1/emergencias/{esc['emergencia']['id']}/estado", json={"estado": "cerrada"}
    )
    assert r.status_code == 200
    em = r.json()
    assert [a["estado"] for a in em["asignaciones"]] == ["rechazada", "cancelada", "cancelada"]
    assert em["cascada_agotada"] is False  # cerrada: no hay nada que re-despachar

    assert (await _despachar(client, esc)).status_code == 409
    r = await client.post(f"/api/v1/asignaciones/{asignaciones[1]['id']}/aceptar")
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_asignacion_inexistente_404(client):
    r = await client.post("/api/v1/asignaciones/00000000-0000-0000-0000-000000000000/aceptar")
    assert r.status_code == 404
    r = await client.post("/api/v1/asignaciones/00000000-0000-0000-0000-000000000000/rechazar")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_completar_ot_de_emergencia_cierra_y_libera_al_tecnico(client):
    esc = await _escenario(client)
    asignaciones = (await _despachar(client, esc)).json()["asignaciones"]
    await client.post(f"/api/v1/asignaciones/{asignaciones[0]['id']}/aceptar")
    em = (await client.get(f"/api/v1/emergencias/{esc['emergencia']['id']}")).json()
    ot_id = em["orden_trabajo_id"]

    assert (await client.post(f"/api/v1/ordenes-trabajo/{ot_id}/iniciar")).status_code == 200
    papeleta = (await client.post(f"/api/v1/ordenes-trabajo/{ot_id}/papeleta")).json()
    assert (await client.post(f"/api/v1/papeletas/{papeleta['id']}/enviar")).status_code == 200
    r = await client.post(f"/api/v1/ordenes-trabajo/{ot_id}/completar")
    assert r.status_code == 200, r.text

    em = (await client.get(f"/api/v1/emergencias/{esc['emergencia']['id']}")).json()
    assert em["estado"] == "cerrada"
    tecnico = (await client.get(f"/api/v1/usuarios/{esc['tecnicos'][0]['id']}")).json()
    assert tecnico["estado_disponibilidad"] == "disponible"
