"""Adaptadores de `AlmacenamientoArchivos` (application/interfaces/storage.py)."""

import asyncio
from pathlib import Path

import httpx

from app.application.errors import AlmacenamientoError


class AlmacenamientoLocal:
    """Guarda en disco (`backend/media/` por defecto) y sirve en `/media/...`
    vía el `StaticFiles` montado en `app/main.py`. URLs relativas."""

    def __init__(self, directorio: str | Path, url_base: str = "/media"):
        self.directorio = Path(directorio).resolve()
        self.url_base = url_base.rstrip("/")

    def _destino(self, ruta: str) -> Path:
        destino = (self.directorio / ruta).resolve()
        if not destino.is_relative_to(self.directorio):
            raise ValueError(f"Ruta fuera del directorio de medios: {ruta}")
        return destino

    async def guardar(self, ruta: str, contenido: bytes, content_type: str) -> str:
        destino = self._destino(ruta)

        def _escribir() -> None:
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(contenido)

        await asyncio.to_thread(_escribir)
        return f"{self.url_base}/{ruta}"

    async def eliminar(self, url: str) -> None:
        prefijo = f"{self.url_base}/"
        if not url.startswith(prefijo):
            return
        destino = self._destino(url[len(prefijo) :])
        await asyncio.to_thread(destino.unlink, True)


class AlmacenamientoSupabase:
    """Supabase Storage vía su API REST (sin SDK, solo httpx).

    Sube con `POST {SUPABASE_URL}/storage/v1/object/{bucket}/{ruta}` usando la
    service key, y expone la URL pública del bucket (el bucket debe ser
    público para que el front muestre las fotos sin firmar URLs)."""

    def __init__(
        self,
        url: str,
        service_key: str,
        bucket: str,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: float = 30.0,
    ):
        if not url or not service_key:
            raise ValueError("STORAGE_BACKEND=supabase requiere SUPABASE_URL y SUPABASE_SERVICE_KEY.")
        self.url = url.rstrip("/")
        self.service_key = service_key
        self.bucket = bucket
        self._transport = transport
        self._timeout = timeout

    def _url_objeto(self, ruta: str) -> str:
        return f"{self.url}/storage/v1/object/{self.bucket}/{ruta}"

    def url_publica(self, ruta: str) -> str:
        return f"{self.url}/storage/v1/object/public/{self.bucket}/{ruta}"

    def _cliente(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=self._transport,
            timeout=self._timeout,
            headers={"Authorization": f"Bearer {self.service_key}"},
        )

    async def guardar(self, ruta: str, contenido: bytes, content_type: str) -> str:
        try:
            async with self._cliente() as cliente:
                respuesta = await cliente.post(
                    self._url_objeto(ruta),
                    content=contenido,
                    headers={"Content-Type": content_type, "x-upsert": "false"},
                )
        except httpx.HTTPError as exc:
            raise AlmacenamientoError(f"No se pudo conectar a Supabase Storage: {exc}") from exc
        if respuesta.status_code >= 300:
            raise AlmacenamientoError(
                f"Supabase Storage respondió {respuesta.status_code} al subir: {respuesta.text[:200]}"
            )
        return self.url_publica(ruta)

    async def eliminar(self, url: str) -> None:
        prefijo = self.url_publica("")
        if not url.startswith(prefijo):
            return
        try:
            async with self._cliente() as cliente:
                respuesta = await cliente.delete(self._url_objeto(url[len(prefijo) :]))
        except httpx.HTTPError as exc:
            raise AlmacenamientoError(f"No se pudo conectar a Supabase Storage: {exc}") from exc
        if respuesta.status_code >= 300 and respuesta.status_code != 404:
            raise AlmacenamientoError(
                f"Supabase Storage respondió {respuesta.status_code} al borrar: {respuesta.text[:200]}"
            )
