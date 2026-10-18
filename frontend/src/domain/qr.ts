/**
 * Códigos QR de los equipos: `FCY-{edificio}-{equipo}`, p. ej. `FCY-B01-01A`
 * (ver `backend/seed.py`). La etiqueta física puede traer el código solo o
 * dentro de una URL; el técnico también puede tipearlo a mano sin el prefijo.
 */
const PATRON_FCY = /FCY-[A-Z0-9]+(?:-[A-Z0-9]+)*/

/** Extrae y normaliza un código `FCY-...` desde lo leído/tipeado; null si no hay. */
export function extraerCodigoQr(texto: string): string | null {
  if (!texto) return null
  let limpio = texto.trim().toUpperCase()
  try {
    limpio = decodeURIComponent(limpio)
  } catch {
    // texto con % sueltos: se usa tal cual
  }
  limpio = limpio.replace(/[\s_]+/g, '-').replace(/–|—/g, '-')

  const encontrado = limpio.match(PATRON_FCY)
  if (encontrado) return encontrado[0]

  // Entrada manual sin prefijo: "b01-01a" o "B01 01A".
  if (/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(limpio)) return `FCY-${limpio}`
  return null
}
