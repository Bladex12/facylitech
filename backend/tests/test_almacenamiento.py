import httpx
import pytest

from app.application.errors import AlmacenamientoError
from app.domain.evidencias import EvidenciaInvalidaError, validar_imagen
from app.infrastructure.almacenamiento import AlmacenamientoLocal, AlmacenamientoSupabase

SUPABASE_URL = "https://proyecto.supabase.co"


def _supabase(handler) -> AlmacenamientoSupabase:
    return AlmacenamientoSupabase(
        SUPABASE_URL + "/", "clave-servicio", "evidencias", transport=httpx.MockTransport(handler)
    )


@pytest.mark.asyncio
async def test_supabase_sube_con_service_key_y_devuelve_url_publica():
    peticiones: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        peticiones.append(request)
        return httpx.Response(200, json={"Key": "evidencias/p1/a.jpg"})

    url = await _supabase(handler).guardar("evidencias/p1/a.jpg", b"\xff\xd8\xff", "image/jpeg")

    assert url == f"{SUPABASE_URL}/storage/v1/object/public/evidencias/evidencias/p1/a.jpg"
    (req,) = peticiones
    assert req.method == "POST"
    assert str(req.url) == f"{SUPABASE_URL}/storage/v1/object/evidencias/evidencias/p1/a.jpg"
    assert req.headers["Authorization"] == "Bearer clave-servicio"
    assert req.headers["Content-Type"] == "image/jpeg"
    assert req.content == b"\xff\xd8\xff"


@pytest.mark.asyncio
async def test_supabase_borra_a_partir_de_la_url_publica():
    peticiones: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        peticiones.append(request)
        return httpx.Response(200, json=[])

    almacenamiento = _supabase(handler)
    await almacenamiento.eliminar(almacenamiento.url_publica("evidencias/p1/a.jpg"))
    await almacenamiento.eliminar("/media/evidencias/otro.jpg")  # URL ajena: se ignora

    (req,) = peticiones
    assert req.method == "DELETE"
    assert str(req.url) == f"{SUPABASE_URL}/storage/v1/object/evidencias/evidencias/p1/a.jpg"
    assert req.headers["Authorization"] == "Bearer clave-servicio"


@pytest.mark.asyncio
async def test_supabase_borrar_inexistente_no_falla():
    almacenamiento = _supabase(lambda r: httpx.Response(404, json={"error": "not_found"}))
    await almacenamiento.eliminar(almacenamiento.url_publica("evidencias/x.jpg"))


@pytest.mark.asyncio
async def test_supabase_error_se_traduce():
    almacenamiento = _supabase(lambda r: httpx.Response(403, json={"error": "Unauthorized"}))
    with pytest.raises(AlmacenamientoError):
        await almacenamiento.guardar("evidencias/x.jpg", b"x", "image/jpeg")


def test_supabase_requiere_configuracion():
    with pytest.raises(ValueError):
        AlmacenamientoSupabase("", "", "evidencias")


@pytest.mark.asyncio
async def test_local_guarda_y_borra(tmp_path):
    local = AlmacenamientoLocal(tmp_path)
    url = await local.guardar("evidencias/p1/a.png", b"datos", "image/png")
    assert url == "/media/evidencias/p1/a.png"
    assert (tmp_path / "evidencias/p1/a.png").read_bytes() == b"datos"
    await local.eliminar(url)
    await local.eliminar(url)  # idempotente
    assert not (tmp_path / "evidencias/p1/a.png").exists()


@pytest.mark.asyncio
async def test_local_rechaza_rutas_fuera_del_directorio(tmp_path):
    local = AlmacenamientoLocal(tmp_path / "media")
    with pytest.raises(ValueError):
        await local.guardar("../fuera.jpg", b"x", "image/jpeg")


def test_validar_imagen_acepta_content_type_con_parametros():
    assert validar_imagen("image/JPEG; charset=binary", b"\xff\xd8\xff\xe0") == "jpg"


def test_validar_imagen_rechaza_sin_content_type():
    with pytest.raises(EvidenciaInvalidaError):
        validar_imagen(None, b"\xff\xd8\xff")
