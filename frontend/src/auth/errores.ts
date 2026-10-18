import { ApiError } from '../api/client'
import { formatoEspera } from './sesion'

export interface ErrorLogin {
  texto: string
  /** Segundos de bloqueo temporal (429 con `Retry-After`); null si no aplica. */
  bloqueoSegundos: number | null
}

/** Traduce el fallo de `POST /auth/login` a un mensaje para el formulario. */
export function describirErrorLogin(error: unknown): ErrorLogin {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      const espera = error.retryAfter
      return {
        texto:
          espera && espera > 0
            ? `Demasiados intentos fallidos. Vuelve a intentarlo en ${formatoEspera(espera)}.`
            : error.message || 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
        bloqueoSegundos: espera && espera > 0 ? espera : null,
      }
    }
    if (error.status === 401) {
      return { texto: error.message || 'Correo o contraseña incorrectos.', bloqueoSegundos: null }
    }
    return { texto: error.message, bloqueoSegundos: null }
  }
  if (error instanceof TypeError) {
    return {
      texto: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      bloqueoSegundos: null,
    }
  }
  return { texto: 'Ocurrió un error inesperado. Inténtalo de nuevo.', bloqueoSegundos: null }
}

/** Fallo de cambiar/restablecer contraseña: el 400 del backend trae el motivo legible. */
export function describirErrorPassword(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'El usuario ya no existe.'
    return error.message
  }
  if (error instanceof TypeError) {
    return 'No hay conexión con el servidor. Inténtalo de nuevo cuando tengas señal.'
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}
