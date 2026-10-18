"""Puerto de almacenamiento de archivos (fotos de evidencia).

Implementaciones en `app.infrastructure.almacenamiento`: `AlmacenamientoLocal`
(disco, default en desarrollo) y `AlmacenamientoSupabase` (Supabase Storage
vía REST). Se elige con `settings.storage_backend` en `api/v1/deps.py`.
"""

from typing import Protocol


class AlmacenamientoArchivos(Protocol):
    async def guardar(self, ruta: str, contenido: bytes, content_type: str) -> str:
        """Guarda `contenido` en `ruta` (relativa, p.ej. `evidencias/<id>/<uuid>.jpg`)
        y devuelve la URL con que el front lo muestra."""
        ...

    async def eliminar(self, url: str) -> None:
        """Borra el archivo a partir de la URL que devolvió `guardar`.
        Idempotente: no falla si ya no existe."""
        ...
