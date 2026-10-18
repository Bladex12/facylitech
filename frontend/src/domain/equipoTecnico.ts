import type { EstadoDisponibilidadTecnico, OrdenTrabajo, Usuario } from '../api/types'
import { fechaLocalIso } from './tiempoRelativo'

export const DISPONIBILIDAD: Record<
  EstadoDisponibilidadTecnico | 'sin_estado',
  { label: string; cls: string; dot: string }
> = {
  disponible: { label: 'Disponible', cls: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  en_terreno: { label: 'En terreno', cls: 'bg-amber-50 text-amber-700', dot: 'bg-[var(--color-accent)]' },
  sin_estado: { label: 'Sin estado', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
}

export function claveDisponibilidad(
  estado: EstadoDisponibilidadTecnico | null | undefined,
): EstadoDisponibilidadTecnico | 'sin_estado' {
  return estado ?? 'sin_estado'
}

/** Una ubicación más antigua que el umbral se marca como desactualizada en la UI. */
export const UMBRAL_UBICACION_MIN = 30

export function ubicacionDesactualizada(
  iso: string | null | undefined,
  ahora: Date,
  umbralMin = UMBRAL_UBICACION_MIN,
): boolean {
  if (!iso) return true
  return ahora.getTime() - new Date(iso).getTime() > umbralMin * 60_000
}

export interface CargaTrabajo {
  hoy: number
  /** De hoy, las que siguen sin completar. */
  hoyPendientes: number
  semana: number
  vencidas: number
  enCurso: number
  /** Órdenes por día de la semana, lunes = índice 0. */
  porDia: number[]
}

/**
 * Carga de un técnico a partir de sus órdenes de la semana (lunes a domingo).
 * Las canceladas no cuentan como carga.
 */
export function calcularCarga(ordenes: OrdenTrabajo[], ahora: Date): CargaTrabajo {
  const hoyIso = fechaLocalIso(ahora)
  const vigentes = ordenes.filter((o) => o.estado !== 'cancelado')
  const porDia = [0, 0, 0, 0, 0, 0, 0]
  let hoy = 0
  let hoyPendientes = 0
  for (const o of vigentes) {
    const fecha = new Date(o.fecha_programada)
    porDia[(fecha.getDay() + 6) % 7]! += 1
    if (fechaLocalIso(fecha) === hoyIso) {
      hoy += 1
      if (o.estado !== 'completado') hoyPendientes += 1
    }
  }
  return {
    hoy,
    hoyPendientes,
    semana: vigentes.length,
    vencidas: vigentes.filter((o) => o.semaforo === 'vencido').length,
    enCurso: vigentes.filter((o) => o.semaforo === 'en_curso').length,
    porDia,
  }
}

export type FiltroDisponibilidad = 'todos' | EstadoDisponibilidadTecnico

/** Filtra por texto (nombre, zona, RUT) y por disponibilidad; ordena por nombre. */
export function filtrarTecnicos(
  tecnicos: Usuario[],
  filtro: { texto: string; disponibilidad: FiltroDisponibilidad },
): Usuario[] {
  const texto = normalizar(filtro.texto.trim())
  return tecnicos
    .filter((t) => filtro.disponibilidad === 'todos' || t.estado_disponibilidad === filtro.disponibilidad)
    .filter(
      (t) =>
        !texto ||
        [t.nombre, t.zona, t.rut].some((campo) => campo && normalizar(campo).includes(texto)),
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
