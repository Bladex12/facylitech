import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, RotateCw, X } from 'lucide-react'
import { mensajeError } from './errores'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../../domain/semaforo'
import type { Semaforo } from '../../../api/types'

export const CLASE_INPUT =
  'w-full rounded border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-navy)] disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-muted)]'

export const CLASE_BOTON_PRIMARIO =
  'flex items-center justify-center gap-1.5 rounded bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50'

export const CLASE_BOTON_SECUNDARIO =
  'flex items-center justify-center gap-1.5 rounded border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50'

export const CLASE_TARJETA = 'rounded-lg border border-[var(--color-border)] bg-white'

export const CLASE_TITULO_TARJETA =
  'text-sm font-semibold tracking-wider text-[var(--color-text)] uppercase'

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-text-muted)]">
      <Loader2 size={16} className="animate-spin" /> {texto}
    </div>
  )
}

export function Vacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string
  detalle?: string
  accion?: ReactNode
}) {
  return (
    <div className={`${CLASE_TARJETA} flex flex-col items-center gap-2 p-10 text-center`}>
      <Inbox size={22} className="text-slate-300" />
      <div className="font-semibold text-[var(--color-text)]">{titulo}</div>
      {detalle && <p className="max-w-sm text-sm text-[var(--color-text-muted)]">{detalle}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  )
}

export function ErrorVista({ error, onReintentar }: { error: unknown; onReintentar?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertTriangle size={16} className="flex-shrink-0" />
      <div className="flex-1">
        <div className="font-semibold">No se pudieron cargar los datos</div>
        <div className="text-xs text-red-700">{mensajeError(error)}</div>
      </div>
      {onReintentar && (
        <button
          onClick={onReintentar}
          className="flex items-center gap-1 rounded border border-red-300 px-2.5 py-1 text-xs hover:bg-red-100"
        >
          <RotateCw size={12} /> Reintentar
        </button>
      )}
    </div>
  )
}

export function AvisoError({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {texto}
    </div>
  )
}

/** Badge del semáforo con la forma del StatusBadge del mockup. */
export function BadgeSemaforo({ semaforo, cancelado }: { semaforo: Semaforo; cancelado?: boolean }) {
  if (cancelado) {
    return (
      <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-mono-brand text-xs font-medium text-slate-500">
        Cancelado
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono-brand text-xs font-medium ${SEMAFORO_BADGE_CLASS[semaforo]}`}
    >
      {SEMAFORO_LABEL[semaforo]}
    </span>
  )
}

function useEscape(onCerrar: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCerrar])
}

/** Panel lateral derecho (detalle/edición de OT). */
export function Drawer({
  titulo,
  subtitulo,
  onCerrar,
  children,
  ancho = 'w-[440px]',
}: {
  titulo: ReactNode
  subtitulo?: ReactNode
  onCerrar: () => void
  children: ReactNode
  ancho?: string
}) {
  useEscape(onCerrar)
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-[var(--color-navy)]/30" onClick={onCerrar} />
      <aside
        role="dialog"
        className={`relative flex h-full max-w-full ${ancho} flex-col bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <div className="text-base font-bold text-[var(--color-text)]">{titulo}</div>
            {subtitulo && <div className="text-xs text-[var(--color-text-muted)]">{subtitulo}</div>}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  )
}

export function Modal({
  titulo,
  subtitulo,
  onCerrar,
  children,
  pie,
}: {
  titulo: string
  subtitulo?: string
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
}) {
  useEscape(onCerrar)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--color-navy)]/40" onClick={onCerrar} />
      <div
        role="dialog"
        aria-label={titulo}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text)]">{titulo}</h3>
            {subtitulo && <p className="text-xs text-[var(--color-text-muted)]">{subtitulo}</p>}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {pie && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-6 py-3">
            {pie}
          </div>
        )}
      </div>
    </div>
  )
}

export function Campo({
  label,
  error,
  ayuda,
  children,
  className = '',
  grupo,
}: {
  label: string
  error?: string | null
  ayuda?: ReactNode
  children: ReactNode
  className?: string
  /** Para grupos de botones: un <label> nombraría solo al primer botón. */
  grupo?: boolean
}) {
  const Contenedor = grupo ? 'div' : 'label'
  return (
    <Contenedor
      className={`block ${className}`}
      {...(grupo ? { role: 'group', 'aria-label': label } : {})}
    >
      <span className="mb-1 block font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : (
        ayuda && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{ayuda}</span>
      )}
    </Contenedor>
  )
}

/** Chips de filtro con la forma del mockup (ScheduleView). */
export function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono-brand text-xs transition-all ${
        activo
          ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
          : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  )
}
