import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'
import { mensajeError, useEnLinea } from '../lib/red'

/** Esqueleto de tarjetas mientras carga (mejor percepción en conexiones lentas). */
export function Cargando({ filas = 3, texto }: { filas?: number; texto?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {texto && <p className="text-xs text-[var(--color-text-muted)]">{texto}</p>}
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-[var(--color-border)] bg-white p-4"
        >
          <div className="mb-2 h-3 w-24 rounded bg-[var(--color-bg)]" />
          <div className="mb-1.5 h-4 w-3/4 rounded bg-[var(--color-bg)]" />
          <div className="h-3 w-1/2 rounded bg-[var(--color-bg)]" />
        </div>
      ))}
    </div>
  )
}

export function Vacio({
  icono,
  titulo,
  texto,
  children,
}: {
  icono?: ReactNode
  titulo: string
  texto?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-[var(--color-border)] bg-white px-6 py-10 text-center">
      {icono && <div className="mb-3 text-slate-300">{icono}</div>}
      <p className="font-semibold text-[var(--color-text)]">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-sm text-[var(--color-text-muted)]">{texto}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function ErrorCarga({
  error,
  onReintentar,
  titulo = 'No se pudo cargar',
}: {
  error: unknown
  onReintentar?: () => void
  titulo?: string
}) {
  const enLinea = useEnLinea()
  return (
    <div className="flex flex-col items-center rounded-lg border border-[var(--color-border)] bg-white px-6 py-8 text-center">
      <div className="mb-3 text-slate-400">
        {enLinea ? <AlertTriangle size={28} /> : <WifiOff size={28} />}
      </div>
      <p className="font-semibold text-[var(--color-text)]">{enLinea ? titulo : 'Sin conexión'}</p>
      <p className="mt-1 max-w-xs text-sm text-[var(--color-text-muted)]">
        {mensajeError(error)}
      </p>
      {onReintentar && (
        <button
          onClick={onReintentar}
          className="mt-4 flex items-center gap-1.5 rounded border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] active:bg-[var(--color-bg)]"
        >
          <RefreshCw size={14} /> Reintentar
        </button>
      )}
    </div>
  )
}
