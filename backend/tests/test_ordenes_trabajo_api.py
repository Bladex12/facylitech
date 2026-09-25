import pytest


async def _crear_edificio(client):
    payload = {
        "nombre": "Edificio Test",
        "direccion": "Calle Falsa 123",
        "comuna": "Santiago",
        "tipo": "oficina",
        "ubicacion": {"lat": -33.45, "lon": -70.66},
    }
    r = await client.post("/api/v1/edificios", json=payload)
    assert r.status_code == 201
    return r.json()


async def _crear_ascensor(client, edificio_id):
    r = await client.post(
        "/api/v1/ascensores",
        json={"edificio_id": edificio_id, "codigo": "ELV-TEST-1"},
    )
    assert r.status_code == 201
    return r.json()


async def _crear_tecnico(client):
    r = await client.post(
        "/api/v1/usuarios",
        json={"nombre": "Tec Test", "email": "tec-test@facylitech.cl", "rol": "tecnico"},
    )
    assert r.status_code == 201
    return r.json()


async def _crear_pauta(client):
    r = await client.post(
        "/api/v1/pautas",
        json={
            "nombre": "Pauta Test",
            "items": [{"orden": 1, "descripcion": "Item 1"}, {"orden": 2, "descripcion": "Item 2"}],
        },
    )
    assert r.status_code == 201
    return r.json()


@pytest.mark.asyncio
async def test_flujo_completo_orden_y_papeleta(client):
    edificio = await _crear_edificio(client)
    ascensor = await _crear_ascensor(client, edificio["id"])
    tecnico = await _crear_tecnico(client)
    pauta = await _crear_pauta(client)

    r = await client.post(
        "/api/v1/ordenes-trabajo",
        json={
            "tipo": "mantencion",
            "prioridad": "alta",
            "ascensor_id": ascensor["id"],
            "tecnico_id": tecnico["id"],
            "pauta_id": pauta["id"],
            "fecha_programada": "2026-09-20T15:00:00-04:00",
        },
    )
    assert r.status_code == 201
    orden = r.json()
    assert orden["semaforo"] == "vencido"
    assert orden["codigo"].startswith("WO-")

    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/completar")
    assert r.status_code == 409

    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/iniciar")
    assert r.status_code == 200
    assert r.json()["estado"] == "en_curso"

    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/iniciar")
    assert r.status_code == 409

    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/papeleta")
    assert r.status_code == 201
    papeleta = r.json()
    assert len(papeleta["checklist"]) == 2

    item_id = papeleta["checklist"][0]["id"]
    r = await client.patch(
        f"/api/v1/papeletas/{papeleta['id']}/items/{item_id}", json={"completado": True}
    )
    assert r.status_code == 200
    assert r.json()["completado"] is True

    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/completar")
    assert r.status_code == 409  # papeleta aún no enviada

    r = await client.post(f"/api/v1/papeletas/{papeleta['id']}/enviar")
    assert r.status_code == 200
    assert r.json()["estado"] == "enviada"

    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/completar")
    assert r.status_code == 200
    assert r.json()["estado"] == "completado"
    assert r.json()["semaforo"] == "completado"


@pytest.mark.asyncio
async def test_filtro_por_estado_y_tecnico(client):
    edificio = await _crear_edificio(client)
    ascensor = await _crear_ascensor(client, edificio["id"])
    tecnico = await _crear_tecnico(client)

    for i in range(3):
        await client.post(
            "/api/v1/ordenes-trabajo",
            json={
                "tipo": "mantencion",
                "prioridad": "media",
                "ascensor_id": ascensor["id"],
                "tecnico_id": tecnico["id"],
                "fecha_programada": f"2026-10-0{i + 1}T10:00:00-03:00",
            },
        )

    r = await client.get(
        "/api/v1/ordenes-trabajo", params={"tecnico_id": tecnico["id"], "estado": "programado"}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 3
    assert all(o["tecnico"]["id"] == tecnico["id"] for o in data["items"])


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["estado"] == "ok"
