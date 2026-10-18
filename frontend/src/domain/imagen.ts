/** Lado mayor máximo de las fotos de evidencia: suficiente para leer una placa
 * o un tablero, y deja cada foto en ~200–400 KB (RNF-02, mala conexión). */
export const LADO_MAXIMO_FOTO = 1600
export const CALIDAD_JPEG = 0.8

/** Dimensiones escaladas manteniendo proporción; nunca agranda la imagen. */
export function calcularDimensiones(
  ancho: number,
  alto: number,
  ladoMaximo = LADO_MAXIMO_FOTO,
): { ancho: number; alto: number } {
  if (ancho <= 0 || alto <= 0) return { ancho: 0, alto: 0 }
  const mayor = Math.max(ancho, alto)
  if (mayor <= ladoMaximo) return { ancho, alto }
  const factor = ladoMaximo / mayor
  return {
    ancho: Math.max(1, Math.round(ancho * factor)),
    alto: Math.max(1, Math.round(alto * factor)),
  }
}

export function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Comprime una foto en el navegador (canvas → JPEG). Si algo falla (formato
 * no decodificable, navegador antiguo) devuelve el archivo original: subir
 * más pesado es mejor que no subir.
 */
export async function comprimirImagen(archivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    const { ancho, alto } = calcularDimensiones(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) return archivo
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG),
    )
    if (!blob || blob.size >= archivo.size) return archivo
    return blob
  } catch {
    return archivo
  }
}
