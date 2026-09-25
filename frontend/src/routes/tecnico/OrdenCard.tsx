import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../../api/endpoints'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../domain/semaforo'
import type { OrdenTrabajo } from '../../api/types'

const TIPO_LABEL: Record<string, string> = {
  mantencion: 'Mantención',
  reparacion: 'Reparación',
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
  const total = papeleta?.checklist.length ?? 0
  const completados = papeleta?.checklist.filter((i) => i.completado).length ?? 0

  return (
    <Link
      to={`/tecnico/ordenes/${orden.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">{orden.codigo}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${SEMAFORO_BADGE_CLASS[orden.semaforo]}`}>
          {SEMAFORO_LABEL[orden.semaforo]}
        </span>
      </div>
      <p className="text-sm font-medium">
        {TIPO_LABEL[orden.tipo]} — {orden.ascensor.codigo}
      </p>
      <p className="text-xs text-gray-500">{orden.ascensor.edificio.nombre}</p>
      <p className="text-xs text-gray-400">{orden.ascensor.edificio.direccion}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span className="capitalize">{orden.prioridad}</span>
        <span>{hora}</span>
      </div>
      {orden.descripcion && <p className="mt-1 text-xs text-gray-400">{orden.descripcion}</p>}
      {total > 0 && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-[#1e2a78]"
              style={{ width: `${(completados / total) * 100}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-gray-400">
            {completados}/{total} ítems
          </p>
        </div>
      )}
    </Link>
  )
}
