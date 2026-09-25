import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { ordenarListado } from '../../domain/ordenamiento'
import { OrdenCard } from './OrdenCard'
import type { OrdenTrabajo } from '../../api/types'

function isoFechaLocal(fechaIso: string): string {
  return new Date(fechaIso).toLocaleDateString('sv-SE') // YYYY-MM-DD estable
}

export function Agenda() {
  const { usuario } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['ordenes', 'agenda', usuario?.id],
    queryFn: () => endpoints.ordenes.listar({ tecnico_id: usuario!.id, limit: 100 }),
    enabled: !!usuario,
  })

  const grupos = useMemo(() => {
    const hoy = new Date()
    const hoyIso = hoy.toLocaleDateString('sv-SE')
    const mañana = new Date(hoy)
    mañana.setDate(hoy.getDate() + 1)
    const mañanaIso = mañana.toLocaleDateString('sv-SE')
    const pasado = new Date(hoy)
    pasado.setDate(hoy.getDate() + 2)
    const pasadoIso = pasado.toLocaleDateString('sv-SE')

    const buckets: Record<string, OrdenTrabajo[]> = {
      Hoy: [],
      Mañana: [],
      'Pasado mañana': [],
      'Próximos días': [],
    }
    for (const orden of data?.items ?? []) {
      const fecha = isoFechaLocal(orden.fecha_programada)
      if (fecha === hoyIso) buckets['Hoy'].push(orden)
      else if (fecha === mañanaIso) buckets['Mañana'].push(orden)
      else if (fecha === pasadoIso) buckets['Pasado mañana'].push(orden)
      else if (fecha > hoyIso) buckets['Próximos días'].push(orden)
    }
    for (const key of Object.keys(buckets)) buckets[key] = ordenarListado(buckets[key])
    return buckets
  }, [data])

  if (isLoading) return <p className="p-4 text-sm text-gray-400">Cargando agenda…</p>

  const hayOrdenes = Object.values(grupos).some((g) => g.length > 0)

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-lg font-semibold text-[#1e2a78]">Mi Agenda</h1>
      {!hayOrdenes && <p className="text-sm text-gray-400">No tienes órdenes próximas.</p>}
      {Object.entries(grupos).map(
        ([titulo, ordenes]) =>
          ordenes.length > 0 && (
            <section key={titulo}>
              <h2 className="mb-2 text-xs font-semibold uppercase text-gray-400">{titulo}</h2>
              <div className="space-y-2">
                {ordenes.map((orden) => (
                  <OrdenCard key={orden.id} orden={orden} />
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  )
}
