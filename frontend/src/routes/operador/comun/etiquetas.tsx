/* Etiquetas y estilos del mockup (JOB_TYPE_LABELS, PRIORITY_CFG, STATUS_ELV,
   BUILDING_TYPE_*) traducidos al dominio en español. Los colores del
   semáforo NO van aquí: su única fuente es domain/semaforo.ts. */
import type { ReactNode } from 'react'
import {
  ArrowUpDown,
  Building2,
  Briefcase,
  Factory,
  Heart,
  Hotel,
  Landmark,
  Package,
  Utensils,
} from 'lucide-react'
import type {
  CategoriaEquipo,
  EstadoAscensor,
  EstadoOrdenTrabajo,
  PrioridadOrdenTrabajo,
  TipoCliente,
  TipoEdificio,
  TipoEquipo,
  TipoOrdenTrabajo,
} from '../../../api/types'

export const TIPO_OT_LABEL: Record<TipoOrdenTrabajo, string> = {
  mantencion: 'Mantención',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
  inspeccion: 'Inspección',
  primera_visita: 'Primera visita',
}

/** Color de la etiqueta de tipo en la bitácora (mockup: logbook). */
export const TIPO_OT_CLASS: Record<TipoOrdenTrabajo, string> = {
  mantencion: 'bg-green-50 text-green-700',
  inspeccion: 'bg-sky-50 text-sky-700',
  primera_visita: 'bg-slate-100 text-slate-700',
  reparacion: 'bg-amber-50 text-amber-700',
  emergencia: 'bg-red-50 text-red-700',
}

export const PRIORIDAD_CFG: Record<PrioridadOrdenTrabajo, { label: string; color: string }> = {
  baja: { label: 'Baja', color: 'text-slate-500' },
  media: { label: 'Media', color: 'text-amber-600' },
  alta: { label: 'Alta', color: 'text-orange-600' },
  critica: { label: 'Crítica', color: 'text-red-600' },
}

export const PRIORIDADES: PrioridadOrdenTrabajo[] = ['baja', 'media', 'alta', 'critica']

export const ESTADO_OT_LABEL: Record<EstadoOrdenTrabajo, string> = {
  programado: 'Programado',
  en_curso: 'En curso',
  completado: 'Completado',
  cancelado: 'Cancelado',
}

export const ESTADO_EQUIPO: Record<
  EstadoAscensor,
  { label: string; color: string; dot: string; bg: string }
> = {
  operacional: { label: 'Operacional', color: 'text-green-700', dot: 'bg-green-500', bg: 'bg-green-50' },
  advertencia: { label: 'Advertencia', color: 'text-amber-700', dot: 'bg-amber-500', bg: 'bg-amber-50' },
  critico: { label: 'Crítico', color: 'text-red-700', dot: 'bg-red-500', bg: 'bg-red-50' },
  sin_senal: { label: 'Fuera de línea', color: 'text-slate-500', dot: 'bg-slate-400', bg: 'bg-slate-100' },
}

export const ESTADOS_EQUIPO: EstadoAscensor[] = ['operacional', 'advertencia', 'critico', 'sin_senal']

export const CATEGORIA_CFG: Record<
  CategoriaEquipo,
  { label: string; plural: string; icono: ReactNode }
> = {
  ascensor: { label: 'Ascensor', plural: 'Ascensores', icono: <ArrowUpDown size={12} /> },
  montacarga: { label: 'Montacarga', plural: 'Montacargas', icono: <Package size={12} /> },
  montaplatos: { label: 'Montaplatos', plural: 'Montaplatos', icono: <Utensils size={12} /> },
}

export const TIPO_EQUIPO_LABEL: Record<TipoEquipo, string> = {
  electromecanico: 'Electromecánico',
  hidraulico: 'Hidráulico',
  electrohidraulico: 'Electrohidráulico',
}

/** Mockup BUILDING_TYPE_COLORS (#3B82F6, #EF4444…) como clases Tailwind equivalentes. */
export const TIPO_EDIFICIO_CFG: Record<
  TipoEdificio,
  { label: string; icono: ReactNode; clase: string }
> = {
  residencial: { label: 'Residencial', icono: <Building2 size={13} />, clase: 'bg-blue-500/10 text-blue-500' },
  hospital: { label: 'Hospital / clínica', icono: <Heart size={13} />, clase: 'bg-red-500/10 text-red-500' },
  industrial: { label: 'Industrial', icono: <Factory size={13} />, clase: 'bg-amber-500/10 text-amber-500' },
  hotel: { label: 'Hotel', icono: <Hotel size={13} />, clase: 'bg-violet-500/10 text-violet-500' },
  oficina: { label: 'Oficinas', icono: <Briefcase size={13} />, clase: 'bg-emerald-500/10 text-emerald-500' },
  publico: { label: 'Público', icono: <Landmark size={13} />, clase: 'bg-cyan-500/10 text-cyan-500' },
}

export function tipoEdificioCfg(tipo: TipoEdificio | string) {
  return TIPO_EDIFICIO_CFG[tipo as TipoEdificio] ?? TIPO_EDIFICIO_CFG.residencial
}

export const TIPO_CLIENTE_LABEL: Record<TipoCliente, string> = {
  comunidad: 'Comunidad',
  fondo_inversion: 'Fondo de inversión',
  administracion: 'Administración',
  corporativo: 'Corporativo',
  publico: 'Público',
  otro: 'Otro',
}

export function fmtFecha(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function fmtFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
