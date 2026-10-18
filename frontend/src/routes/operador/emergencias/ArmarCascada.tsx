import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ListOrdered,
  Navigation,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type { CandidatoTecnico, Emergencia } from '../../../api/types'
import { useAuth } from '../../../auth/useAuth'
import { Avatar } from '../../../components/operador/Avatar'
import { Cargando, ErrorConsulta, Vacio } from '../../../components/operador/EstadoConsulta'
import { formatoDistancia, formatoEta } from '../../../domain/cercania'
import {
  alternarEnCascada,
  EMERGENCIA_LABEL,
  moverEnCascada,
  sugerirCascada,
} from '../../../domain/emergencias'

/**
 * Despacho en cascada: el sistema propone un ranking (cercanía PostGIS +
 * disponibilidad + especialidad) y el OPERADOR elige el orden y aprueba
 * explícitamente. Regla del cliente: nunca asignación 100 % automática.
 */
export function ArmarCascada({
  emergencia,
  esRedespacho,
  onDespachada,
  onCancelar,
}: {
  emergencia: Emergencia
  esRedespacho: boolean
  onDespachada: (e: Emergencia) => void
  onCancelar?: () => void
}) {
  const candidatos = useQuery({
    queryKey: ['emergencias', emergencia.id, 'candidatos', 'despacho'],
    queryFn: () => endpoints.emergencias.candidatos(emergencia.id, 6),
    retry: 1,
  })

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-wider text-[var(--color-text)] uppercase">
            <ListOrdered size={14} className="text-[var(--color-accent)]" />
            {esRedespacho ? 'Re-despachar emergencia' : 'Despacho en cascada'}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Elige qué técnicos notificar y en qué orden. Se avisa al primero; si rechaza o no
            responde a tiempo, pasa automáticamente al siguiente.
          </p>
        </div>
        {onCancelar && (
          <button
            onClick={onCancelar}
            className="flex-shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Cancelar
          </button>
        )}
      </div>

      {candidatos.isLoading && <Cargando texto="Calculando técnicos más cercanos…" />}
      {candidatos.isError && (
        <ErrorConsulta
          error={candidatos.error}
          titulo="No se pudo obtener el ranking de técnicos"
          onReintentar={() => candidatos.refetch()}
        />
      )}
      {candidatos.data && candidatos.data.length === 0 && (
        <Vacio
          titulo="No hay técnicos activos para despachar"
          detalle="Revisa que los técnicos tengan sesión y ubicación reportada."
        />
      )}
      {candidatos.data && candidatos.data.length > 0 && (
        <Armado
          emergencia={emergencia}
          candidatos={candidatos.data}
          onDespachada={onDespachada}
        />
      )}
    </div>
  )
}

