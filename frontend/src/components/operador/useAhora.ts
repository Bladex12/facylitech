import { useEffect, useState } from 'react'

/** Reloj que se re-renderiza cada `intervaloMs` (cuentas regresivas, "hace X min"). */
export function useAhora(intervaloMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), intervaloMs)
    return () => window.clearInterval(id)
  }, [intervaloMs])
  return ahora
}
