import type { OrdenReplicada } from '../api/types'
import { diaDeTimestamp } from './semana'

export interface DiaReplicado {
  /** YYYY-MM-DD local */
  dia: string
  cantidad: number
  /** Edificios del día, sin repetir, en orden de aparición. */
  edificios: string[]
  sinTecnico: number
}

/** Agrupa la vista previa de la replicación por día del mes de destino. */
export function resumirPorDia(crear: OrdenReplicada[]): DiaReplicado[] {
  const porDia = new Map<string, DiaReplicado>()
  const ordenadas = [...crear].sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada))
  for (const o of ordenadas) {
    const dia = diaDeTimestamp(o.fecha_programada)
    let d = porDia.get(dia)
    if (!d) {
      d = { dia, cantidad: 0, edificios: [], sinTecnico: 0 }
      porDia.set(dia, d)
    }
    d.cantidad++
    if (!d.edificios.includes(o.edificio_nombre)) d.edificios.push(o.edificio_nombre)
    if (!o.tecnico_nombre) d.sinTecnico++
  }
  return [...porDia.values()]
}

/** "YYYY-MM" -> { anio, mes } */
export function parsearMes(mes: string): { anio: number; mes: number } {
  const [a, m] = mes.split('-').map(Number)
  return { anio: a, mes: m }
}
