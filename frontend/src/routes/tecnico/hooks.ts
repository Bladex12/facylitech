import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../../api/endpoints'
import { useAuth } from '../../auth/useAuth'
import type { Coordenadas } from '../../api/types'

/** Todas las OTs del técnico (RNF-06: ~20 usuarios, 100 alcanza de sobra). Clave compartida por Agenda, Trabajos, Mapa y QR. */
export function useMisOrdenes() {
  const { usuario } = useAuth()
  return useQuery({
    queryKey: ['ordenes', 'tecnico', usuario?.id],
    queryFn: () => endpoints.ordenes.listar({ tecnico_id: usuario!.id, limit: 100 }),
    enabled: !!usuario,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** Asignaciones de emergencia pendientes: refresca cada 10 s en todas las pantallas (badge + banner). */
export function useAsignacionesPendientes() {
  const { usuario } = useAuth()
  return useQuery({
    queryKey: ['asignaciones', usuario?.id, 'pendiente'],
    queryFn: () => endpoints.asignaciones.listar(usuario!.id),
    enabled: !!usuario,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  })
}

const TIMEOUT_UBICACION_MS = 5000

/** Una lectura de GPS con timeout corto; null si no hay permiso/señal. Nunca lanza. */
export function obtenerUbicacion(timeoutMs = TIMEOUT_UBICACION_MS): Promise<Coordenadas | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    const corte = window.setTimeout(() => resolve(null), timeoutMs + 500)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(corte)
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => {
        window.clearTimeout(corte)
        resolve(null)
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}

export type ResultadoUbicacion = 'enviada' | 'sin_gps' | 'error'

/**
 * Lee el GPS una vez y lo envía al backend. Nunca lanza: devuelve qué pasó para
 * que el botón "Llegué" pueda mostrarlo. 'sin_gps' = sin permiso o sin señal.
 */
export async function reportarUbicacion(usuarioId: string): Promise<ResultadoUbicacion> {
  const coords = await obtenerUbicacion()
  if (!coords) return 'sin_gps'
  try {
    await endpoints.usuarios.reportarUbicacion(usuarioId, coords)
    return 'enviada'
  } catch {
    return 'error'
  }
}

/**
 * Tracking por eventos de botones (Gantt 26-oct): se llama al aceptar una
 * emergencia, al marcar "Llegué" y al Iniciar/Completar una OT.
 * Fire-and-forget: no bloquea el flujo del técnico si falla el GPS o la red.
 * Nada de tracking continuo (fuera de alcance).
 */
export function reportarUbicacionEvento(usuarioId: string): void {
  void reportarUbicacion(usuarioId)
}
