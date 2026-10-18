import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  ShieldCheck,
  User,
  X,
  Zap,
} from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import type { AsignacionTecnico } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Cargando, ErrorCarga, Vacio } from '../../components/EstadosCarga'
import { linksNavegacion } from '../../components/mapa/mapaUtils'
import {
  formatoCuentaRegresiva,
  formatoDistancia,
  formatoHora,
  haceCuanto,
  segundosRestantes,
} from '../../domain/tiempo'
import { mensajeError, useAhora } from '../../lib/red'
import { ESPECIALIDAD_COLOR, ESPECIALIDAD_LABEL, ESTADO_ASIGNACION_CFG } from './etiquetas'
import { useAsignacionesPendientes, useMisOrdenes } from './hooks'

const MOTIVOS_RAPIDOS = [
  'Estoy atendiendo otra emergencia',
  'Estoy muy lejos',
  'No tengo las herramientas/repuestos',
  'Fuera de mi turno',
]

function HojaRechazo({
  asignacion,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  asignacion: AsignacionTecnico
  enviando: boolean
  onCancelar: () => void
  onConfirmar: (motivo: string | undefined) => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col justify-end bg-black/40" onClick={onCancelar}>
      <div
        className="rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-border)]" />
        <h3 className="text-lg font-bold text-[var(--color-text)]">Rechazar emergencia</h3>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          {asignacion.emergencia.codigo} · {asignacion.emergencia.edificio.nombre}. El operador la
          pasará al siguiente técnico. Motivo (opcional):
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button
              key={m}
              onClick={() => setMotivo(motivo === m ? '' : m)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                motivo === m
                  ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                  : 'border-[var(--color-border)] text-[var(--color-text)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Otro motivo…"
          className="mb-4 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancelar}
            className="rounded border border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-text)]"
          >
            Volver
          </button>
          <button
            onClick={() => onConfirmar(motivo.trim() || undefined)}
            disabled={enviando}
            className="rounded bg-[var(--color-navy)] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Confirmar rechazo'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TarjetaPendiente({
  a,
  ahora,
  ocupado,
  error,
  onAceptar,
  onRechazar,
}: {
  a: AsignacionTecnico
  ahora: Date
  ocupado: boolean
  error: string | null
  onAceptar: () => void
  onRechazar: () => void
}) {
  const em = a.emergencia
  const restantes = segundosRestantes(a.expira_at, ahora)
  const total =
    a.expira_at && a.notificada_at
      ? (new Date(a.expira_at).getTime() - new Date(a.notificada_at).getTime()) / 1000
      : null
  const pct = restantes != null && total ? Math.max(0, Math.min(100, (restantes / total) * 100)) : 100
  const expirada = restantes === 0
  const urgente = restantes != null && restantes <= 60
  const links = linksNavegacion(em.ubicacion)

  return (
    <article className="overflow-hidden rounded-xl border-2 border-red-500 bg-white shadow-lg shadow-red-600/10">
      <div className="flex items-center gap-3 bg-red-600 px-4 py-3 text-white">
        <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-white/15">
          {!expirada && <span className="absolute inset-0 animate-ping rounded bg-white/25" />}
          <Zap size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono-brand text-[10px] tracking-widest uppercase opacity-80">
            Asignada · {em.codigo}
          </div>
          <div className="truncate text-lg leading-tight font-bold">{ESPECIALIDAD_LABEL[em.tipo]}</div>
        </div>
        {restantes != null && (
          <div className="text-right">
            <div className={`font-mono-brand text-2xl leading-none font-bold ${urgente && !expirada ? 'animate-pulse' : ''}`}>
              {formatoCuentaRegresiva(restantes)}
            </div>
            <div className="text-[10px] opacity-80">{expirada ? 'expirada' : 'para responder'}</div>
          </div>
        )}
      </div>
      {total && (
        <div className="h-1 bg-red-100">
          <div className="h-full bg-red-600 transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-2.5">
          <Building2 size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-text-muted)]" />
          <div className="min-w-0">
            <div className="font-semibold text-[var(--color-text)]">{em.edificio.nombre}</div>
            <div className="text-sm text-[var(--color-text-muted)]">{em.edificio.direccion}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded bg-[var(--color-bg-subtle)] px-2 py-2">
            <div className="font-mono-brand text-sm font-semibold text-[var(--color-text)]">
              {formatoDistancia(a.distancia_m)}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase">Distancia</div>
          </div>
          <div className="rounded bg-[var(--color-bg-subtle)] px-2 py-2">
            <div className="font-mono-brand text-sm font-semibold text-[var(--color-text)]">
              {em.ascensor?.codigo ?? '—'}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase">Equipo</div>
          </div>
          <div className="rounded bg-[var(--color-bg-subtle)] px-2 py-2">
            <div className="font-mono-brand text-sm font-semibold text-[var(--color-text)]">
              {formatoHora(em.reportada_at)}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase">
              {haceCuanto(em.reportada_at, ahora)}
            </div>
          </div>
        </div>
        {em.descripcion && (
          <p className="rounded border-l-4 border-red-300 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-900">
            {em.descripcion}
          </p>
        )}
        {em.solicitante && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <User size={12} /> Reporta: {em.solicitante}
          </p>
        )}
        <a
          href={links.googleMaps}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)]"
        >
          <MapPin size={12} /> Ver ubicación en el mapa
        </a>

        {error && (
          <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-[1fr_1.6fr] gap-2 pt-1">
          <button
            onClick={onRechazar}
            disabled={ocupado || expirada}
            className="flex items-center justify-center gap-1.5 rounded border-2 border-[var(--color-border)] py-3.5 text-sm font-semibold text-[var(--color-text)] active:bg-[var(--color-bg)] disabled:opacity-40"
          >
            <X size={16} /> Rechazar
          </button>
          <button
            onClick={onAceptar}
            disabled={ocupado || expirada}
            className="flex items-center justify-center gap-1.5 rounded bg-green-600 py-3.5 text-base font-bold text-white shadow-md shadow-green-600/25 active:bg-green-700 disabled:opacity-40"
          >
            <Check size={18} /> {ocupado ? 'Aceptando…' : 'Aceptar'}
          </button>
        </div>
      </div>
    </article>
  )
}

