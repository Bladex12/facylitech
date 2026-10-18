import type { ReactNode } from 'react'
import { SEMAFORO_DOT_CLASS, SEMAFORO_LABEL } from '../../../domain/semaforo'
import type { Semaforo } from '../../../api/types'

/** Navegador ‹ periodo › con botón Hoy (forma del CalendarView del mockup). */
export function NavegadorPeriodo({
  etiqueta,
  onAnterior,
  onSiguiente,
  onHoy,
  ancho = 'min-w-[150px]',
}: {
  etiqueta: string
  onAnterior: () => void
  onSiguiente: () => void
  onHoy: () => void
  ancho?: string
}) {
  const boton =
    'flex h-8 w-8 items-center justify-center rounded border border-[var(--color-border)] bg-white text-gray-700 hover:bg-[var(--color-bg-subtle)]'
  return (
    <div className="flex items-center gap-2">
      <button onClick={onAnterior} className={boton} aria-label="Anterior">
        ‹
      </button>
      <span className={`${ancho} text-center font-semibold text-[var(--color-text)] capitalize`}>{etiqueta}</span>
      <button onClick={onSiguiente} className={boton} aria-label="Siguiente">
        ›
      </button>
      <button
        onClick={onHoy}
        className="h-8 rounded border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-[var(--color-bg-subtle)]"
      >
        Hoy
      </button>
    </div>
  )
}

export function LeyendaSemaforo({ extra }: { extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
      {(Object.keys(SEMAFORO_LABEL) as Semaforo[]).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${SEMAFORO_DOT_CLASS[s]}`} />
          {SEMAFORO_LABEL[s]}
        </span>
      ))}
      {extra}
    </div>
  )
}

export function SelectFiltro({
  label,
  valor,
  onCambio,
  opciones,
  todos,
}: {
  label: string
  valor: string
  onCambio: (v: string) => void
  opciones: { valor: string; label: string }[]
  todos: string
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
      <span className="font-mono-brand tracking-widest uppercase">{label}</span>
      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className={`rounded border bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-navy)] ${
          valor ? 'border-[var(--color-navy)] text-[var(--color-text)]' : 'border-[var(--color-border)] text-gray-700'
        }`}
      >
        <option value="">{todos}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
