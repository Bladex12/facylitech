import { mensajeError } from '../comun/errores'
import { ChevronRight } from 'lucide-react'
import type { OrdenTrabajo } from '../../../api/types'
import { SEMAFORO_DOT_CLASS } from '../../../domain/semaforo'
import { PRIORIDAD_CFG, TIPO_OT_LABEL, fmtFechaHora } from '../comun/etiquetas'
import { BadgeSemaforo, Cargando } from '../comun/ui'

/** Lista compacta de OTs pendientes (ficha de edificio y de equipo). */
export function ListaProximasOts({
  ordenes,
  isLoading,
  error,
  onAbrir,
  mostrarEquipo,
  vacio,
}: {
  ordenes: OrdenTrabajo[]
  isLoading: boolean
  error: unknown
  onAbrir: (o: OrdenTrabajo) => void
  mostrarEquipo?: boolean
  vacio: string
}) {
  if (isLoading) return <Cargando texto="Cargando OTs…" />
  if (error)
    return <p className="p-4 text-sm text-red-700">No se pudieron cargar las OTs: {mensajeError(error)}</p>
  if (ordenes.length === 0)
    return <p className="p-5 text-center text-sm text-[var(--color-text-muted)]">{vacio}</p>
  return (
    <div className="divide-y divide-[var(--color-border)]/60">
      {ordenes.map((o) => (
        <button
          key={o.id}
          onClick={() => onAbrir(o)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-subtle)]"
        >
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${SEMAFORO_DOT_CLASS[o.semaforo]}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-mono-brand text-xs font-semibold text-[var(--color-accent)]">{o.codigo}</span>
                {mostrarEquipo && (
                  <span className="font-mono-brand text-xs font-semibold text-[var(--color-text)]">{o.ascensor.codigo}</span>
                )}
              </span>
              <BadgeSemaforo semaforo={o.semaforo} />
            </div>
            <div className="truncate text-xs text-gray-700">
              {TIPO_OT_LABEL[o.tipo]} ·{' '}
              <span className={`font-semibold ${PRIORIDAD_CFG[o.prioridad].color}`}>
                {PRIORIDAD_CFG[o.prioridad].label}
              </span>
            </div>
            <div className="truncate text-xs text-[var(--color-text-muted)]">
              <span className="capitalize">{fmtFechaHora(o.fecha_programada)}</span> ·{' '}
              {o.tecnico?.nombre ?? <span className="text-amber-700">sin técnico</span>}
            </div>
          </div>
          <ChevronRight size={13} className="text-[var(--color-text-muted)]" />
        </button>
      ))}
    </div>
  )
}
