import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fijarToken } from '../../api/client'
import { BotonLlegue } from './BotonLlegue'

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BotonLlegue usuarioId="u-1" />
    </QueryClientProvider>,
  )
}

function gps(ok: boolean) {
  const getCurrentPosition = vi.fn((exito: PositionCallback, error: PositionErrorCallback) => {
    if (ok) exito({ coords: { latitude: -33.45, longitude: -70.66 } } as GeolocationPosition)
    else error({ code: 1 } as GeolocationPositionError)
  })
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
}

describe('BotonLlegue', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    fijarToken('tok')
  })
  afterEach(() => {
    cleanup()
    fijarToken(null)
    vi.unstubAllGlobals()
  })

  it('envía la ubicación al backend y confirma la llegada', async () => {
    gps(true)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'u-1' }), { status: 200 }))
    renderizar()
    fireEvent.click(screen.getByRole('button', { name: 'Llegué al edificio' }))

    expect(await screen.findByText(/Llegada informada a la central/)).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/usuarios/u-1/ubicacion')
    expect(JSON.parse(init.body)).toEqual({ lat: -33.45, lon: -70.66 })
    expect(screen.getByRole('button', { name: 'Actualizar mi ubicación' })).toBeInTheDocument()
  })

  it('avisa si no hay GPS y no llama a la API', async () => {
    gps(false)
    renderizar()
    fireEvent.click(screen.getByRole('button', { name: 'Llegué al edificio' }))

    expect(await screen.findByText(/No se pudo leer el GPS/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('avisa si falla la red', async () => {
    gps(true)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderizar()
    fireEvent.click(screen.getByRole('button', { name: 'Llegué al edificio' }))

    expect(await screen.findByText(/Sin conexión/)).toBeInTheDocument()
  })
})
