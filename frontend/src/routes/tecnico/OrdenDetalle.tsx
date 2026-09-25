import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../../api/endpoints'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../domain/semaforo'
import type { Papeleta } from '../../api/types'

export function OrdenDetalle() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [nuevaPieza, setNuevaPieza] = useState({ nombre: '', marca: '', esOriginal: true })

  const ordenQuery = useQuery({
    queryKey: ['orden', id],
    queryFn: () => endpoints.ordenes.obtener(id!),
    enabled: !!id,
  })
  const orden = ordenQuery.data

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
    mutationFn: (datos: Partial<Papeleta>) => endpoints.papeletas.actualizar(papeleta!.id, datos),
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
  const agregarPiezaMutation = useMutation({
    mutationFn: () =>
      endpoints.papeletas.agregarPieza(papeleta!.id, {
        nombre: nuevaPieza.nombre,
        marca: nuevaPieza.marca || null,
        es_original: nuevaPieza.esOriginal,
      }),
    onSuccess: () => {
      setNuevaPieza({ nombre: '', marca: '', esOriginal: true })
      invalidar()
    },
  })

  if (ordenQuery.isLoading || !orden)
    return <p className="p-4 text-sm text-[var(--color-text-muted)]">Cargando…</p>

  const puedeIniciar = orden.estado === 'programado'
  const puedeCompletar = orden.estado === 'en_curso' && papeleta?.estado === 'enviada'
  const soloLectura = papeleta?.estado === 'enviada'
  const manasEdificio = orden.ascensor.edificio.manas
  const instrucciones = orden.ascensor.edificio.instrucciones_reinicio
  const manasAscensor = orden.ascensor.manas

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono-brand text-xs font-semibold text-[var(--color-text-muted)]">
            {orden.codigo}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${SEMAFORO_BADGE_CLASS[orden.semaforo]}`}
          >
            {SEMAFORO_LABEL[orden.semaforo]}
          </span>
        </div>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          {orden.ascensor.codigo} — {orden.ascensor.edificio.nombre}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{orden.ascensor.edificio.direccion}</p>
        <p className="font-mono-brand text-sm text-[var(--color-text-muted)]">
          {new Date(orden.fecha_programada).toLocaleString('es-CL')}
        </p>
        {orden.descripcion && (
          <p className="mt-1 text-sm text-[var(--color-text)]">{orden.descripcion}</p>
        )}
      </div>

      {(manasEdificio || instrucciones || manasAscensor) && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
          <p className="mb-1 text-xs font-semibold text-amber-700 uppercase">
            Mañas e instrucciones
          </p>
          {manasEdificio && (
            <p className="text-sm text-amber-900">
              <span className="font-medium">Edificio:</span> {manasEdificio}
            </p>
          )}
          {manasAscensor && (
            <p className="mt-1 text-sm text-amber-900">
              <span className="font-medium">Ascensor:</span> {manasAscensor}
            </p>
          )}
          {instrucciones && (
            <p className="mt-1 text-sm text-amber-900">
              <span className="font-medium">Reinicio:</span> {instrucciones}
            </p>
          )}
        </div>
      )}

      {puedeIniciar && (
        <button
          onClick={() => iniciarMutation.mutate()}
          disabled={iniciarMutation.isPending}
          className="w-full rounded-lg bg-[var(--color-navy)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Iniciar
        </button>
      )}

      {orden.estado === 'en_curso' && !orden.papeleta_id && (
        <button
          onClick={() => crearPapeletaMutation.mutate()}
          disabled={crearPapeletaMutation.isPending}
          className="w-full rounded-lg bg-[var(--color-navy)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Crear papeleta
        </button>
      )}

      {papeleta && (
        <div
          className="space-y-4 rounded-lg border bg-white p-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text)]">Checklist</p>
              {papeleta.total_items_pauta != null && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  Este mes corresponden {papeleta.items.length} de {papeleta.total_items_pauta}{' '}
                  ítems de la pauta
                </span>
              )}
            </div>
            <div className="space-y-2">
              {papeleta.items.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Ningún ítem de la pauta corresponde a este mes.
                </p>
              )}
              {papeleta.items.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.completado}
                    disabled={soloLectura}
                    onChange={(e) =>
                      marcarItemMutation.mutate({ itemId: item.id, completado: e.target.checked })
                    }
                    className="mt-0.5 accent-[var(--color-accent)]"
                  />
                  <span
                    className={
                      item.completado
                        ? 'text-[var(--color-text-muted)] line-through'
                        : 'text-[var(--color-text)]'
                    }
                  >
                    {item.descripcion}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">
              Observaciones
              <textarea
                disabled={soloLectura}
                defaultValue={papeleta.observaciones ?? ''}
                onBlur={(e) => actualizarPapeletaMutation.mutate({ observaciones: e.target.value })}
                className="mt-1 w-full rounded border p-2 text-sm disabled:bg-[var(--color-bg-subtle)]"
                style={{ borderColor: 'var(--color-border)' }}
                rows={2}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">
              Falla detectada
              <textarea
                disabled={soloLectura}
                defaultValue={papeleta.falla_detectada ?? ''}
                onBlur={(e) =>
                  actualizarPapeletaMutation.mutate({ falla_detectada: e.target.value })
                }
                className="mt-1 w-full rounded border p-2 text-sm disabled:bg-[var(--color-bg-subtle)]"
                style={{ borderColor: 'var(--color-border)' }}
                rows={2}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">
              Trabajo realizado
              <textarea
                disabled={soloLectura}
                defaultValue={papeleta.trabajo_realizado ?? ''}
                onBlur={(e) =>
                  actualizarPapeletaMutation.mutate({ trabajo_realizado: e.target.value })
                }
                className="mt-1 w-full rounded border p-2 text-sm disabled:bg-[var(--color-bg-subtle)]"
                style={{ borderColor: 'var(--color-border)' }}
                rows={2}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={soloLectura}
                checked={papeleta.causada_por_terceros}
                onChange={(e) =>
                  actualizarPapeletaMutation.mutate({ causada_por_terceros: e.target.checked })
                }
                className="accent-[var(--color-accent)]"
              />
              ¿Causada por terceros?
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
              Piezas reemplazadas
            </p>
            {papeleta.piezas.length > 0 && (
              <ul className="mb-2 space-y-1 text-sm">
                {papeleta.piezas.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded bg-[var(--color-bg-subtle)] px-2 py-1"
                  >
                    <span>
                      {p.nombre} {p.marca && <span className="text-[var(--color-text-muted)]">— {p.marca}</span>}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${p.es_original ? 'text-emerald-600' : 'text-amber-600'}`}
                    >
                      {p.es_original ? 'Original' : 'No original'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!soloLectura && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  placeholder="Nombre de la pieza"
                  value={nuevaPieza.nombre}
                  onChange={(e) => setNuevaPieza((p) => ({ ...p, nombre: e.target.value }))}
                  className="min-w-0 flex-1 rounded border p-1.5 text-xs"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <input
                  placeholder="Marca"
                  value={nuevaPieza.marca}
                  onChange={(e) => setNuevaPieza((p) => ({ ...p, marca: e.target.value }))}
                  className="w-24 rounded border p-1.5 text-xs"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  <input
                    type="checkbox"
                    checked={nuevaPieza.esOriginal}
                    onChange={(e) =>
                      setNuevaPieza((p) => ({ ...p, esOriginal: e.target.checked }))
                    }
                    className="accent-[var(--color-accent)]"
                  />
                  Original
                </label>
                <button
                  onClick={() => nuevaPieza.nombre && agregarPiezaMutation.mutate()}
                  disabled={!nuevaPieza.nombre || agregarPiezaMutation.isPending}
                  className="rounded bg-[var(--color-navy)] px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Agregar
                </button>
              </div>
            )}
          </div>

          <button
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-dashed py-2 text-xs text-[var(--color-text-muted)]"
            style={{ borderColor: 'var(--color-border)' }}
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
