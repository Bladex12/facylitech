import type {
  AsignacionEmergencia,
  CandidatoTecnico,
  Emergencia,
  EstadoAsignacion,
  EstadoEmergencia,
  Especialidad,
} from '../api/types'

/** Etiquetas del mockup (EMERGENCY_LABELS). También sirven para especialidades del técnico. */
export const EMERGENCIA_LABEL: Record<Especialidad, string> = {
  persona_atrapada: 'Persona Atrapada',
  mecanica: 'Falla Mecánica',
  corte_energia: 'Corte de Energía',
  incendio: 'Incendio',
  inundacion: 'Inundación',
}

/** Colores del mockup (EMERGENCY_COLORS). */
export const EMERGENCIA_COLOR_CLASS: Record<Especialidad, string> = {
  persona_atrapada: 'bg-red-600',
  mecanica: 'bg-amber-500',
  corte_energia: 'bg-yellow-500',
  incendio: 'bg-rose-700',
  inundacion: 'bg-blue-600',
}

export const ESTADO_EMERGENCIA: Record<EstadoEmergencia, { label: string; cls: string }> = {
  activa: { label: 'ACTIVA', cls: 'bg-red-50 text-red-700' },
  en_atencion: { label: 'EN ATENCIÓN', cls: 'bg-amber-50 text-amber-700' },
  cerrada: { label: 'CERRADA', cls: 'bg-green-50 text-green-700' },
}

export const ESTADO_ASIGNACION: Record<
  EstadoAsignacion,
  { label: string; cls: string; dot: string }
> = {
  en_espera: { label: 'En espera', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
  pendiente: { label: 'Notificado', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  aceptada: { label: 'Aceptó', cls: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  rechazada: { label: 'Rechazó', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  expirada: { label: 'Sin respuesta', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  cancelada: { label: 'Cancelada', cls: 'bg-slate-50 text-slate-400', dot: 'bg-slate-200' },
}

const ORDEN_ESTADO: Record<EstadoEmergencia, number> = { activa: 0, en_atencion: 1, cerrada: 2 }

/** Activas primero, luego en atención y cerradas; dentro de cada grupo, la más reciente arriba. */
export function ordenarEmergencias<T extends Pick<Emergencia, 'estado' | 'reportada_at'>>(
  emergencias: T[],
): T[] {
  return [...emergencias].sort((a, b) => {
    const estado = ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]
    if (estado !== 0) return estado
    return b.reportada_at.localeCompare(a.reportada_at)
  })
}

// ─── Armado de la cascada (lo decide el operador, nunca es automática) ─────────

/** Sugerencia inicial: los primeros `max` del ranking del backend que tengan ubicación conocida. */
export function sugerirCascada(candidatos: CandidatoTecnico[], max = 3): string[] {
  return candidatos
    .filter((c) => c.distancia_m !== null)
    .slice(0, max)
    .map((c) => c.tecnico.id)
}

/** Agrega el técnico al final de la cascada, o lo quita si ya estaba. */
export function alternarEnCascada(cascada: string[], tecnicoId: string): string[] {
  return cascada.includes(tecnicoId)
    ? cascada.filter((id) => id !== tecnicoId)
    : [...cascada, tecnicoId]
}

/** Mueve el elemento en `indice` una posición arriba (-1) o abajo (+1). Fuera de rango no cambia. */
export function moverEnCascada<T>(lista: T[], indice: number, delta: -1 | 1): T[] {
  const destino = indice + delta
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return lista
  const copia = [...lista]
  ;[copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!]
  return copia
}

export type FaseCascada = 'sin_despacho' | 'esperando' | 'aceptada' | 'agotada'

export interface ResumenCascada {
  fase: FaseCascada
  /** Asignación relevante: la pendiente (esperando) o la aceptada. */
  actual: AsignacionEmergencia | null
  /** Asignaciones de la cascada vigente, ordenadas por `orden`. */
  asignaciones: AsignacionEmergencia[]
}

const ESTADOS_ABIERTOS: EstadoAsignacion[] = ['pendiente', 'en_espera']

/** Resume el estado de la cascada para la UI a partir de la emergencia del backend. */
export function resumirCascada(
  emergencia: Pick<Emergencia, 'asignaciones' | 'cascada_agotada'>,
): ResumenCascada {
  const asignaciones = [...(emergencia.asignaciones ?? [])].sort((a, b) => a.orden - b.orden)
  if (asignaciones.length === 0) return { fase: 'sin_despacho', actual: null, asignaciones }
  const aceptada = asignaciones.find((a) => a.estado === 'aceptada')
  if (aceptada) return { fase: 'aceptada', actual: aceptada, asignaciones }
  const pendiente = asignaciones.find((a) => a.estado === 'pendiente')
  if (pendiente) return { fase: 'esperando', actual: pendiente, asignaciones }
  const quedanAbiertas = asignaciones.some((a) => ESTADOS_ABIERTOS.includes(a.estado))
  if (emergencia.cascada_agotada || !quedanAbiertas) {
    return { fase: 'agotada', actual: null, asignaciones }
  }
  return { fase: 'esperando', actual: null, asignaciones }
}
