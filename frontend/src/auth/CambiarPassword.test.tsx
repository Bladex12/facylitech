import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fijarToken } from '../api/client'
import { CambiarPassword } from './CambiarPassword'

function json(status: number, cuerpo?: unknown) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status })
}

function llenar(actual: string, nueva: string, confirmacion: string) {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: actual } })
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: nueva } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña nueva'), { target: { value: confirmacion } })
}

describe('CambiarPassword', () => {
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

  const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

  it('es un diálogo accesible y enfoca el primer campo', () => {
    render(<CambiarPassword onCerrar={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Cambiar contraseña' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Contraseña actual')).toHaveFocus()
  })

  it('valida largo y coincidencia en el cliente sin llamar a la API', () => {
    render(<CambiarPassword onCerrar={() => {}} />)
    llenar('actual-1234', 'corta', 'corta')
    enviar()
    expect(screen.getByText(/contraseña nueva debe tener al menos 8/)).toBeInTheDocument()
    llenar('actual-1234', 'nueva-12345', 'nueva-99999')
    enviar()
    expect(screen.getByText(/no coincide/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('muestra el 400 del backend', async () => {
    fetchMock.mockResolvedValueOnce(json(400, { detalle: 'La contraseña actual no es correcta' }))
    render(<CambiarPassword onCerrar={() => {}} />)
    llenar('equivocada', 'nueva-12345', 'nueva-12345')
    enviar()
    expect(await screen.findByText('La contraseña actual no es correcta')).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/auth\/cambiar-password$/)
    expect(JSON.parse(init.body)).toEqual({ password_actual: 'equivocada', password_nueva: 'nueva-12345' })
  })

  it('confirma el cambio y no cierra la sesión', async () => {
    fetchMock.mockResolvedValueOnce(json(204))
    const onCerrar = vi.fn()
    render(<CambiarPassword onCerrar={onCerrar} />)
    llenar('actual-1234', 'nueva-12345', 'nueva-12345')
    enviar()
    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
  })

  it('cierra con Escape', () => {
    const onCerrar = vi.fn()
    render(<CambiarPassword onCerrar={onCerrar} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCerrar).toHaveBeenCalled()
  })
})
