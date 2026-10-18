import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'

/** Estado de conexión del navegador (RNF-02: avisar en vez de fallar en silencio). */
export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const on = () => setEnLinea(true)
    const off = () => setEnLinea(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return enLinea
}

/** Reloj que se actualiza cada `intervaloMs` (cuentas regresivas, "hace X min"). */
export function useAhora(intervaloMs = 1000): Date {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setAhora(new Date()), intervaloMs)
    return () => window.clearInterval(t)
  }, [intervaloMs])
  return ahora
}

/** Mensaje legible para el técnico a partir de un error de red/API. */
export function mensajeError(error: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return 'Sin conexión. Revisa tu señal e intenta de nuevo.'
  if (error instanceof ApiError) {
    if (error.status === 404) return 'No encontrado.'
    if (error.status === 409) return error.message || 'La acción ya no es válida.'
    if (error.status >= 500) return 'El servidor tuvo un problema. Intenta en un momento.'
    return error.message
  }
  if (error instanceof TypeError) return 'No se pudo conectar con el servidor.'
  return 'Ocurrió un error inesperado.'
}
