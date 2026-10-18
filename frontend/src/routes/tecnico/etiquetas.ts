import type {
  CategoriaEquipo,
  Especialidad,
  EstadoAscensor,
  EstadoAsignacion,
  PrioridadOrdenTrabajo,
  TipoEquipo,
  TipoOrdenTrabajo,
} from '../../api/types'

/** Etiquetas y clases tomadas del mockup validado (docs/mockup/source/src/app/App.tsx). */
export const TIPO_ORDEN_LABEL: Record<TipoOrdenTrabajo, string> = {
  mantencion: 'Mantención',
  reparacion: 'Reparación',
  inspeccion: 'Inspección',
  primera_visita: 'Primera visita',
  emergencia: 'Emergencia',
}

export const PRIORIDAD_CFG: Record<PrioridadOrdenTrabajo, { label: string; color: string }> = {
  baja: { label: 'Baja', color: 'text-slate-500' },
  media: { label: 'Media', color: 'text-amber-600' },
  alta: { label: 'Alta', color: 'text-orange-600' },
  critica: { label: 'Crítica', color: 'text-red-600' },
}

export const ESPECIALIDAD_LABEL: Record<Especialidad, string> = {
  persona_atrapada: 'Persona atrapada',
  mecanica: 'Falla mecánica',
  corte_energia: 'Corte de energía',
  incendio: 'Incendio',
  inundacion: 'Inundación',
}

export const ESPECIALIDAD_COLOR: Record<Especialidad, string> = {
  persona_atrapada: 'bg-red-600',
  mecanica: 'bg-orange-500',
  corte_energia: 'bg-yellow-500',
  incendio: 'bg-rose-700',
  inundacion: 'bg-blue-600',
}

export const ESTADO_ASIGNACION_CFG: Record<EstadoAsignacion, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-red-50 text-red-700' },
  en_espera: { label: 'En espera', cls: 'bg-slate-100 text-slate-600' },
  aceptada: { label: 'Aceptada', cls: 'bg-green-50 text-green-700' },
  rechazada: { label: 'Rechazada', cls: 'bg-slate-100 text-slate-600' },
  expirada: { label: 'Expirada', cls: 'bg-amber-50 text-amber-700' },
  cancelada: { label: 'Tomada por otro técnico', cls: 'bg-slate-100 text-slate-500' },
}

export const ESTADO_EQUIPO_CFG: Record<EstadoAscensor, { label: string; color: string; dot: string }> = {
  operacional: { label: 'Operacional', color: 'text-green-700', dot: 'bg-green-500' },
  advertencia: { label: 'Advertencia', color: 'text-amber-700', dot: 'bg-amber-500' },
  critico: { label: 'Crítico', color: 'text-red-700', dot: 'bg-red-500' },
  sin_senal: { label: 'Sin señal', color: 'text-slate-500', dot: 'bg-slate-400' },
}

export const CATEGORIA_LABEL: Record<CategoriaEquipo, string> = {
  ascensor: 'Ascensor',
  montacarga: 'Montacarga',
  montaplatos: 'Montaplatos',
}

export const TIPO_EQUIPO_LABEL: Record<TipoEquipo, string> = {
  electromecanico: 'Electromecánico',
  hidraulico: 'Hidráulico',
  electrohidraulico: 'Electrohidráulico',
}
