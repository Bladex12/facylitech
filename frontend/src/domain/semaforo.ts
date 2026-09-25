import type { Semaforo } from '../api/types'

export const SEMAFORO_LABEL: Record<Semaforo, string> = {
  completado: 'Completado',
  vencido: 'Vencido',
  en_curso: 'En curso',
  programado: 'Programado',
}

export const SEMAFORO_DOT_CLASS: Record<Semaforo, string> = {
  completado: 'bg-emerald-500',
  vencido: 'bg-red-500',
  en_curso: 'bg-amber-500',
  programado: 'bg-blue-500',
}

export const SEMAFORO_BADGE_CLASS: Record<Semaforo, string> = {
  completado: 'bg-emerald-100 text-emerald-800',
  vencido: 'bg-red-100 text-red-800',
  en_curso: 'bg-amber-100 text-amber-800',
  programado: 'bg-blue-100 text-blue-800',
}
