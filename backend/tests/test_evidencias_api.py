from datetime import UTC, datetime

import pytest

from app.api.v1.deps import get_almacenamiento
from app.domain.evidencias import TAMANO_MAXIMO_BYTES
from app.infrastructure.almacenamiento import AlmacenamientoLocal
from app.main import app
from tests.fabricas import crear_ascensor, crear_edificio, crear_tecnico

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 64


@pytest.fixture
def almacenamiento(tmp_path):
    local = AlmacenamientoLocal(tmp_path)
    app.dependency_overrides[get_almacenamiento] = lambda: local
    yield local
    app.dependency_overrides.pop(get_almacenamiento, None)


async def _papeleta(client):
    edificio = await crear_edificio(client)
    ascensor = await crear_ascensor(client, edificio["id"])
    tecnico = await crear_tecnico(client)
    r = await client.post(
        "/api/v1/ordenes-trabajo",
        json={
            "tipo": "reparacion",
            "prioridad": "media",
            "ascensor_id": ascensor["id"],
            "tecnico_id": tecnico["id"],
            "fecha_programada": datetime.now(UTC).isoformat(),
        },
    )
    orden = r.json()
    await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/iniciar")
    r = await client.post(f"/api/v1/ordenes-trabajo/{orden['id']}/papeleta")
    assert r.status_code == 201, r.text
    assert r.json()["evidencias"] == []
    return r.json()


async def _subir(client, papeleta_id, contenido=JPEG, content_type="image/jpeg", tipo="antes"):
    data = {"tipo": tipo} if tipo is not None else {}
    return await client.post(
        f"/api/v1/papeletas/{papeleta_id}/evidencias",
        files={"archivo": ("foto", contenido, content_type)},
        data=data,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("contenido", "content_type", "extension"),
    [(JPEG, "image/jpeg", "jpg"), (PNG, "image/png", "png"), (WEBP, "image/webp", "webp")],
)
async def test_subir_y_borrar_evidencia_local(
    client, almacenamiento, tmp_path, contenido, content_type, extension
):
    papeleta = await _papeleta(client)
    r = await _subir(client, papeleta["id"], contenido, content_type)
    assert r.status_code == 201, r.text
    evidencia = r.json()
    assert evidencia["tipo"] == "antes"
    assert evidencia["url"].startswith(f"/media/evidencias/{papeleta['id']}/")
    assert evidencia["url"].endswith(f".{extension}")

    archivo = tmp_path / evidencia["url"].removeprefix("/media/")
    assert archivo.read_bytes() == contenido

    r = await client.get(f"/api/v1/papeletas/{papeleta['id']}")
    assert [e["id"] for e in r.json()["evidencias"]] == [evidencia["id"]]

    r = await client.delete(f"/api/v1/papeletas/{papeleta['id']}/evidencias/{evidencia['id']}")
    assert r.status_code == 200
    assert r.json()["evidencias"] == []
    assert not archivo.exists()

    r = await client.delete(f"/api/v1/papeletas/{papeleta['id']}/evidencias/{evidencia['id']}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_tipo_es_opcional(client, almacenamiento):
    papeleta = await _papeleta(client)
    r = await _subir(client, papeleta["id"], tipo=None)
    assert r.status_code == 201
    assert r.json()["tipo"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("contenido", "content_type"),
    [
        (b"%PDF-1.4 hola", "application/pdf"),  # tipo no permitido
        (b"no soy una imagen", "image/jpeg"),  # firma no calza
        (PNG, "image/jpeg"),  # tipo declarado distinto al real
        (b"", "image/png"),  # vacío
        (JPEG + b"\x00" * TAMANO_MAXIMO_BYTES, "image/jpeg"),  # > 8 MB
    ],
)
async def test_validaciones_422(client, almacenamiento, tmp_path, contenido, content_type):
    papeleta = await _papeleta(client)
    r = await _subir(client, papeleta["id"], contenido, content_type)
    assert r.status_code == 422
    assert not any(tmp_path.rglob("*.*"))


@pytest.mark.asyncio
async def test_papeleta_enviada_409(client, almacenamiento):
    papeleta = await _papeleta(client)
    evidencia = (await _subir(client, papeleta["id"])).json()
    await client.post(f"/api/v1/papeletas/{papeleta['id']}/enviar")

    r = await _subir(client, papeleta["id"])
    assert r.status_code == 409
    r = await client.delete(f"/api/v1/papeletas/{papeleta['id']}/evidencias/{evidencia['id']}")
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_papeleta_inexistente_404(client, almacenamiento):
    r = await _subir(client, "00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
