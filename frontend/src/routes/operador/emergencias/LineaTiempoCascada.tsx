import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, BellRing, CheckCircle2, GitCommitVertical, MessageSquareX } from 'lucide-react'
import type { AsignacionEmergencia } from '../../../api/types'
import { useAhora } from '../../../components/operador/useAhora'
import { formatoDistancia } from '../../../domain/cercania'
import { ESTADO_ASIGNACION, type ResumenCascada } from '../../../domain/emergencias'
import {
  formatoCuentaRegresiva,
  formatoHora,
  segundosRestantes,
} from '../../../domain/tiempoRelativo'

/** Estado de la cascada como línea de tiempo, con cuenta regresiva del técnico notificado. */
export function LineaTiempoCascada({
  resumen,
  cerrada,
  accion,
  onVencida,
}: {
  resumen: ResumenCascada
  cerrada: boolean
  accion?: ReactNode
  onVencida: () => void
}) {
  const ahora = useAhora(1_000)
  const pendiente = resumen.fase === 'esperando' ? resumen.actual : null
  const restante = pendiente ? segundosRestantes(pendiente.expira_at, ahora) : null
  const vencio = restante === 0

  // Al llegar a 0 se re-lee: el backend expira y avanza la cascada al leer.
  useEffect(() => {
    if (vencio) onVencida()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vencio, pendiente?.id])

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-wider text-[var(--color-text)] uppercase">
          <GitCommitVertical size={14} className="text-[var(--color-accent)]" /> Estado de la cascada
        </h3>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
          {cerrada ? 'Emergencia cerrada' : 'Se actualiza cada 10 s'}
        </span>
      </div>

      <Banner resumen={resumen} restante={restante} cerrada={cerrada} accion={accion} />

      <ol className="relative mt-4">
        {resumen.asignaciones.map((a, i) => (
          <Paso
            key={a.id}
            asignacion={a}
            posicion={i + 1}
            ultimo={i === resumen.asignaciones.length - 1}
            ahora={ahora}
          />
        ))}
      </ol>
    </div>
  )
}

function Banner({
  resumen,
  restante,
  cerrada,
  accion,
}: {
  resumen: ResumenCascada
  restante: number | null
  cerrada: boolean
  accion?: ReactNode
}) {
  if (resumen.fase === 'aceptada' && resumen.actual) {
    return (
      <div className="flex items-center gap-3 rounded border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle2 size={18} className="flex-shrink-0 text-green-600" />
        <div className="text-sm">
          <div className="font-semibold text-green-800">{resumen.actual.tecnico.nombre} aceptó la emergencia</div>
          <div className="text-xs text-green-700">
            {resumen.actual.respondida_at && `Aceptó a las ${formatoHora(resumen.actual.respondida_at)} · `}
            {cerrada ? 'Atención finalizada.' : 'Va en camino; se creó la orden de trabajo.'}
          </div>
        </div>
      </div>
    )
  }
  if (resumen.fase === 'agotada') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded border border-red-200 bg-red-50 px-4 py-3">
        <AlertTriangle size={18} className="flex-shrink-0 text-red-600" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold text-red-800">Cascada agotada</div>
          <div className="text-xs text-red-700">
            Ningún técnico aceptó. Arma una nueva cascada o contacta por teléfono.
          </div>
        </div>
        {accion}
      </div>
    )
  }
  if (resumen.fase === 'esperando' && resumen.actual) {
    const a = resumen.actual
    const total =
      a.notificada_at && a.expira_at
        ? (new Date(a.expira_at).getTime() - new Date(a.notificada_at).getTime()) / 1000
        : null
    const pct = total && restante !== null ? Math.max(0, Math.min(100, (restante / total) * 100)) : null
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <BellRing size={18} className="flex-shrink-0 animate-pulse text-amber-600" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-amber-900">Esperando respuesta de {a.tecnico.nombre}</div>
            <div className="text-xs text-amber-800">
              Si no responde, se notificará al siguiente de la cascada.
            </div>
          </div>
          {restante !== null && (
            <div className="text-right">
              <div className="font-mono-brand text-xl font-bold text-amber-900 tabular-nums">
                {formatoCuentaRegresiva(restante)}
              </div>
              <div className="text-[10px] text-amber-700">restante</div>
            </div>
          )}
        </div>
        {pct !== null && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-amber-200">
            <div className="h-full rounded-full bg-amber-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    )
  }
  return null
}

function Paso({
  asignacion: a,
  posicion,
  ultimo,
  ahora,
}: {
  asignacion: AsignacionEmergencia
  posicion: number
  ultimo: boolean
  ahora: Date
}) {
  const cfg = ESTADO_ASIGNACION[a.estado]
  const restante = a.estado === 'pendiente' ? segundosRestantes(a.expira_at, ahora) : null
  const apagado = a.estado === 'cancelada' || a.estado === 'en_espera'
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!ultimo && <span className="absolute top-7 bottom-0 left-[13px] w-px bg-[var(--color-border)]" />}
      <span
        className={`relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-white font-mono text-[11px] font-bold shadow-sm ${
          a.estado === 'en_espera' || a.estado === 'cancelada' ? 'bg-slate-100 text-slate-500' : `${cfg.dot} text-white`
        } ${a.estado === 'pendiente' ? 'ring-4 ring-amber-100' : ''}`}
      >
        {posicion}
      </span>
      <div className={`min-w-0 flex-1 pt-0.5 ${apagado ? 'opacity-60' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text)]">{a.tecnico.nombre}</span>
          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${cfg.cls}`}>{cfg.label}</span>
          {restante !== null && (
            <span className="font-mono-brand text-xs font-semibold text-amber-700 tabular-nums">
              {formatoCuentaRegresiva(restante)}
            </span>
          )}
          <span className="ml-auto font-mono-brand text-[11px] text-[var(--color-text-muted)]">
            {formatoDistancia(a.distancia_m)}
          </span>
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-[var(--color-text-muted)]">
          {a.estado === 'en_espera' && 'En espera de su turno'}
          {a.notificada_at && `Notificado ${formatoHora(a.notificada_at)}`}
          {a.respondida_at && ` · respondió ${formatoHora(a.respondida_at)}`}
          {a.estado === 'expirada' && a.expira_at && ` · expiró ${formatoHora(a.expira_at)}`}
        </div>
        {a.estado === 'rechazada' && (
          <div className="mt-1 flex items-start gap-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-800">
            <MessageSquareX size={11} className="mt-0.5 flex-shrink-0" />
            {a.motivo_rechazo ? `«${a.motivo_rechazo}»` : 'Sin motivo indicado'}
          </div>
        )}
      </div>
    </li>
  )
}
