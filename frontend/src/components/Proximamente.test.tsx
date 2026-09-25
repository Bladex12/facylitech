import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Proximamente } from './Proximamente'

describe('Proximamente', () => {
  it('muestra el título y el texto próximamente', () => {
    render(<Proximamente titulo="Mapa" />)
    expect(screen.getByText('Mapa')).toBeInTheDocument()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
  })
})
