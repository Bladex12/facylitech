import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, MapPin, Zap } from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../domain/semaforo'
import type { OrdenTrabajo } from '../../api/types'
import { PRIORIDAD_CFG, TIPO_ORDEN_LABEL } from './etiquetas'

/** Tarjeta de OT del técnico (estilo `TechMyJobs` del mockup). */
export function OrdenCard({
  orden,
  mostrarFecha = false,
  numero,
}: {
  orden: OrdenTrabajo
  /** En listas agrupadas por día basta la hora; en listas sueltas se muestra la fecha. */
  mostrarFecha?: boolean
  /** Número de parada en la ruta del día (Mapa). */
  numero?: number
}) {
  const { data: papeleta } = useQuery({
    queryKey: ['papeleta', orden.papeleta_id],
    queryFn: () => endpoints.papeletas.obtener(orden.papeleta_id!),
    enabled: !!orden.papeleta_id && orden.estado !== 'completado',
    staleTime: 60_000,
  })

  const fecha = new Date(orden.fecha_programada)
  const hora = fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const dia = fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
  const total = papeleta?.items.length ?? 0
  const completados = papeleta?.items.filter((i) => i.completado).length ?? 0
  const prioridad = PRIORIDAD_CFG[orden.prioridad]
  const esEmergencia = orden.tipo === 'emergencia'

  return (
    <Link
      to={`/tecnico/ordenes/${orden.id}`}
      className={`block rounded-lg border bg-white p-4 transition-all active:scale-[0.99] active:shadow-sm ${
        esEmergencia && orden.estado !== 'completado'
          ? 'border-red-200 border-l-4 border-l-red-600'
          : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-start gap-3">
        {numero != null && (
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] font-mono-brand text-xs font-bold text-white">
            {numero}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono-brand text-xs font-semibold text-[var(--color-accent)]">
              {orden.codigo}
            </span>
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 font-mono-brand text-[10px] font-medium ${SEMAFORO_BADGE_CLASS[orden.semaforo]}`}
            >
              {SEMAFORO_LABEL[orden.semaforo]}
            </span>
            <span className={`font-mono-brand text-[10px] font-semibold ${prioridad.color}`}>
              {prioridad.label}
            </span>
          </div>
          <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
            {esEmergencia && <Zap size={14} className="flex-shrink-0 text-red-600" />}
            <span className="truncate">
              {TIPO_ORDEN_LABEL[orden.tipo]} — {orden.ascensor.codigo}
            </span>
          </div>
          <div className="text-xs text-[var(--color-text)]">{orden.ascensor.edificio.nombre}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">
              {orden.ascensor.edificio.direccion}, {orden.ascensor.edificio.comuna}
            </span>
          </div>
          <div className="mt-1.5 font-mono-brand text-xs text-[var(--color-text-muted)]">
            {mostrarFecha ? `${dia} · ${hora}` : hora}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 self-center">
          {total > 0 && (
            <div className="text-right">
              <div className="font-mono-brand text-xs text-[var(--color-text-muted)]">
                {completados}/{total}
              </div>
              <div className="mt-1 h-1 w-12 overflow-hidden rounded-full bg-[var(--color-bg)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${Math.round((completados / total) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <ChevronRight size={15} className="text-[var(--color-text-muted)]" />
        </div>
      </div>
    </Link>
  )
}
