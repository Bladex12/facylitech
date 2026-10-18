/** Formateo de distancia y tiempo estimado de llegada (ETA) de técnicos. */

/** 850 -> "850 m"; 2345 -> "2,3 km"; 15400 -> "15 km"; null -> "Sin ubicación". */
export function formatoDistancia(metros: number | null | undefined): string {
  if (metros === null || metros === undefined) return 'Sin ubicación'
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`
  const km = metros / 1000
  if (km >= 10) return `${Math.round(km)} km`
  return `${km.toFixed(1).replace('.', ',')} km`
}

/** 0 -> "< 1 min"; 12 -> "~12 min"; 75 -> "~1 h 15 min"; null -> "—". */
export function formatoEta(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return '—'
  if (minutos < 1) return '< 1 min'
  if (minutos < 60) return `~${Math.round(minutos)} min`
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return m === 0 ? `~${h} h` : `~${h} h ${m} min`
}

/** Iniciales para avatares: "Marcus Delgado" -> "MD". */
export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return '?'
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .join('')
    .slice(0, 2)
}
