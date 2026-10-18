"""Reglas de las fotos de evidencia (funciones puras)."""

TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024  # 8 MB

EXTENSION_POR_TIPO = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class EvidenciaInvalidaError(ValueError):
    """Archivo rechazado (-> HTTP 422)."""


def _firma_calza(content_type: str, cabecera: bytes) -> bool:
    if content_type == "image/jpeg":
        return cabecera.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return cabecera.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return cabecera[:4] == b"RIFF" and cabecera[8:12] == b"WEBP"
    return False


def validar_imagen(content_type: str | None, contenido: bytes) -> str:
    """Valida tipo, tamaño y firma (magic bytes) de la foto; devuelve la extensión.

    La firma evita aceptar cualquier archivo solo porque el cliente declaró
    `image/jpeg`."""
    tipo = (content_type or "").split(";")[0].strip().lower()
    if tipo not in EXTENSION_POR_TIPO:
        raise EvidenciaInvalidaError(
            f"Tipo de archivo no permitido: '{content_type}'. Use JPEG, PNG o WebP."
        )
    if not contenido:
        raise EvidenciaInvalidaError("El archivo está vacío.")
    if len(contenido) > TAMANO_MAXIMO_BYTES:
        raise EvidenciaInvalidaError("El archivo supera el máximo de 8 MB.")
    if not _firma_calza(tipo, contenido[:12]):
        raise EvidenciaInvalidaError(f"El contenido no corresponde a una imagen {tipo}.")
    return EXTENSION_POR_TIPO[tipo]
