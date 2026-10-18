import { Navigation, Phone } from 'lucide-react'
import type { CandidatoTecnico } from '../../api/types'
import { formatoDistancia, formatoEta } from '../../domain/cercania'
import { Avatar } from './Avatar'

/**
 * Ranking de técnicos más cercanos (estructura del bloque "3 Técnicos más
 * cercanos" del mockup). El orden lo define el backend (disponibilidad,
 * especialidad, distancia); aquí solo se presenta.
 */
export function ListaCercanos({
  candidatos,
  mostrarEspecialidad = false,
  resaltadoId,
  onResaltar,
}: {
  candidatos: CandidatoTecnico[]
  mostrarEspecialidad?: boolean
  resaltadoId?: string | null
  onResaltar?: (tecnicoId: string | null) => void
}) {
  const masCercanoId = candidatos
    .filter((c) => c.distancia_m !== null)
    .reduce<CandidatoTecnico | null>(
      (min, c) => (min === null || c.distancia_m! < min.distancia_m! ? c : min),
      null,
    )?.tecnico.id

  return (
    <div className="space-y-2">
      {candidatos.map((c, idx) => {
        const resaltado = resaltadoId === c.tecnico.id
        return (
          <div
            key={c.tecnico.id}
            onMouseEnter={() => onResaltar?.(c.tecnico.id)}
            onMouseLeave={() => onResaltar?.(null)}
            className={`flex items-center gap-3 rounded border p-2.5 transition-colors ${
              resaltado
                ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5'
                : idx === 0
                  ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
                  : 'border-[var(--color-bg-subtle)]'
            }`}
          >
            <div className="relative">
              <Avatar nombre={c.tecnico.nombre} tamano="sm" />
              <span
                className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  c.disponible ? 'bg-green-500' : 'bg-[var(--color-accent)]'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="truncate text-sm font-medium text-[var(--color-text)]">
                  {c.tecnico.nombre}
                </span>
                {idx === 0 && (
                  <span className="rounded bg-[var(--color-navy)] px-1.5 py-0.5 font-mono text-[9px] text-white" title="Primero del ranking: disponibilidad, especialidad y distancia">
                    SUGERIDO
                  </span>
                )}
                {c.tecnico.id === masCercanoId && (
                  <span className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 font-mono text-[9px] text-white">
                    MÁS CERCANO
                  </span>
                )}
                {mostrarEspecialidad && c.especialidad_match && (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-[9px] text-green-700">
                    ESPECIALISTA
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 font-mono-brand text-[11px] whitespace-nowrap text-[var(--color-text-muted)]">
                <Navigation size={9} />
                {c.distancia_m === null ? (
                  <span>Sin ubicación</span>
                ) : (
                  <span>
                    {formatoDistancia(c.distancia_m)} · {formatoEta(c.eta_min)}
                  </span>
                )}
                {!c.disponible && <span className="text-amber-700">· en terreno</span>}
              </div>
            </div>
            {c.tecnico.telefono && (
              <a
                href={`tel:${c.tecnico.telefono.replace(/\s/g, '')}`}
                title={`Llamar a ${c.tecnico.nombre}`}
                className="flex-shrink-0 rounded border border-[var(--color-border)] p-1.5 text-slate-700 hover:bg-[var(--color-bg-subtle)]"
              >
                <Phone size={12} />
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
