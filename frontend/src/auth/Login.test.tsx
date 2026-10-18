import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fijarToken } from '../api/client'
import { AuthProvider } from './AuthContext'
import { Login } from './Login'
import { RedirigirInicio, RequireRol } from './RequireRol'
import { CLAVE_SESION } from './sesion'

const operador = { id: 'op1', nombre: 'Operador Demo', email: 'operador@facylitech.cl', rol: 'operador', activo: true }
const tecnico = { id: 't1', nombre: 'Melvin Zúñiga', email: 'melvin.zuniga@facylitech.cl', rol: 'tecnico', activo: true }

const enUnaHora = () => new Date(Date.now() + 3600_000).toISOString()
const hace = () => new Date(Date.now() - 3600_000).toISOString()

function json(status: number, cuerpo?: unknown, headers: Record<string, string> = {}) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers })
}

function loginOk(usuario: object) {
  return json(200, { access_token: 'tok', token_type: 'bearer', expira_at: enUnaHora(), usuario })
}

function montar(ruta: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/" element={<RedirigirInicio />} />
            <Route path="/login" element={<Login />} />
            <Route path="/operador/*" element={<RequireRol rol="operador"><p>Zona operador</p></RequireRol>} />
            <Route path="/tecnico/*" element={<RequireRol rol="tecnico"><p>Zona técnico</p></RequireRol>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

function completar(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
}

describe('pantalla de login y guards', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    fijarToken(null)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('tiene los atributos de autocompletado y accesibilidad correctos', () => {
    montar('/login')
    const correo = screen.getByLabelText('Correo')
    expect(correo).toHaveAttribute('autocomplete', 'username')
    expect(correo).toHaveFocus()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('muestra y oculta la contraseña', () => {
    montar('/login')
    const campo = screen.getByLabelText('Contraseña')
    expect(campo).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
  })

  it('no muestra cuentas de demostración sin la variable de entorno', () => {
    montar('/login')
    expect(screen.queryByText('Cuentas de demostración')).not.toBeInTheDocument()
  })

  it('un técnico entra y va a /tecnico; guarda la sesión', async () => {
    fetchMock.mockResolvedValueOnce(loginOk(tecnico))
    montar('/login')
    completar('melvin.zuniga@facylitech.cl', 'facylitech2026')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Zona técnico')).toBeInTheDocument()

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/auth\/login$/)
    expect(JSON.parse(init.body)).toEqual({ email: 'melvin.zuniga@facylitech.cl', password: 'facylitech2026' })
    const guardada = JSON.parse(localStorage.getItem(CLAVE_SESION)!)
    expect(guardada.token).toBe('tok')
    expect(guardada.usuario.rol).toBe('tecnico')
  })

  it('un operador entra y va a /operador', async () => {
    fetchMock.mockResolvedValueOnce(loginOk(operador))
    montar('/login')
    completar('operador@facylitech.cl', 'facylitech2026')
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)
    expect(await screen.findByText('Zona operador')).toBeInTheDocument()
  })

  it('credenciales malas: muestra el mensaje del backend, vacía la contraseña y no entra', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { detalle: 'Correo o contraseña incorrectos' }))
    montar('/login')
    completar('operador@facylitech.cl', 'mala-clave')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Correo o contraseña incorrectos')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull()
  })

  it('429 con Retry-After: informa el bloqueo y deshabilita el botón', async () => {
    fetchMock.mockResolvedValueOnce(
      json(429, { detalle: 'Demasiados intentos' }, { 'Retry-After': '300' }),
    )
    montar('/login')
    completar('operador@facylitech.cl', 'x'.repeat(8))
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/Vuelve a intentarlo en 5 min/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reintentar en/ })).toBeDisabled()
  })

  it('sin conexión muestra un mensaje claro', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    montar('/login')
    completar('operador@facylitech.cl', 'x'.repeat(8))
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeInTheDocument()
  })

  it('sin sesión, una ruta protegida redirige a /login', async () => {
    montar('/tecnico/agenda')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('tras entrar vuelve a la ruta que se intentaba abrir si es de su rol', async () => {
    fetchMock.mockResolvedValueOnce(loginOk(tecnico))
    montar('/tecnico/agenda')
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    completar('melvin.zuniga@facylitech.cl', 'facylitech2026')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Zona técnico')).toBeInTheDocument()
  })

  it('si la ruta pedida era de otro rol, va a la sección del rol', async () => {
    fetchMock.mockResolvedValueOnce(loginOk(tecnico))
    montar('/operador/mapa')
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    completar('melvin.zuniga@facylitech.cl', 'facylitech2026')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Zona técnico')).toBeInTheDocument()
  })

  it('rol equivocado en la ruta: manda a la sección propia', async () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ token: 'tok', usuario: tecnico, expira_at: enUnaHora() }),
    )
    fetchMock.mockResolvedValue(json(200, tecnico))
    montar('/operador/dashboard')
    expect(await screen.findByText('Zona técnico')).toBeInTheDocument()
  })

  it('con sesión válida, /login redirige; mientras valida muestra carga y no el login', async () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ token: 'tok', usuario: operador, expira_at: enUnaHora() }),
    )
    let resolver!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolver = r)))
    montar('/login')
    expect(screen.getByRole('status')).toHaveTextContent('Verificando sesión')
    expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
    resolver(json(200, operador))
    expect(await screen.findByText('Zona operador')).toBeInTheDocument()
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer tok')
  })

  it('al recargar sin red conserva la sesión', async () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ token: 'tok', usuario: tecnico, expira_at: enUnaHora() }),
    )
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    montar('/tecnico/agenda')
    expect(await screen.findByText('Zona técnico')).toBeInTheDocument()
    expect(localStorage.getItem(CLAVE_SESION)).not.toBeNull()
  })

  it('un 401 en /auth/me descarta la sesión y vuelve al login', async () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ token: 'tok', usuario: tecnico, expira_at: enUnaHora() }),
    )
    fetchMock.mockResolvedValue(json(401, { detalle: 'Token inválido' }))
    montar('/tecnico/agenda')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByText(/Tu sesión expiró/)).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(CLAVE_SESION)).toBeNull())
  })

  it('una sesión con expira_at vencido se descarta sin llamar al backend', async () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ token: 'tok', usuario: tecnico, expira_at: hace() }),
    )
    montar('/tecnico/agenda')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull()
  })

  it('borra la clave del selector antiguo', async () => {
    localStorage.setItem('facylitech.usuario', JSON.stringify(operador))
    montar('/login')
    expect(localStorage.getItem('facylitech.usuario')).toBeNull()
  })
})
