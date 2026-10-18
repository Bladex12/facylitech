import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, fijarToken, MENSAJE_SIN_PERMISO, onNoAutorizado } from './client'

function responder(status: number, cuerpo?: unknown, headers: Record<string, string> = {}) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers })
}

/** Espera el rechazo de la petición y lo devuelve tipado. */
async function falla(p: Promise<unknown>): Promise<ApiError> {
  return (await p.then(
    () => {
      throw new Error('se esperaba un rechazo')
    },
    (e) => e,
  )) as ApiError
}

describe('api client: autenticación', () => {
  const fetchMock = vi.fn()
  let desregistrar: () => void
  const noAutorizado = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    noAutorizado.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    fijarToken('tok-1')
    desregistrar = onNoAutorizado(noAutorizado)
  })
  afterEach(() => {
    desregistrar()
    fijarToken(null)
    vi.unstubAllGlobals()
  })

  function cabecera(llamada = 0, nombre = 'Authorization') {
    return new Headers(fetchMock.mock.calls[llamada][1].headers).get(nombre)
  }

  it('envía Authorization: Bearer en GET, POST y upload', async () => {
    fetchMock.mockImplementation(async () => responder(200, {}))
    await api.get('/x')
    await api.post('/x', { a: 1 })
    await api.upload('/x', new FormData())
    for (const i of [0, 1, 2]) expect(cabecera(i)).toBe('Bearer tok-1')
    expect(cabecera(0, 'Content-Type')).toBe('application/json')
    // el multipart debe dejar que el navegador ponga el boundary
    expect(cabecera(2, 'Content-Type')).toBeNull()
  })

  it('no envía Authorization sin sesión', async () => {
    fijarToken(null)
    fetchMock.mockResolvedValue(responder(200, {}))
    await api.get('/x')
    expect(cabecera()).toBeNull()
  })

  it('un 401 avisa a quien se registró', async () => {
    fetchMock.mockResolvedValue(responder(401, { detalle: 'Token inválido' }))
    await expect(api.get('/ordenes-trabajo')).rejects.toMatchObject({ status: 401 })
    expect(noAutorizado).toHaveBeenCalledTimes(1)
  })

  it.each(['/auth/login', '/auth/cambiar-password'])('un 401 en %s no cierra la sesión', async (ruta) => {
    fetchMock.mockResolvedValue(responder(401, { detalle: 'Credenciales inválidas' }))
    const error = await falla(api.post(ruta, {}))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe('Credenciales inválidas')
    expect(noAutorizado).not.toHaveBeenCalled()
  })

  it('un 401 tardío de una sesión anterior no cierra la sesión nueva', async () => {
    fetchMock.mockImplementation(async () => {
      fijarToken('tok-2') // mientras la petición viaja, otro usuario entra
      return responder(401, { detalle: 'Token expirado' })
    })
    await api.get('/x').catch(() => {})
    expect(noAutorizado).not.toHaveBeenCalled()
  })

  it('un 403 da un mensaje claro y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(responder(403, { detalle: 'forbidden' }))
    const error = await falla(api.get('/clientes'))
    expect(error.status).toBe(403)
    expect(error.message).toBe(MENSAJE_SIN_PERMISO)
    expect(noAutorizado).not.toHaveBeenCalled()
  })

  it('un 429 conserva el mensaje del backend y Retry-After', async () => {
    fetchMock.mockResolvedValue(
      responder(429, { detalle: 'Demasiados intentos' }, { 'Retry-After': '120' }),
    )
    const error = await falla(api.post('/auth/login', {}))
    expect(error.status).toBe(429)
    expect(error.message).toBe('Demasiados intentos')
    expect(error.retryAfter).toBe(120)
  })

  it('tolera respuestas sin cuerpo (204 y 200 vacío)', async () => {
    fetchMock.mockResolvedValueOnce(responder(204))
    await expect(api.post('/auth/cambiar-password', {})).resolves.toBeUndefined()
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    await expect(api.get('/x')).resolves.toBeUndefined()
  })

  it('tolera errores sin cuerpo JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 500, statusText: 'Server Error' }))
    const error = await falla(api.get('/x'))
    expect(error.status).toBe(500)
    expect(error.message).toBe('Server Error')
  })
})
