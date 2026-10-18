/**
 * Agrupación de OTs con el formato del cronograma de la empresa:
 * técnico × día × medio día (mañana/tarde) o día completo, por edificio.
 */
import type { OrdenTrabajo, Semaforo } from '../api/types'
import { diaDeTimestamp, medioDia } from './semana'

export type Franja = 'manana' | 'tarde' | 'completo'

export const FRANJA_LABEL: Record<Franja, string> = {
  manana: 'mañana',
  tarde: 'tarde',
  completo: 'día completo',
}

export interface BloqueAgenda {
  clave: string
  tecnicoId: string | null
  fecha: string
  franja: Franja
  edificioId: string
  edificioNombre: string
  ordenes: OrdenTrabajo[]
  /** Equipos distintos involucrados (un equipo puede tener 2 OTs el mismo día). */
  equipos: number
  completadas: number
  total: number
  semaforo: Semaforo
}

/** Lo que más requiere atención manda el color del bloque. */
const GRAVEDAD: Record<Semaforo, number> = {
  vencido: 0,
  en_curso: 1,
  programado: 2,
  completado: 3,
}

export function semaforoAgregado(semaforos: Semaforo[]): Semaforo {
  if (semaforos.length === 0) return 'programado'
  return semaforos.reduce((peor, s) => (GRAVEDAD[s] < GRAVEDAD[peor] ? s : peor))
}

export const SIN_TECNICO = 'sin-asignar'

export function claveCelda(tecnicoId: string | null, fecha: string): string {
  return `${tecnicoId ?? SIN_TECNICO}|${fecha}`
}

/**
 * Agrupa OTs en bloques por (técnico, día, edificio). Si un edificio tiene OTs
 * en la mañana y en la tarde del mismo técnico/día, se considera "día
 * completo" (así lo planifica la empresa). Las canceladas no se agendan.
 * Devuelve un mapa claveCelda -> bloques ordenados por hora.
 */
export function agruparAgenda(ordenes: OrdenTrabajo[]): Map<string, BloqueAgenda[]> {
  const grupos = new Map<string, OrdenTrabajo[]>()
  for (const o of ordenes) {
    if (o.estado === 'cancelado') continue
    const clave = `${claveCelda(o.tecnico?.id ?? null, diaDeTimestamp(o.fecha_programada))}|${o.ascensor.edificio.id}`
    const lista = grupos.get(clave)
    if (lista) lista.push(o)
    else grupos.set(clave, [o])
  }

  const celdas = new Map<string, BloqueAgenda[]>()
  for (const [clave, lista] of grupos) {
    lista.sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada))
    const franjas = new Set(lista.map((o) => medioDia(o.fecha_programada)))
    const franja: Franja = franjas.size > 1 ? 'completo' : [...franjas][0]
    const primera = lista[0]
    const fecha = diaDeTimestamp(primera.fecha_programada)
    const bloque: BloqueAgenda = {
      clave,
      tecnicoId: primera.tecnico?.id ?? null,
      fecha,
      franja,
      edificioId: primera.ascensor.edificio.id,
      edificioNombre: primera.ascensor.edificio.nombre,
      ordenes: lista,
      equipos: new Set(lista.map((o) => o.ascensor.id)).size,
      completadas: lista.filter((o) => o.estado === 'completado').length,
      total: lista.length,
      semaforo: semaforoAgregado(lista.map((o) => o.semaforo)),
    }
    const celda = claveCelda(bloque.tecnicoId, fecha)
    const existentes = celdas.get(celda)
    if (existentes) existentes.push(bloque)
    else celdas.set(celda, [bloque])
  }
  for (const bloques of celdas.values()) {
    bloques.sort((a, b) => a.ordenes[0].fecha_programada.localeCompare(b.ordenes[0].fecha_programada))
  }
  return celdas
}

/** Bloques de una celda separados por fila (los de día completo van aparte). */
export function bloquesPorFranja(bloques: BloqueAgenda[] | undefined): Record<Franja, BloqueAgenda[]> {
  const res: Record<Franja, BloqueAgenda[]> = { manana: [], tarde: [], completo: [] }
  for (const b of bloques ?? []) res[b.franja].push(b)
  return res
}

/** Carga de un técnico en la semana: OTs (no canceladas) y completadas. */
export function cargaTecnico(
  ordenes: OrdenTrabajo[],
  tecnicoId: string | null,
): { total: number; completadas: number } {
  const propias = ordenes.filter(
    (o) => o.estado !== 'cancelado' && (o.tecnico?.id ?? null) === tecnicoId,
  )
  return { total: propias.length, completadas: propias.filter((o) => o.estado === 'completado').length }
}
