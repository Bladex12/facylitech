/**
 * Utilidades de fechas para el calendario semanal y la agenda del operador.
 * Todas trabajan con fechas ISO locales (YYYY-MM-DD) para no arrastrar
 * problemas de zona horaria: la hora de una OT se interpreta en la zona del
 * navegador (Santiago en el uso real).
 */
import { MESES } from './fechas'

const MESES_CORTOS = MESES.map((m) => m.slice(0, 3))

function aFecha(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/** Fecha local (no UTC) de un Date como YYYY-MM-DD. */
export function fechaIsoLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate(),
  ).padStart(2, '0')}`
}

/** Día local (YYYY-MM-DD) de un timestamp ISO con zona (`fecha_programada`). */
export function diaDeTimestamp(timestamp: string): string {
  return fechaIsoLocal(new Date(timestamp))
}

/** Hora local HH:MM de un timestamp ISO con zona. */
export function horaDeTimestamp(timestamp: string): string {
  const d = new Date(timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function sumarDias(fechaIso: string, dias: number): string {
  const d = aFecha(fechaIso)
  d.setDate(d.getDate() + dias)
  return fechaIsoLocal(d)
}

/** Lunes de la semana (lun-dom) que contiene la fecha. */
export function inicioSemana(fechaIso: string): string {
  const d = aFecha(fechaIso)
  const offset = (d.getDay() + 6) % 7
  return sumarDias(fechaIso, -offset)
}

/** Los 7 días (lun-dom) de la semana que contiene la fecha. */
export function diasDeSemana(fechaIso: string): string[] {
  const lunes = inicioSemana(fechaIso)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

/** Primer y último día del mes (para los filtros `desde`/`hasta` del listado). */
export function rangoMes(anio: number, mes: number): { desde: string; hasta: string } {
  const ultimo = new Date(anio, mes, 0).getDate()
  const mm = String(mes).padStart(2, '0')
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

/** "19 – 25 oct 2026" o "28 sep – 4 oct 2026" si cruza de mes. */
export function formatoRangoSemana(fechaIso: string): string {
  const dias = diasDeSemana(fechaIso)
  const ini = aFecha(dias[0])
  const fin = aFecha(dias[6])
  const mesIni = MESES_CORTOS[ini.getMonth()]
  const mesFin = MESES_CORTOS[fin.getMonth()]
  if (ini.getFullYear() !== fin.getFullYear()) {
    return `${ini.getDate()} ${mesIni} ${ini.getFullYear()} – ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`
  }
  if (mesIni === mesFin) return `${ini.getDate()} – ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`
  return `${ini.getDate()} ${mesIni} – ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`
}

/** "lun 19" para encabezados de columna/fila. */
export function formatoDiaCorto(fechaIso: string): { dia: string; numero: number } {
  const d = aFecha(fechaIso)
  const nombres = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  return { dia: nombres[d.getDay()], numero: d.getDate() }
}

export function esDomingo(fechaIso: string): boolean {
  return aFecha(fechaIso).getDay() === 0
}

/** Fecha sugerida para una OT nueva: nunca en el pasado ni en domingo. */
export function fechaSugerida(fechaIso: string, hoyIso: string): string {
  const base = fechaIso < hoyIso ? hoyIso : fechaIso
  return esDomingo(base) ? sumarDias(base, 1) : base
}

/** Combina fecha local + hora local en un timestamp ISO (UTC) para la API. */
export function combinarFechaHora(fechaIso: string, hora: string): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  const [hh, mm] = hora.split(':').map(Number)
  return new Date(anio, mes - 1, dia, hh, mm).toISOString()
}

export type MedioDia = 'manana' | 'tarde'

/** Hora de corte entre mañana y tarde del cronograma de la empresa. */
export const HORA_CORTE_TARDE = 13

export const HORA_DEFECTO: Record<MedioDia, string> = { manana: '09:00', tarde: '14:00' }

export function medioDia(timestamp: string): MedioDia {
  return new Date(timestamp).getHours() < HORA_CORTE_TARDE ? 'manana' : 'tarde'
}
