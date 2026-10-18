import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Marker } from 'react-leaflet'
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  MapPin,
  RotateCcw,
  User,
} from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type { Emergencia } from '../../../api/types'
import { MapaBase } from '../../../components/mapa/MapaBase'
import { Cargando, ErrorConsulta } from '../../../components/operador/EstadoConsulta'
import { iconoEmergencia } from '../../../components/operador/iconosMapa'
import { useAhora } from '../../../components/operador/useAhora'
import {
  EMERGENCIA_COLOR_CLASS,
  EMERGENCIA_LABEL,
  ESTADO_EMERGENCIA,
  resumirCascada,
} from '../../../domain/emergencias'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../../domain/semaforo'
import { formatoHora, tiempoTranscurrido } from '../../../domain/tiempoRelativo'
import { ArmarCascada } from './ArmarCascada'
import { LineaTiempoCascada } from './LineaTiempoCascada'

export function DetalleEmergencia({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const ahora = useAhora(30_000)
  const [redespachando, setRedespachando] = useState(false)
  const [confirmarCierre, setConfirmarCierre] = useState(false)

  const consulta = useQuery({
    queryKey: ['emergencias', id],
    queryFn: () => endpoints.emergencias.obtener(id),
    // La cascada avanza de forma perezosa en el backend: se re-lee cada 10 s.
    refetchInterval: (q) => (q.state.data?.estado === 'cerrada' ? false : 10_000),
    retry: 1,
  })

  function actualizar(e: Emergencia) {
    queryClient.setQueryData(['emergencias', id], e)
    queryClient.invalidateQueries({ queryKey: ['emergencias', 'lista'] })
    queryClient.invalidateQueries({ queryKey: ['mapa'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const cerrar = useMutation({
    mutationFn: () => endpoints.emergencias.cambiarEstado(id, 'cerrada'),
    onSuccess: (e) => {
      setConfirmarCierre(false)
      actualizar(e)
    },
  })

  if (consulta.isLoading) return <Cargando texto="Cargando emergencia…" />
  if (consulta.isError || !consulta.data) {
    return (
      <ErrorConsulta
        error={consulta.error}
        titulo="No se pudo cargar la emergencia"
        onReintentar={() => consulta.refetch()}
      />
    )
  }

  const em = consulta.data
  const resumen = resumirCascada(em)
  const cerrada = em.estado === 'cerrada'
  const mostrarArmado =
    !cerrada && (resumen.fase === 'sin_despacho' || (resumen.fase === 'agotada' && redespachando))

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className={`rounded-lg border bg-white p-5 ${cerrada ? 'border-[var(--color-border)]' : 'border-red-200'}`}>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className={`${EMERGENCIA_COLOR_CLASS[em.tipo]} rounded px-2 py-1 text-sm font-semibold text-white`}>
                {EMERGENCIA_LABEL[em.tipo]}
              </div>
              <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">{em.codigo}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs ${ESTADO_EMERGENCIA[em.estado].cls} ${em.estado === 'activa' ? 'animate-pulse' : ''}`}
              >
                {ESTADO_EMERGENCIA[em.estado].label}
              </span>
            </div>
            {em.descripcion && (
              <p className="mb-3 text-sm leading-relaxed text-slate-700">{em.descripcion}</p>
            )}
            <div className="space-y-1 text-xs text-[var(--color-text-muted)]">
              <div className="flex items-center gap-1.5">
                <Building2 size={11} />
                <span className="font-medium text-[var(--color-text)]">{em.edificio.nombre}</span>
                {em.ascensor && <span className="font-mono-brand">· {em.ascensor.codigo}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={11} /> {em.edificio.direccion}
              </div>
              {em.solicitante && (
                <div className="flex items-center gap-1.5">
                  <User size={11} /> {em.solicitante}
                </div>
              )}
              <div className="flex items-center gap-1.5 font-mono">
                <Clock size={11} /> Reportada {formatoHora(em.reportada_at)} ·{' '}
                <span className={em.estado === 'activa' ? 'font-semibold text-red-600' : ''}>
                  {tiempoTranscurrido(em.reportada_at, ahora)}
                </span>
              </div>
            </div>
          </div>
          {em.ubicacion && (
            <div className="h-36 w-full flex-shrink-0 overflow-hidden rounded border border-[var(--color-border)] sm:w-56">
              <MapaBase centro={em.ubicacion} zoom={15}>
                <Marker
                  position={[em.ubicacion.lat, em.ubicacion.lon]}
                  icon={iconoEmergencia({ pulsante: em.estado === 'activa' })}
                />
              </MapaBase>
            </div>
          )}
        </div>

        {/* Acciones */}
        {!cerrada && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-bg-subtle)] pt-3">
            {cerrar.isError && (
              <span className="mr-auto text-xs text-red-600">
                No se pudo cerrar: {(cerrar.error as Error).message}
              </span>
            )}
            {confirmarCierre ? (
              <>
                <span className="text-xs text-[var(--color-text-muted)]">
                  ¿Cerrar la emergencia? Se cancelan las notificaciones pendientes.
                </span>
                <button
                  onClick={() => setConfirmarCierre(false)}
                  className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-slate-700 hover:bg-[var(--color-bg-subtle)]"
                >
                  Volver
                </button>
                <button
                  onClick={() => cerrar.mutate()}
                  disabled={cerrar.isPending}
                  className="flex items-center gap-1.5 rounded bg-[var(--color-navy)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Lock size={11} /> {cerrar.isPending ? 'Cerrando…' : 'Sí, cerrar'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmarCierre(true)}
                className="flex items-center gap-1.5 rounded border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--color-bg-subtle)]"
              >
                <CheckCircle2 size={12} /> Cerrar emergencia
              </button>
            )}
          </div>
        )}
      </div>

      {em.orden_trabajo_id && <TarjetaOrden ordenId={em.orden_trabajo_id} />}

      {mostrarArmado && (
        <ArmarCascada
          emergencia={em}
          esRedespacho={resumen.fase === 'agotada'}
          onDespachada={(e) => {
            setRedespachando(false)
            actualizar(e)
          }}
          onCancelar={resumen.fase === 'agotada' ? () => setRedespachando(false) : undefined}
        />
      )}

      {!mostrarArmado && resumen.fase !== 'sin_despacho' && (
        <LineaTiempoCascada
          resumen={resumen}
          cerrada={cerrada}
          onVencida={() => consulta.refetch()}
          accion={
            resumen.fase === 'agotada' && !cerrada ? (
              <button
                onClick={() => setRedespachando(true)}
                className="flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                <RotateCcw size={12} /> Re-despachar
              </button>
            ) : null
          }
        />
      )}

      {cerrada && resumen.fase === 'sin_despacho' && (
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 text-sm text-[var(--color-text-muted)]">
          Emergencia cerrada sin despacho de técnicos.
        </div>
      )}
    </div>
  )
}

function TarjetaOrden({ ordenId }: { ordenId: string }) {
  const orden = useQuery({
    queryKey: ['ordenes', ordenId],
    queryFn: () => endpoints.ordenes.obtener(ordenId),
    refetchInterval: 30_000,
    retry: 1,
  })
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50/50 p-4">
      <FileText size={16} className="flex-shrink-0 text-green-700" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold text-[var(--color-text)]">
          Orden de trabajo de emergencia{' '}
          {orden.data && (
            <span className="font-mono-brand text-[var(--color-accent)]">{orden.data.codigo}</span>
          )}
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {orden.isLoading && 'Cargando orden…'}
          {orden.isError && 'No se pudo cargar el detalle de la orden.'}
          {orden.data &&
            `${orden.data.tecnico?.nombre ?? 'Sin técnico'} · ${orden.data.ascensor.codigo} · prioridad ${orden.data.prioridad}`}
        </div>
      </div>
      {orden.data && (
        <span className={`rounded px-2 py-0.5 font-mono text-xs font-medium ${SEMAFORO_BADGE_CLASS[orden.data.semaforo]}`}>
          {SEMAFORO_LABEL[orden.data.semaforo]}
        </span>
      )}
      <Link
        to={`/operador/calendario?orden=${ordenId}`}
        className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
      >
        Ver en calendario <ChevronRight size={12} />
      </Link>
    </div>
  )
}
