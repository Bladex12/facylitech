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

/** Mismos colores en hex, para marcadores de Leaflet (que no usan clases Tailwind). */
export const SEMAFORO_HEX: Record<Semaforo, string> = {
  completado: '#10b981',
  vencido: '#ef4444',
  en_curso: '#f59e0b',
  programado: '#3b82f6',
}

export const SEMAFORO_BADGE_CLASS: Record<Semaforo, string> = {
  completado: 'bg-emerald-100 text-emerald-800',
  vencido: 'bg-red-100 text-red-800',
  en_curso: 'bg-amber-100 text-amber-800',
  programado: 'bg-blue-100 text-blue-800',
}
