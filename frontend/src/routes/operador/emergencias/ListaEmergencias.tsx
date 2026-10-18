import { Clock, UserCheck, Users } from 'lucide-react'
import type { Emergencia } from '../../../api/types'
import {
  EMERGENCIA_COLOR_CLASS,
  EMERGENCIA_LABEL,
  ESTADO_EMERGENCIA,
  resumirCascada,
} from '../../../domain/emergencias'
import { formatoHora, tiempoTranscurrido } from '../../../domain/tiempoRelativo'

/** Tarjetas de emergencia (estructura del EmergencyView del mockup). */
export function ListaEmergencias({
  emergencias,
  seleccionadaId,
  ahora,
  onSeleccionar,
}: {
  emergencias: Emergencia[]
  seleccionadaId: string | null
  ahora: Date
  onSeleccionar: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      {emergencias.map((em) => {
        const seleccionada = em.id === seleccionadaId
        const estado = ESTADO_EMERGENCIA[em.estado]
        return (
          <button
            key={em.id}
            onClick={() => onSeleccionar(em.id)}
            className={`w-full rounded-lg border bg-white p-4 text-left transition-all ${
              seleccionada
                ? em.estado === 'cerrada'
                  ? 'border-slate-400 shadow-sm'
                  : 'border-red-400 shadow-sm'
                : 'border-[var(--color-border)] hover:border-red-200'
            } ${em.estado === 'cerrada' ? 'opacity-75' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`${EMERGENCIA_COLOR_CLASS[em.tipo]} mt-0.5 h-9 w-1.5 flex-shrink-0 rounded-full`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-xs ${estado.cls} ${em.estado === 'activa' ? 'animate-pulse' : ''}`}
                  >
                    {estado.label}
                  </span>
                  <span className="font-mono-brand text-[11px] text-[var(--color-text-muted)]">
                    {em.codigo}
                  </span>
                </div>
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  {EMERGENCIA_LABEL[em.tipo]}
                </div>
                <div className="truncate text-xs text-[var(--color-text-muted)]">
                  {em.edificio.nombre}
                  {em.ascensor ? ` · ${em.ascensor.codigo}` : ''}
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 font-mono text-xs text-[var(--color-text-muted)]">
                    <Clock size={10} /> {formatoHora(em.reportada_at)} ·{' '}
                    <span className={em.estado === 'activa' ? 'font-semibold text-red-600' : ''}>
                      {tiempoTranscurrido(em.reportada_at, ahora)}
                    </span>
                  </span>
                  <EstadoCascadaCorto emergencia={em} />
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function EstadoCascadaCorto({ emergencia }: { emergencia: Emergencia }) {
  const r = resumirCascada(emergencia)
  const total = r.asignaciones.length
  if (r.fase === 'aceptada' && r.actual) {
    return (
      <span className="flex items-center gap-1 truncate text-[11px] text-green-700">
        <UserCheck size={11} /> {r.actual.tecnico.nombre}
      </span>
    )
  }
  if (emergencia.estado === 'cerrada') return null
  if (r.fase === 'sin_despacho') {
    return <span className="text-[11px] font-medium text-red-600">Sin despachar</span>
  }
  if (r.fase === 'agotada') {
    return <span className="text-[11px] font-medium text-red-600">Cascada agotada</span>
  }
  return (
    <span className="flex items-center gap-1 truncate text-[11px] text-amber-700">
      <Users size={11} />
      {r.actual
        ? `${r.actual.tecnico.nombre.split(' ')[0]} (${r.asignaciones.indexOf(r.actual) + 1}/${total})`
        : 'En cascada'}
    </span>
  )
}
