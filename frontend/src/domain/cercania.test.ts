import { describe, expect, it } from 'vitest'
import { formatoDistancia, formatoEta, iniciales } from './cercania'

describe('formatoDistancia', () => {
  it('metros redondeados a decenas bajo 1 km', () => {
    expect(formatoDistancia(847)).toBe('850 m')
    expect(formatoDistancia(0)).toBe('0 m')
  })
  it('kilómetros con coma decimal (es-CL)', () => {
    expect(formatoDistancia(2345)).toBe('2,3 km')
    expect(formatoDistancia(1000)).toBe('1,0 km')
  })
  it('sobre 10 km sin decimales', () => {
    expect(formatoDistancia(15_400)).toBe('15 km')
  })
  it('sin ubicación conocida', () => {
    expect(formatoDistancia(null)).toBe('Sin ubicación')
  })
})

describe('formatoEta', () => {
  it('minutos y horas', () => {
    expect(formatoEta(0)).toBe('< 1 min')
    expect(formatoEta(12)).toBe('~12 min')
    expect(formatoEta(60)).toBe('~1 h')
    expect(formatoEta(75)).toBe('~1 h 15 min')
  })
  it('sin dato', () => {
    expect(formatoEta(null)).toBe('—')
  })
})

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(iniciales('Marcus Delgado')).toBe('MD')
    expect(iniciales('omar')).toBe('O')
    expect(iniciales(null)).toBe('?')
  })
})
