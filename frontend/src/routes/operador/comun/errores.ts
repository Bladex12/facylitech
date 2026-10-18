import { ApiError } from '../../../api/client'

/** Mensaje legible para errores de la API (incluye los 409 de transición). */
export function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return `No se puede realizar: ${error.message}`
    if (error.status === 404 || error.status === 405)
      return 'El servidor aún no soporta esta acción (endpoint no disponible).'
    if (error.status === 422) return `Datos inválidos: ${error.message}`
    return error.message
  }
  if (error instanceof TypeError) return 'No hay conexión con el servidor.'
  return error instanceof Error ? error.message : 'Error inesperado.'
}
