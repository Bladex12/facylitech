import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'

/** Estados de carga / error / vacío con la estética del mockup (tarjeta blanca, borde tenue). */

export function Cargando({ texto = 'Cargando…', className = '' }: { texto?: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 p-6 text-sm text-[var(--color-text-muted)] ${className}`}
      role="status"
    >
      <Loader2 size={14} className="animate-spin" /> {texto}
    </div>
  )
}

export function ErrorConsulta({
  error,
  onReintentar,
  titulo = 'No se pudo cargar la información',
  className = '',
}: {
  error: unknown
  onReintentar?: () => void
  titulo?: string
  className?: string
}) {
  const mensaje = error instanceof Error ? error.message : 'Error desconocido'
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm ${className}`}
      role="alert"
    >
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-red-800">{titulo}</div>
        <div className="truncate font-mono-brand text-xs text-red-700">{mensaje}</div>
      </div>
      {onReintentar && (
        <button
          onClick={onReintentar}
          className="flex flex-shrink-0 items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          <RotateCw size={11} /> Reintentar
        </button>
      )}
    </div>
  )
}

export function Vacio({
  icono,
  titulo,
  detalle,
  children,
  className = '',
}: {
  icono?: ReactNode
  titulo: string
  detalle?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-border)] bg-white p-8 text-center ${className}`}
    >
      {icono && <div className="mb-1 text-slate-300">{icono}</div>}
      <div className="text-sm font-semibold text-[var(--color-text)]">{titulo}</div>
      {detalle && <div className="max-w-xs text-xs text-[var(--color-text-muted)]">{detalle}</div>}
      {children}
    </div>
  )
}
