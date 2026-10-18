import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

const FOCUSABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Diálogo accesible: hoja inferior en celular y modal centrado en escritorio.
 * Cierra con Escape y clic fuera, atrapa el foco y lo devuelve al cerrar.
 */
export function HojaModal({
  titulo,
  subtitulo,
  onCerrar,
  children,
  bloqueado,
}: {
  titulo: string
  subtitulo?: string
  onCerrar: () => void
  children: ReactNode
  /** Mientras hay una operación en curso no se puede cerrar. */
  bloqueado?: boolean
}) {
  const idTitulo = useId()
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    const nodo = caja.current
    // Foco inicial: primer campo del formulario si lo hay; si no, el diálogo mismo.
    const primero = nodo?.querySelector<HTMLElement>('input, textarea, select')
    ;(primero ?? nodo)?.focus()
    return () => previo?.focus?.()
  }, [])

  function alTeclear(e: KeyboardEvent) {
    if (e.key === 'Escape' && !bloqueado) {
      e.stopPropagation()
      onCerrar()
      return
    }
    if (e.key !== 'Tab' || !caja.current) return
    const lista = Array.from(caja.current.querySelectorAll<HTMLElement>(FOCUSABLES))
    if (lista.length === 0) return
    const primero = lista[0]
    const ultimo = lista[lista.length - 1]
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[var(--color-navy)]/50"
        onClick={() => !bloqueado && onCerrar()}
        aria-hidden="true"
      />
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={alTeclear}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none sm:max-w-md sm:rounded-lg sm:pb-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-lg leading-tight font-bold text-[var(--color-text)]">
              {titulo}
            </h2>
            {subtitulo && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitulo}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={bloqueado}
            aria-label="Cerrar"
            className="-mt-1 -mr-2 rounded p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
