const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number
  /** Segundos de espera sugeridos por el backend (header `Retry-After`, típico en 429). */
  retryAfter: number | null
  constructor(status: number, message: string, retryAfter: number | null = null) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

export const MENSAJE_SIN_PERMISO = 'No tienes permiso para esta acción.'

/** Rutas donde un 401 significa "credenciales malas", no "sesión caída". */
const RUTAS_SIN_CIERRE_POR_401 = ['/auth/login', '/auth/cambiar-password']

// El cliente no conoce React ni el router: AuthProvider le entrega el token
// vigente y se registra para enterarse de las sesiones caídas.
let tokenActual: string | null = null
let manejadorNoAutorizado: (() => void) | null = null

/** Token que se envía como `Authorization: Bearer` en todo request. */
export function fijarToken(token: string | null): void {
  tokenActual = token
}

/** Callback para un 401 (token vencido/inválido). Devuelve la función para desregistrar. */
export function onNoAutorizado(manejador: () => void): () => void {
  manejadorNoAutorizado = manejador
  return () => {
    if (manejadorNoAutorizado === manejador) manejadorNoAutorizado = null
  }
}

function parsearRetryAfter(valor: string | null): number | null {
  if (!valor) return null
  const segundos = Number(valor)
  if (Number.isFinite(segundos) && segundos >= 0) return Math.ceil(segundos)
  const fecha = Date.parse(valor)
  return Number.isNaN(fecha) ? null : Math.max(0, Math.ceil((fecha - Date.now()) / 1000))
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tokenEnviado = tokenActual
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json')
  if (tokenEnviado) headers.set('Authorization', `Bearer ${tokenEnviado}`)

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detalle: res.statusText }))
    const detalle: string = body?.detalle ?? body?.detail ?? res.statusText
    if (res.status === 401 && !RUTAS_SIN_CIERRE_POR_401.some((r) => path.startsWith(r))) {
      // Una respuesta tardía de una sesión anterior no debe cerrar la sesión nueva.
      if (tokenEnviado !== null && tokenEnviado === tokenActual) manejadorNoAutorizado?.()
    }
    if (res.status === 403) throw new ApiError(403, MENSAJE_SIN_PERMISO)
    throw new ApiError(
      res.status,
      typeof detalle === 'string' ? detalle : JSON.stringify(detalle),
      parsearRetryAfter(res.headers.get('Retry-After')),
    )
  }
  if (res.status === 204) return undefined as T
  const texto = await res.text()
  return (texto ? JSON.parse(texto) : undefined) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
}

/** URL absoluta para archivos servidos por el backend (evidencias con storage local). */
export function urlArchivo(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  return BASE_URL.replace(/\/api\/v1\/?$/, '') + url
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (usable.length === 0) return ''
  return '?' + new URLSearchParams(usable as [string, string][]).toString()
}

export { toQueryString }
