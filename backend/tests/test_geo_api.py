from datetime import UTC, datetime

import pytest

from app.domain.cercania import haversine_m
from tests.fabricas import (
    COSTANERA_CENTER,
    ESTACION_CENTRAL,
    MAIPU,
    PLAZA_DE_ARMAS,
    crear_ascensor,
    crear_edificio,
    crear_emergencia,
    crear_tecnico,
)


@pytest.mark.asyncio
async def test_registrar_ubicacion_devuelve_coordenadas(client):
    tecnico = await crear_tecnico(client, ubicacion=COSTANERA_CENTER)
    assert tecnico["ultima_ubicacion"] == pytest.approx(
        {"lat": COSTANERA_CENTER[0], "lon": COSTANERA_CENTER[1]}
    )
    assert tecnico["ultima_ubicacion_at"] is not None

    r = await client.get(f"/api/v1/usuarios/{tecnico['id']}")
    assert r.json()["ultima_ubicacion"]["lat"] == pytest.approx(COSTANERA_CENTER[0])


@pytest.mark.asyncio
async def test_registrar_ubicacion_valida_rango_y_existencia(client):
    tecnico = await crear_tecnico(client)
    r = await client.post(f"/api/v1/usuarios/{tecnico['id']}/ubicacion", json={"lat": 120, "lon": 0})
    assert r.status_code == 422
    r = await client.post(
        "/api/v1/usuarios/00000000-0000-0000-0000-000000000000/ubicacion", json={"lat": 0, "lon": 0}
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_postgis_coincide_con_haversine(client):
    puntos = {"costanera": COSTANERA_CENTER, "estacion": ESTACION_CENTRAL, "maipu": MAIPU}
    for nombre, punto in puntos.items():
        await crear_tecnico(client, nombre=f"geo-{nombre}", ubicacion=punto)

    r = await client.get(
        "/api/v1/tecnicos/cercanos",
        params={"lat": PLAZA_DE_ARMAS[0], "lon": PLAZA_DE_ARMAS[1], "limit": 50},
    )
    assert r.status_code == 200
    por_nombre = {c["tecnico"]["nombre"]: c for c in r.json()}
    for nombre, punto in puntos.items():
        candidato = por_nombre[f"geo-{nombre}"]
        esperado = haversine_m(PLAZA_DE_ARMAS, punto)
        assert candidato["distancia_m"] == pytest.approx(esperado, rel=0.01)
        assert candidato["eta_min"] == round(candidato["distancia_m"] / (25_000 / 60))


@pytest.mark.asyncio
async def test_cercanos_ordena_y_excluye_inactivos_y_operadores(client):
    await crear_tecnico(client, nombre="geo-lejos", ubicacion=MAIPU)
    await crear_tecnico(client, nombre="geo-cerca", ubicacion=COSTANERA_CENTER)
    await crear_tecnico(client, nombre="geo-ocupado", ubicacion=PLAZA_DE_ARMAS, disponible=False)
    await crear_tecnico(client, nombre="geo-sin-ubicacion")
    await crear_tecnico(client, nombre="geo-inactivo", ubicacion=PLAZA_DE_ARMAS, activo=False)

    r = await client.get(
        "/api/v1/tecnicos/cercanos",
        params={"lat": PLAZA_DE_ARMAS[0], "lon": PLAZA_DE_ARMAS[1], "limit": 50},
    )
    nombres = [c["tecnico"]["nombre"] for c in r.json() if c["tecnico"]["nombre"].startswith("geo-")]
    assert nombres == ["geo-cerca", "geo-lejos", "geo-sin-ubicacion", "geo-ocupado"]
    sin_ubicacion = next(c for c in r.json() if c["tecnico"]["nombre"] == "geo-sin-ubicacion")
    assert sin_ubicacion["distancia_m"] is None and sin_ubicacion["eta_min"] is None
    assert all(c["tecnico"]["rol"] == "tecnico" for c in r.json())


@pytest.mark.asyncio
async def test_cercanos_respeta_limit(client):
    for i in range(3):
        await crear_tecnico(client, nombre=f"geo-{i}", ubicacion=COSTANERA_CENTER)
    r = await client.get(
        "/api/v1/tecnicos/cercanos", params={"lat": -33.44, "lon": -70.65, "limit": 2}
    )
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_candidatos_de_emergencia_priorizan_especialidad(client):
    edificio = await crear_edificio(client)
    await crear_tecnico(
        client, nombre="geo-mecanico-cerca", ubicacion=COSTANERA_CENTER, especialidades=["mecanica"]
    )
    await crear_tecnico(
        client, nombre="geo-rescate-lejos", ubicacion=MAIPU, especialidades=["persona_atrapada"]
    )
    emergencia = await crear_emergencia(client, edificio["id"], tipo="persona_atrapada")

    r = await client.get(f"/api/v1/emergencias/{emergencia['id']}/candidatos", params={"limit": 50})
    assert r.status_code == 200
    geo = [c for c in r.json() if c["tecnico"]["nombre"].startswith("geo-")]
    assert [c["tecnico"]["nombre"] for c in geo] == ["geo-rescate-lejos", "geo-mecanico-cerca"]
    assert geo[0]["especialidad_match"] is True and geo[1]["especialidad_match"] is False
    assert geo[0]["disponible"] is True
    assert geo[0]["ordenes_en_curso"] == 0

    r = await client.get("/api/v1/emergencias/00000000-0000-0000-0000-000000000000/candidatos")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_ascensor_por_qr(client):
    edificio = await crear_edificio(client)
    ascensor = await crear_ascensor(client, edificio["id"])
    r = await client.get(f"/api/v1/ascensores/qr/{ascensor['codigo_qr']}")
    assert r.status_code == 200
    assert r.json()["id"] == ascensor["id"]
    assert r.json()["edificio"]["nombre"] == edificio["nombre"]

    r = await client.get("/api/v1/ascensores/qr/FCY-NO-EXISTE")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_mapa(client):
    edificio = await crear_edificio(client, nombre="Edificio Mapa")
    await crear_ascensor(client, edificio["id"])
    ascensor_falla = await crear_ascensor(client, edificio["id"], estado="critico")
    tecnico = await crear_tecnico(client, nombre="geo-mapa", ubicacion=COSTANERA_CENTER)
    emergencia = await crear_emergencia(client, edificio["id"])

    r = await client.post(
        "/api/v1/ordenes-trabajo",
        json={
            "tipo": "reparacion",
            "prioridad": "alta",
            "ascensor_id": ascensor_falla["id"],
            "tecnico_id": tecnico["id"],
            "fecha_programada": datetime.now(UTC).isoformat(),
        },
    )
    assert r.status_code == 201, r.text
    orden = r.json()
    assert (await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/iniciar")).status_code == 200

    r = await client.get("/api/v1/mapa")
    assert r.status_code == 200
    datos = r.json()

    ed = next(e for e in datos["edificios"] if e["id"] == edificio["id"])
    assert ed["total_equipos"] == 2
    assert ed["equipos_con_falla"] == 1
    assert ed["ordenes_hoy"] == 1
    assert ed["emergencia_activa"] is True
    assert ed["ubicacion"] == pytest.approx({"lat": PLAZA_DE_ARMAS[0], "lon": PLAZA_DE_ARMAS[1]})

    tec = next(t for t in datos["tecnicos"] if t["id"] == tecnico["id"])
    assert tec["ubicacion"]["lat"] == pytest.approx(COSTANERA_CENTER[0])
    assert tec["orden_actual"] == {
        "id": orden["id"],
        "codigo": orden["codigo"],
        "edificio_nombre": "Edificio Mapa",
    }

    em = next(e for e in datos["emergencias"] if e["id"] == emergencia["id"])
    assert em["edificio_nombre"] == "Edificio Mapa"
    assert em["estado"] == "activa"

    await client.patch(f"/api/v1/emergencias/{emergencia['id']}/estado", json={"estado": "cerrada"})
    datos = (await client.get("/api/v1/mapa")).json()
    assert all(e["id"] != emergencia["id"] for e in datos["emergencias"])
    ed = next(e for e in datos["edificios"] if e["id"] == edificio["id"])
    assert ed["emergencia_activa"] is False
