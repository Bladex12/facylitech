import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../../api/endpoints'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../domain/semaforo'
import type { OrdenTrabajo } from '../../api/types'

const TIPO_LABEL: Record<string, string> = {
  mantencion: 'Mantención',
  reparacion: 'Reparación',
  inspeccion: 'Inspección',
  primera_visita: 'Primera visita',
  emergencia: 'Emergencia',
}

export function OrdenCard({ orden }: { orden: OrdenTrabajo }) {
  const { data: papeleta } = useQuery({
    queryKey: ['papeleta', orden.papeleta_id],
    queryFn: () => endpoints.papeletas.obtener(orden.papeleta_id!),
    enabled: !!orden.papeleta_id,
  })

  const hora = new Date(orden.fecha_programada).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const total = papeleta?.items.length ?? 0
  const completados = papeleta?.items.filter((i) => i.completado).length ?? 0

  return (
    <Link
      to={`/tecnico/ordenes/${orden.id}`}
      className="block rounded-lg border bg-white p-3"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono-brand text-xs font-semibold text-[var(--color-text-muted)]">
          {orden.codigo}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ${SEMAFORO_BADGE_CLASS[orden.semaforo]}`}
        >
          {SEMAFORO_LABEL[orden.semaforo]}
        </span>
      </div>
      <p className="text-sm font-medium text-[var(--color-text)]">
        {TIPO_LABEL[orden.tipo]} — {orden.ascensor.codigo}
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">{orden.ascensor.edificio.nombre}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{orden.ascensor.edificio.direccion}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span className="capitalize">{orden.prioridad}</span>
        <span className="font-mono-brand">{hora}</span>
      </div>
      {orden.descripcion && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{orden.descripcion}</p>
      )}
      {total > 0 && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
            <div
              className="h-1.5 rounded-full bg-[var(--color-accent)]"
              style={{ width: `${(completados / total) * 100}%` }}
            />
          </div>
          <p className="mt-0.5 font-mono-brand text-[10px] text-[var(--color-text-muted)]">
            {completados}/{total} ítems
          </p>
        </div>
      )}
    </Link>
  )
}
