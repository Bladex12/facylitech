import { useEffect, useState } from 'react'
import type { Coordenadas } from '../../api/types'

export type EstadoPosicion = 'buscando' | 'ok' | 'denegado' | 'no_disponible' | 'error'

/**
 * Posición del técnico SOLO mientras la vista está abierta (foreground). No se
 * envía al servidor: el reporte es por eventos (Iniciar/Completar).
 */
export function useMiPosicion() {
  const disponible = typeof navigator !== 'undefined' && !!navigator.geolocation
  const [posicion, setPosicion] = useState<(Coordenadas & { precision: number }) | null>(null)
  const [estado, setEstado] = useState<EstadoPosicion>(disponible ? 'buscando' : 'no_disponible')

  useEffect(() => {
    if (!disponible) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosicion({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precision: pos.coords.accuracy,
        })
        setEstado('ok')
      },
      (err) => setEstado(err.code === err.PERMISSION_DENIED ? 'denegado' : 'error'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [disponible])

  return { posicion, estado }
}
