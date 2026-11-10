import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

/**
 * Pantalla completa para un contenedor de mapa. Usa la Fullscreen API y, donde
 * no existe (p. ej. Safari en iPhone), cae a una capa `fixed` que cubre la ventana.
 * Esc cierra en ambos modos.
 */
export function usePantallaCompleta() {
  const ref = useRef<HTMLDivElement>(null)
  const [api, setApi] = useState(false)
  const [css, setCss] = useState(false)
  const activa = api || css

  useEffect(() => {
    const alCambiar = () => setApi(!!ref.current && document.fullscreenElement === ref.current)
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCss(false)
    }
    document.addEventListener('fullscreenchange', alCambiar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('fullscreenchange', alCambiar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [])

  // Leaflet solo recalcula su tamaño con un evento resize (el modo CSS no lo dispara).
  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    return () => window.clearTimeout(t)
  }, [activa])

  const alternar = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    if (css) {
      setCss(false)
      return
    }
    const el = ref.current
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => setCss(true))
    else setCss(true)
  }, [css])

  return { ref, activa, alternar, claseCss: css ? 'fixed! inset-0! z-[3000] rounded-none! border-0! h-auto!' : '' }
}

export function BotonPantallaCompleta({
  activa,
  onClick,
  className = '',
}: {
  activa: boolean
  onClick: () => void
  className?: string
}) {
  const etiqueta = activa ? 'Salir de pantalla completa' : 'Mapa en pantalla completa'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className={`flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-navy)] shadow-md hover:bg-[var(--color-bg-subtle)] ${className}`}
    >
      {activa ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
    </button>
  )
}
