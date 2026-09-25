import type { OrdenTrabajo, PrioridadOrdenTrabajo, Semaforo } from '../api/types'

const ORDEN_SEMAFORO: Record<Semaforo, number> = {
  vencido: 0,
  en_curso: 1,
  programado: 2,
  completado: 3,
}

const ORDEN_PRIORIDAD: Record<PrioridadOrdenTrabajo, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
}

/** Regla del cliente: vencidos > en_curso > programados > completados;
 * dentro de cada grupo, por prioridad y fecha. */
export function ordenarListado(ordenes: OrdenTrabajo[]): OrdenTrabajo[] {
  return [...ordenes].sort((a, b) => {
    const semaforo = ORDEN_SEMAFORO[a.semaforo] - ORDEN_SEMAFORO[b.semaforo]
    if (semaforo !== 0) return semaforo
    const prioridad = ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad]
    if (prioridad !== 0) return prioridad
    return a.fecha_programada.localeCompare(b.fecha_programada)
  })
}
