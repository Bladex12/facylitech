"""Una papeleta enviada es el respaldo ante el cliente: no se edita ni se reenvía (409)."""

from tests.test_ordenes_trabajo_api import (
    _crear_ascensor,
    _crear_edificio,
    _crear_pauta,
    _crear_tecnico,
)

API = "/api/v1"


async def _papeleta_enviada(client):
    edificio = await _crear_edificio(client)
    ascensor = await _crear_ascensor(client, edificio["id"])
    tecnico = await _crear_tecnico(client)
    pauta = await _crear_pauta(client)
    orden = (
        await client.post(
            f"{API}/ordenes-trabajo",
            json={
                "tipo": "mantencion",
                "prioridad": "media",
                "ascensor_id": ascensor["id"],
                "tecnico_id": tecnico["id"],
                "pauta_id": pauta["id"],
                "fecha_programada": "2026-11-04T08:30:00-03:00",
            },
        )
    ).json()
    await client.post(f"{API}/ordenes-trabajo/{orden['id']}/iniciar")
    papeleta = (await client.post(f"{API}/ordenes-trabajo/{orden['id']}/papeleta")).json()
    papeleta = (
        await client.post(
            f"{API}/papeletas/{papeleta['id']}/piezas",
            json={"nombre": "Contacto", "marca": None, "es_original": True},
        )
    ).json()
    r = await client.post(f"{API}/papeletas/{papeleta['id']}/enviar")
    assert r.status_code == 200
    return r.json()


async def test_papeleta_enviada_no_se_modifica_ni_se_reenvia(client):
    p = await _papeleta_enviada(client)
    pid, item, pieza = p["id"], p["items"][0]["id"], p["piezas"][0]["id"]

    intentos = [
        await client.patch(f"{API}/papeletas/{pid}", json={"trabajo_realizado": "otro texto"}),
        await client.patch(f"{API}/papeletas/{pid}/items/{item}", json={"completado": True}),
        await client.post(
            f"{API}/papeletas/{pid}/piezas", json={"nombre": "X", "marca": None, "es_original": True}
        ),
        await client.delete(f"{API}/papeletas/{pid}/piezas/{pieza}"),
        await client.post(f"{API}/papeletas/{pid}/enviar"),
    ]
    assert [r.status_code for r in intentos] == [409] * 5
    assert "respaldo" in intentos[0].json()["detail"]

    final = (await client.get(f"{API}/papeletas/{pid}")).json()
    assert final["hora_fin"] == p["hora_fin"]
    assert final["trabajo_realizado"] == p["trabajo_realizado"]
    assert len(final["piezas"]) == 1
    assert final["items"][0]["completado"] is False