export function Emergencias() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const ahora = useAhora(1000)
  const pendientes = useAsignacionesPendientes()
  const misOrdenes = useMisOrdenes()
  const [rechazando, setRechazando] = useState<AsignacionTecnico | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [aceptada, setAceptada] = useState<AsignacionTecnico | null>(null)

  const historial = useQuery({
    queryKey: ['asignaciones', usuario?.id, 'todas'],
    queryFn: () => endpoints.asignaciones.listar(usuario!.id, 'todas'),
    enabled: !!usuario,
    refetchInterval: 60_000,
  })

  const respondidas = useMemo(
    () =>
      (historial.data ?? [])
        .filter((a) => a.estado !== 'pendiente' && a.estado !== 'en_espera')
        .sort((a, b) =>
          (b.respondida_at ?? b.notificada_at ?? '').localeCompare(a.respondida_at ?? a.notificada_at ?? ''),
        )
        .slice(0, 20),
    [historial.data],
  )

  const otPorEmergencia = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of misOrdenes.data?.items ?? []) if (o.emergencia_id) m.set(o.emergencia_id, o.id)
    return m
  }, [misOrdenes.data])

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['asignaciones'] })
    queryClient.invalidateQueries({ queryKey: ['ordenes'] })
  }

  const aceptar = useMutation({
    mutationFn: (a: AsignacionTecnico) => endpoints.asignaciones.aceptar(a.id),
    onSuccess: async (_res, a) => {
      refrescar()
      // Buscar la OT de emergencia creada al aceptar y llevar al técnico directo a ella.
      try {
        const ordenes = await endpoints.ordenes.listar({
          tecnico_id: usuario!.id,
          tipo: 'emergencia',
          limit: 100,
        })
        const ot = ordenes.items.find((o) => o.emergencia_id === a.emergencia_id)
        if (ot) {
          navigate(`/tecnico/ordenes/${ot.id}`)
          return
        }
      } catch {
        // sin red: se muestra el aviso con link
      }
      setAceptada(a)
    },
    onError: (e, a) => {
      setErrores((prev) => ({
        ...prev,
        [a.id]:
          (e as { status?: number }).status === 409
            ? 'Esta emergencia ya no está disponible (expiró o la tomó otro técnico).'
            : mensajeError(e),
      }))
      refrescar()
    },
  })

  const rechazar = useMutation({
    mutationFn: ({ a, motivo }: { a: AsignacionTecnico; motivo?: string }) =>
      endpoints.asignaciones.rechazar(a.id, motivo),
    onSuccess: () => {
      setRechazando(null)
      refrescar()
    },
    onError: (e, { a }) => {
      setRechazando(null)
      setErrores((prev) => ({ ...prev, [a.id]: mensajeError(e) }))
      refrescar()
    },
  })

  const lista = pendientes.data ?? []

  return (
    <div className="space-y-5 p-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Emergencias</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Asignaciones del operador — se actualiza cada 10 s
        </p>
      </div>

      {aceptada && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-green-800">
            <Check size={16} /> Emergencia aceptada
          </p>
          <p className="mt-1 text-sm text-green-800">
            {aceptada.emergencia.codigo} · {aceptada.emergencia.edificio.nombre}. La orden de trabajo
            aparecerá en tu agenda en unos segundos.
          </p>
          <div className="mt-3 flex gap-2">
            {otPorEmergencia.get(aceptada.emergencia_id) ? (
              <Link
                to={`/tecnico/ordenes/${otPorEmergencia.get(aceptada.emergencia_id)}`}
                className="rounded bg-green-700 px-3 py-2 text-xs font-semibold text-white"
              >
                Abrir orden de trabajo
              </Link>
            ) : (
              <Link to="/tecnico/agenda" className="rounded bg-green-700 px-3 py-2 text-xs font-semibold text-white">
                Ir a mi agenda
              </Link>
            )}
            <a
              href={linksNavegacion(aceptada.emergencia.ubicacion).googleMaps}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded border border-green-300 px-3 py-2 text-xs font-semibold text-green-800"
            >
              <Navigation size={12} /> Cómo llegar
            </a>
          </div>
        </div>
      )}

      {pendientes.isLoading && <Cargando filas={1} />}
      {pendientes.isError && !pendientes.data && (
        <ErrorCarga error={pendientes.error} onReintentar={() => pendientes.refetch()} />
      )}

      {pendientes.data && lista.length === 0 && !aceptada && (
        <Vacio
          icono={<ShieldCheck size={34} />}
          titulo="Sin emergencias pendientes"
          texto="Cuando el operador te asigne una emergencia aparecerá aquí con una alerta en la barra inferior."
        />
      )}

      {lista.map((a) => (
        <TarjetaPendiente
          key={a.id}
          a={a}
          ahora={ahora}
          ocupado={
            (aceptar.isPending && aceptar.variables?.id === a.id) ||
            (rechazar.isPending && rechazar.variables?.a.id === a.id)
          }
          error={errores[a.id] ?? null}
          onAceptar={() => aceptar.mutate(a)}
          onRechazar={() => setRechazando(a)}
        />
      ))}

      <section>
        <h2 className="mb-2 text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
          Historial de asignaciones
        </h2>
        {historial.isLoading && <Cargando filas={2} />}
        {historial.isError && !historial.data && (
          <ErrorCarga error={historial.error} onReintentar={() => historial.refetch()} />
        )}
        {historial.data && respondidas.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-white p-4 text-center text-sm text-[var(--color-text-muted)]">
            Aún no has respondido emergencias.
          </p>
        )}
        {respondidas.length > 0 && (
          <div className="divide-y divide-[var(--color-bg-subtle)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
            {respondidas.map((a) => {
              const otId = a.estado === 'aceptada' ? otPorEmergencia.get(a.emergencia_id) : undefined
              const cfg = ESTADO_ASIGNACION_CFG[a.estado]
              const contenido = (
                <>
                  <div
                    className={`${ESPECIALIDAD_COLOR[a.emergencia.tipo]} flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-white`}
                  >
                    <Zap size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--color-text)]">
                        {ESPECIALIDAD_LABEL[a.emergencia.tipo]}
                      </span>
                      <span className={`flex-shrink-0 rounded px-1.5 py-0.5 font-mono-brand text-[9px] ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="truncate text-xs text-[var(--color-text-muted)]">
                      {a.emergencia.codigo} · {a.emergencia.edificio.nombre}
                    </div>
                    {a.motivo_rechazo && (
                      <div className="truncate text-xs text-[var(--color-text-muted)] italic">
                        “{a.motivo_rechazo}”
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 font-mono-brand text-[10px] text-[var(--color-text-muted)]">
                    <Clock size={10} />
                    {new Date(a.respondida_at ?? a.notificada_at ?? a.emergencia.reportada_at).toLocaleDateString('es-CL', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {otId && <ChevronRight size={14} />}
                  </div>
                </>
              )
              return otId ? (
                <Link key={a.id} to={`/tecnico/ordenes/${otId}`} className="flex items-center gap-3 px-4 py-3 active:bg-[var(--color-bg)]">
                  {contenido}
                </Link>
              ) : (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  {contenido}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {rechazando && (
        <HojaRechazo
          asignacion={rechazando}
          enviando={rechazar.isPending}
          onCancelar={() => setRechazando(null)}
          onConfirmar={(motivo) => rechazar.mutate({ a: rechazando, motivo })}
        />
      )}
    </div>
  )
}