function Armado({
  emergencia,
  candidatos,
  onDespachada,
}: {
  emergencia: Emergencia
  candidatos: CandidatoTecnico[]
  onDespachada: (e: Emergencia) => void
}) {
  const { usuario } = useAuth()
  // Sugerencia inicial editable; el despacho solo ocurre al aprobar.
  const [cascada, setCascada] = useState<string[]>(() => sugerirCascada(candidatos))
  const porId = new Map(candidatos.map((c) => [c.tecnico.id, c]))
  const masCercano = candidatos
    .filter((c) => c.distancia_m !== null)
    .reduce<CandidatoTecnico | null>((m, c) => (!m || c.distancia_m! < m.distancia_m! ? c : m), null)

  const despachar = useMutation({
    mutationFn: () => endpoints.emergencias.despachar(emergencia.id, cascada, usuario!.id),
    onSuccess: onDespachada,
  })

  return (
    <div className="space-y-4">
      {/* Ranking */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
            Ranking sugerido · {EMERGENCIA_LABEL[emergencia.tipo]}
          </span>
          <div className="flex gap-3 text-[11px]">
            <button
              onClick={() => setCascada(sugerirCascada(candidatos))}
              className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              <Sparkles size={11} /> Usar sugerencia
            </button>
            <button
              onClick={() => setCascada([])}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Limpiar
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded border border-[var(--color-border)]">
          {candidatos.map((c, idx) => {
            const posicion = cascada.indexOf(c.tecnico.id)
            const elegido = posicion >= 0
            return (
              <button
                key={c.tecnico.id}
                onClick={() => setCascada((s) => alternarEnCascada(s, c.tecnico.id))}
                aria-pressed={elegido}
                className={`flex w-full items-center gap-3 border-b border-[var(--color-bg-subtle)] px-3 py-2.5 text-left transition-colors last:border-0 ${
                  elegido ? 'bg-[var(--color-accent)]/5' : 'hover:bg-[var(--color-bg-subtle)]'
                }`}
              >
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 font-mono text-[11px] font-bold ${
                    elegido
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                      : 'border-slate-300 text-transparent'
                  }`}
                >
                  {elegido ? posicion + 1 : <Check size={10} />}
                </span>
                <span className="w-4 font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                <Avatar nombre={c.tecnico.nombre} tamano="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-sm font-medium text-[var(--color-text)]">{c.tecnico.nombre}</span>
                    {masCercano?.tecnico.id === c.tecnico.id && (
                      <span className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 font-mono text-[9px] text-white">
                        MÁS CERCANO
                      </span>
                    )}
                    {c.especialidad_match && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-[9px] text-green-700">
                        ESPECIALISTA
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-[var(--color-text-muted)]">
                    {c.tecnico.zona ?? 'Sin zona'}
                    {c.tecnico.telefono ? ` · ${c.tecnico.telefono}` : ''}
                  </div>
                </div>
                <span
                  className={`hidden rounded px-1.5 py-0.5 font-mono text-[10px] sm:inline ${
                    c.disponible ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}
                  title={c.ordenes_en_curso > 0 ? `${c.ordenes_en_curso} orden(es) en curso` : undefined}
                >
                  {c.disponible ? 'Disponible' : `En terreno${c.ordenes_en_curso ? ` · ${c.ordenes_en_curso} OT` : ''}`}
                </span>
                <div className="w-24 flex-shrink-0 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1 font-mono-brand text-xs font-medium text-[var(--color-text)]">
                    <Navigation size={9} className="text-[var(--color-text-muted)]" />
                    {formatoDistancia(c.distancia_m)}
                  </div>
                  <div className="font-mono-brand text-[11px] text-[var(--color-text-muted)]">
                    {formatoEta(c.eta_min)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Orden elegido */}
      <div className="rounded border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
        <div className="mb-2 font-mono text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
          Orden de notificación ({cascada.length})
        </div>
        {cascada.length === 0 ? (
          <p className="py-2 text-center text-xs text-[var(--color-text-muted)]">
            Selecciona técnicos en el ranking, en el orden en que quieres notificarlos.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {cascada.map((id, i) => {
              const c = porId.get(id)
              if (!c) return null
              return (
                <li key={id} className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-white px-2.5 py-1.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] font-mono text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text)]">
                    {c.tecnico.nombre}
                    <span className="ml-2 font-mono-brand text-[11px] text-[var(--color-text-muted)]">
                      {formatoDistancia(c.distancia_m)} · {formatoEta(c.eta_min)}
                    </span>
                  </span>
                  {i === 0 && (
                    <span className="font-mono text-[9px] text-[var(--color-accent)]">SE NOTIFICA PRIMERO</span>
                  )}
                  {c.tecnico.telefono && (
                    <a
                      href={`tel:${c.tecnico.telefono.replace(/\s/g, '')}`}
                      title="Llamar"
                      className="rounded p-1 text-slate-500 hover:bg-[var(--color-bg-subtle)]"
                    >
                      <Phone size={12} />
                    </a>
                  )}
                  <button
                    onClick={() => setCascada((s) => moverEnCascada(s, i, -1))}
                    disabled={i === 0}
                    aria-label="Subir"
                    className="rounded p-1 text-slate-500 hover:bg-[var(--color-bg-subtle)] disabled:opacity-25"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => setCascada((s) => moverEnCascada(s, i, 1))}
                    disabled={i === cascada.length - 1}
                    aria-label="Bajar"
                    className="rounded p-1 text-slate-500 hover:bg-[var(--color-bg-subtle)] disabled:opacity-25"
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    onClick={() => setCascada((s) => s.filter((x) => x !== id))}
                    aria-label="Quitar"
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Aprobación explícita */}
      <div className="flex flex-col gap-2 border-t border-[var(--color-bg-subtle)] pt-4 sm:flex-row sm:items-center">
        <p className="flex flex-1 items-start gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <ShieldCheck size={13} className="mt-px flex-shrink-0 text-green-600" />
          Nada se envía hasta que apruebes. Puedes re-despachar si toda la cascada rechaza.
        </p>
        {despachar.isError && (
          <span className="text-xs text-red-600">{(despachar.error as Error).message}</span>
        )}
        <button
          onClick={() => despachar.mutate()}
          disabled={cascada.length === 0 || despachar.isPending || !usuario}
          className="flex items-center justify-center gap-1.5 rounded bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={13} />
          {despachar.isPending
            ? 'Despachando…'
            : `Aprobar y notificar${cascada.length ? ` (${cascada.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}
