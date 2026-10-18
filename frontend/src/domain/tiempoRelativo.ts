/** Utilidades de tiempo para las vistas de operación (mapa, emergencias, técnicos). */

const MINUTO_MS = 60_000

/** "recién", "hace 5 min", "hace 2 h 10 min", "hace 3 d". */
export function tiempoTranscurrido(desdeIso: string | null | undefined, ahora: Date): string {
  if (!desdeIso) return 'sin registro'
  const minutos = Math.floor((ahora.getTime() - new Date(desdeIso).getTime()) / MINUTO_MS)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) {
    const resto = minutos % 60
    return resto === 0 ? `hace ${horas} h` : `hace ${horas} h ${resto} min`
  }
  return `hace ${Math.floor(horas / 24)} d`
}

/** Minutos completos transcurridos desde `desdeIso` (0 si está en el futuro). */
export function minutosDesde(desdeIso: string, ahora: Date): number {
  return Math.max(0, Math.floor((ahora.getTime() - new Date(desdeIso).getTime()) / MINUTO_MS))
}

/** Segundos que faltan hasta `hastaIso` (nunca negativo). null si no hay fecha. */
export function segundosRestantes(hastaIso: string | null | undefined, ahora: Date): number | null {
  if (!hastaIso) return null
  return Math.max(0, Math.ceil((new Date(hastaIso).getTime() - ahora.getTime()) / 1000))
}

/** 299 -> "4:59", 5 -> "0:05". */
export function formatoCuentaRegresiva(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Hora local "HH:MM" (es-CL, 24 h). */
export function formatoHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "lun 20 oct" en hora local. */
export function formatoFechaCorta(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '')
}

/** Fecha local como YYYY-MM-DD (no UTC: en Santiago `toISOString` cambia de día de noche). */
export function fechaLocalIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

/** Lunes y domingo (YYYY-MM-DD, hora local) de la semana que contiene `fecha`. */
export function rangoSemana(fecha: Date): { desde: string; hasta: string } {
  const offset = (fecha.getDay() + 6) % 7 // lunes = 0
  const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() - offset)
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
  return { desde: fechaLocalIso(lunes), hasta: fechaLocalIso(domingo) }
}

/** Suma días a una fecha local y la devuelve como YYYY-MM-DD. */
export function sumarDiasIso(fecha: Date, dias: number): string {
  return fechaLocalIso(new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias))
}
