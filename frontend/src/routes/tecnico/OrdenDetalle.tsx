import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../../api/endpoints'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../domain/semaforo'

export function OrdenDetalle() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const ordenQuery = useQuery({
    queryKey: ['orden', id],
    queryFn: () => endpoints.ordenes.obtener(id!),
    enabled: !!id,
  })
  const orden = ordenQuery.data

  const edificioQuery = useQuery({
    queryKey: ['edificio', orden?.ascensor.edificio.id],
    queryFn: () => endpoints.edificios.obtener(orden!.ascensor.edificio.id),
    enabled: !!orden,
  })

  const papeletaQuery = useQuery({
    queryKey: ['papeleta', orden?.papeleta_id],
    queryFn: () => endpoints.papeletas.obtener(orden!.papeleta_id!),
    enabled: !!orden?.papeleta_id,
  })
  const papeleta = papeletaQuery.data

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['orden', id] })
    queryClient.invalidateQueries({ queryKey: ['papeleta'] })
    queryClient.invalidateQueries({ queryKey: ['ordenes'] })
  }

  const iniciarMutation = useMutation({
    mutationFn: () => endpoints.ordenes.iniciar(id!),
    onSuccess: invalidar,
  })
  const crearPapeletaMutation = useMutation({
    mutationFn: () => endpoints.ordenes.crearPapeleta(id!),
    onSuccess: invalidar,
  })
  const marcarItemMutation = useMutation({
    mutationFn: ({ itemId, completado }: { itemId: string; completado: boolean }) =>
      endpoints.papeletas.marcarItem(papeleta!.id, itemId, { completado }),
    onSuccess: invalidar,
  })
  const actualizarPapeletaMutation = useMutation({
    mutationFn: (datos: Partial<import('../../api/types').Papeleta>) =>
      endpoints.papeletas.actualizar(papeleta!.id, datos),
    onSuccess: invalidar,
  })
  const enviarPapeletaMutation = useMutation({
    mutationFn: () => endpoints.papeletas.enviar(papeleta!.id),
    onSuccess: invalidar,
  })
  const completarMutation = useMutation({
    mutationFn: () => endpoints.ordenes.completar(id!),
    onSuccess: invalidar,
  })

  if (ordenQuery.isLoading || !orden) return <p className="p-4 text-sm text-gray-400">Cargando…</p>

  const edificio = edificioQuery.data
  const puedeIniciar = orden.estado === 'programado'
  const puedeCompletar = orden.estado === 'en_curso' && papeleta?.estado === 'enviada'

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400">{orden.codigo}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${SEMAFORO_BADGE_CLASS[orden.semaforo]}`}>
            {SEMAFORO_LABEL[orden.semaforo]}
          </span>
        </div>
        <h1 className="text-lg font-semibold">
          {orden.ascensor.codigo} — {orden.ascensor.edificio.nombre}
        </h1>
        <p className="text-sm text-gray-500">{orden.ascensor.edificio.direccion}</p>
        <p className="text-sm text-gray-500">
          {new Date(orden.fecha_programada).toLocaleString('es-CL')}
        </p>
        {orden.descripcion && <p className="mt-1 text-sm text-gray-600">{orden.descripcion}</p>}
      </div>

      {edificio && (edificio.manas || edificio.instrucciones_reinicio) && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase text-amber-700">
            Mañas e instrucciones del edificio
          </p>
          {edificio.manas && <p className="text-sm text-amber-900">{edificio.manas}</p>}
          {edificio.instrucciones_reinicio && (
            <p className="mt-1 text-sm text-amber-900">
              <span className="font-medium">Reinicio:</span> {edificio.instrucciones_reinicio}
            </p>
          )}
        </div>
      )}

      {puedeIniciar && (
        <button
          onClick={() => iniciarMutation.mutate()}
          disabled={iniciarMutation.isPending}
          className="w-full rounded-lg bg-[#1e2a78] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Iniciar
        </button>
      )}

      {orden.estado === 'en_curso' && !orden.papeleta_id && (
        <button
          onClick={() => crearPapeletaMutation.mutate()}
          disabled={crearPapeletaMutation.isPending}
          className="w-full rounded-lg bg-[#1e2a78] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Crear papeleta
        </button>
      )}

      {papeleta && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
          <div>
            <p className="mb-2 text-sm font-semibold">Checklist</p>
            <div className="space-y-2">
              {papeleta.checklist.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.completado}
                    disabled={papeleta.estado === 'enviada'}
                    onChange={(e) =>
                      marcarItemMutation.mutate({ itemId: item.id, completado: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span className={item.completado ? 'text-gray-400 line-through' : ''}>
                    {item.descripcion}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500">
              Observaciones
              <textarea
                disabled={papeleta.estado === 'enviada'}
                defaultValue={papeleta.observaciones ?? ''}
                onBlur={(e) => actualizarPapeletaMutation.mutate({ observaciones: e.target.value })}
                className="mt-1 w-full rounded border border-gray-200 p-2 text-sm disabled:bg-gray-50"
                rows={2}
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Falla detectada
              <textarea
                disabled={papeleta.estado === 'enviada'}
                defaultValue={papeleta.falla_detectada ?? ''}
                onBlur={(e) =>
                  actualizarPapeletaMutation.mutate({ falla_detectada: e.target.value })
                }
                className="mt-1 w-full rounded border border-gray-200 p-2 text-sm disabled:bg-gray-50"
                rows={2}
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Trabajo realizado
              <textarea
                disabled={papeleta.estado === 'enviada'}
                defaultValue={papeleta.trabajo_realizado ?? ''}
                onBlur={(e) =>
                  actualizarPapeletaMutation.mutate({ trabajo_realizado: e.target.value })
                }
                className="mt-1 w-full rounded border border-gray-200 p-2 text-sm disabled:bg-gray-50"
                rows={2}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={papeleta.estado === 'enviada'}
                checked={papeleta.causada_por_terceros}
                onChange={(e) =>
                  actualizarPapeletaMutation.mutate({ causada_por_terceros: e.target.checked })
                }
              />
              ¿Causada por terceros?
            </label>
          </div>

          <button
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-400"
          >
            Adjuntar fotos — Próximamente
          </button>

          {papeleta.estado === 'borrador' && (
            <button
              onClick={() => enviarPapeletaMutation.mutate()}
              disabled={enviarPapeletaMutation.isPending}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Enviar papeleta
            </button>
          )}
          {papeleta.estado === 'enviada' && (
            <p className="text-center text-xs text-emerald-600">Papeleta enviada</p>
          )}
        </div>
      )}

      {puedeCompletar && (
        <button
          onClick={() => completarMutation.mutate()}
          disabled={completarMutation.isPending}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Completar orden
        </button>
      )}
      {orden.estado === 'completado' && (
        <p className="text-center text-sm font-medium text-emerald-600">Orden completada ✓</p>
      )}
    </div>
  )
}
