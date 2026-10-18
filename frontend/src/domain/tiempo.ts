import { MESES } from './fechas'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** YYYY-MM-DD en hora local (estable para comparar días). */
export function diaLocal(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toLocaleDateString('sv-SE')
}

function sumarDias(dia: string, delta: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  return diaLocal(new Date(a, m - 1, d + delta))
}

/** Segundos que faltan hasta `expiraIso` (0 si ya pasó, null si no hay plazo). */
export function segundosRestantes(expiraIso: string | null, ahora: Date): number | null {
  if (!expiraIso) return null
  const ms = new Date(expiraIso).getTime() - ahora.getTime()
  return Math.max(0, Math.floor(ms / 1000))
}

/** 299 → "4:59"; 3725 → "1:02:05". */
export function formatoCuentaRegresiva(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 850 → "850 m"; 2340 → "2,3 km"; 15400 → "15 km". */
export function formatoDistancia(metros: number | null | undefined): string {
  if (metros == null || Number.isNaN(metros)) return '—'
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`
  const km = metros / 1000
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`
}

export function formatoHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

/** Etiqueta de un día relativo a hoy: "Hoy", "Mañana", "Ayer" o "lunes 20 de octubre". */
export function etiquetaDia(dia: string, ahora: Date): string {
  const hoy = diaLocal(ahora)
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDias(hoy, 1)) return 'Mañana'
  if (dia === sumarDias(hoy, -1)) return 'Ayer'
  const [a, m, d] = dia.split('-').map(Number)
  const fecha = new Date(a, m - 1, d)
  const base = `${DIAS[fecha.getDay()]} ${d} de ${MESES[m - 1]}`
  return a === ahora.getFullYear() ? base : `${base} de ${a}`
}

/** Marca de tiempo compacta para listas de chat: "14:05", "ayer", "lun", "12 oct". */
export function formatoMarcaChat(fechaIso: string, ahora: Date): string {
  const dia = diaLocal(fechaIso)
  const hoy = diaLocal(ahora)
  if (dia === hoy) return formatoHora(fechaIso)
  if (dia === sumarDias(hoy, -1)) return 'ayer'
  const diff = (ahora.getTime() - new Date(fechaIso).getTime()) / 86_400_000
  if (diff < 7 && diff > 0) return DIAS[new Date(fechaIso).getDay()].slice(0, 3)
  const [, m, d] = dia.split('-').map(Number)
  return `${d} ${MESES[m - 1].slice(0, 3)}`
}

/** Hace cuánto: "recién", "hace 5 min", "hace 2 h", "hace 3 días". */
export function haceCuanto(fechaIso: string, ahora: Date): string {
  const min = Math.floor((ahora.getTime() - new Date(fechaIso).getTime()) / 60_000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} día${d === 1 ? '' : 's'}`
}
