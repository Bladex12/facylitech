"""POST /ordenes-trabajo/replicar: vista previa, creación e idempotencia."""

from datetime import datetime

from tests.fabricas import crear_ascensor, crear_edificio, crear_tecnico, desactivar_usuario

API = "/api/v1"


async def _orden(client, ascensor_id, fecha, tecnico_id=None, tipo="mantencion"):
    r = await client.post(
        f"{API}/ordenes-trabajo",
        json={
            "tipo": tipo,
            "prioridad": "media",
            "ascensor_id": ascensor_id,
            "tecnico_id": tecnico_id,
            "fecha_programada": fecha,
            "descripcion": "Mantención mensual",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _mundo(client):
    edificio = await crear_edificio(client)
    a1 = await crear_ascensor(client, edificio["id"])
    a2 = await crear_ascensor(client, edificio["id"])
    a3 = await crear_ascensor(client, edificio["id"])
    tec = await crear_tecnico(client)
    # Cronograma de la empresa: mié 07 y jue 08 de octubre.
    o1 = await _orden(client, a1["id"], "2026-10-07T08:30:00-03:00", tec["id"])
    o2 = await _orden(client, a2["id"], "2026-10-08T14:00:00-03:00", tec["id"])
    # Una emergencia de octubre no se replica.
    await _orden(client, a3["id"], "2026-10-09T10:00:00-03:00", tec["id"], tipo="emergencia")
    return {"edificio": edificio, "a1": a1, "a2": a2, "a3": a3, "tec": tec, "o1": o1, "o2": o2}


async def test_simular_no_crea_nada_y_muestra_el_plan(client):
    m = await _mundo(client)
    r = await client.post(f"{API}/ordenes-trabajo/replicar", json={"mes": "2026-10"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["simulacion"] is True
    assert (data["mes_origen"], data["mes_destino"]) == ("2026-10", "2026-11")
    assert data["total_crear"] == 2
    fechas = {c["origen_codigo"]: datetime.fromisoformat(c["fecha_programada"]) for c in data["crear"]}
    assert fechas[m["o1"]["codigo"]] == datetime.fromisoformat("2026-11-04T08:30:00-03:00")
    assert fechas[m["o2"]["codigo"]] == datetime.fromisoformat("2026-11-05T14:00:00-03:00")
    assert all(c["codigo"] is None and c["tecnico_nombre"] == m["tec"]["nombre"] for c in data["crear"])

    nov = await client.get(f"{API}/ordenes-trabajo", params={"desde": "2026-11-01", "hasta": "2026-11-30"})
    assert nov.json()["total"] == 0


async def test_confirmar_crea_programadas_y_repetir_no_duplica(client):
    m = await _mundo(client)
    r = await client.post(f"{API}/ordenes-trabajo/replicar", json={"mes": "2026-10", "simular": False})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["simulacion"] is False
    codigos = [c["codigo"] for c in data["crear"]]
    assert all(c and c.startswith("WO-") for c in codigos)
    assert len(set(codigos)) == 2

    nov = (
        await client.get(f"{API}/ordenes-trabajo", params={"desde": "2026-11-01", "hasta": "2026-11-30"})
    ).json()
    assert nov["total"] == 2
    for o in nov["items"]:
        assert o["tipo"] == "mantencion"
        assert o["estado"] == "programado"
        assert o["tecnico"]["id"] == m["tec"]["id"]
        assert o["descripcion"] == "Mantención mensual"

    # Segunda vez: todo ya está programado en noviembre.
    r = await client.post(f"{API}/ordenes-trabajo/replicar", json={"mes": "2026-10", "simular": False})
    data = r.json()
    assert data["total_crear"] == 0
    assert {o["motivo"] for o in data["omitidas"]} == {"ya_programada"}
    assert len(data["omitidas"]) == 2


async def test_tecnico_inactivo_deja_la_ot_sin_asignar(client):
    m = await _mundo(client)
    await desactivar_usuario(m["tec"]["id"])
    r = await client.post(f"{API}/ordenes-trabajo/replicar", json={"mes": "2026-10", "simular": False})
    assert r.status_code == 200, r.text
    assert all(c["tecnico_nombre"] is None for c in r.json()["crear"])
    nov = (
        await client.get(f"{API}/ordenes-trabajo", params={"desde": "2026-11-01", "hasta": "2026-11-30"})
    ).json()
    assert all(o["tecnico"] is None for o in nov["items"])


async def test_mes_invalido_es_422(client):
    for mes in ("2026-13", "2026-1", "noviembre"):
        r = await client.post(f"{API}/ordenes-trabajo/replicar", json={"mes": mes})
        assert r.status_code == 422
