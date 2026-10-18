import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../../api/endpoints'

export const INTERVALO_LISTA_MS = 20_000
export const INTERVALO_HILO_MS = 5_000

export const claveConversaciones = (usuarioId: string | undefined) =>
  ['mensajes', 'conversaciones', usuarioId] as const
export const claveHilo = (usuarioId: string | undefined, contraparteId: string | undefined) =>
  ['mensajes', 'hilo', usuarioId, contraparteId] as const

/** Lista de conversaciones con polling (~20 s). Misma clave que usa el badge de los layouts. */
export function useConversaciones(usuarioId: string | undefined) {
  return useQuery({
    queryKey: claveConversaciones(usuarioId),
    queryFn: () => endpoints.mensajes.conversaciones(usuarioId!),
    enabled: !!usuarioId,
    refetchInterval: INTERVALO_LISTA_MS,
  })
}

/** Total de mensajes no leídos (badge en la navegación de ambos perfiles). */
export function useNoLeidos(usuarioId: string | undefined): number {
  const { data } = useConversaciones(usuarioId)
  return (data ?? []).reduce((total, c) => total + c.no_leidos, 0)
}
