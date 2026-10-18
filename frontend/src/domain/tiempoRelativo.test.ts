import { describe, expect, it } from 'vitest'
import {
  fechaLocalIso,
  formatoCuentaRegresiva,
  minutosDesde,
  rangoSemana,
  segundosRestantes,
  sumarDiasIso,
  tiempoTranscurrido,
} from './tiempoRelativo'

const AHORA = new Date('2026-10-18T15:00:00Z')
const antes = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString()

describe('tiempoTranscurrido', () => {
  it('menos de un minuto es "recién"', () => {
    expect(tiempoTranscurrido(antes(0.5), AHORA)).toBe('recién')
  })
  it('minutos, horas y días', () => {
    expect(tiempoTranscurrido(antes(5), AHORA)).toBe('hace 5 min')
    expect(tiempoTranscurrido(antes(120), AHORA)).toBe('hace 2 h')
    expect(tiempoTranscurrido(antes(130), AHORA)).toBe('hace 2 h 10 min')
    expect(tiempoTranscurrido(antes(60 * 50), AHORA)).toBe('hace 2 d')
  })
  it('sin fecha', () => {
    expect(tiempoTranscurrido(null, AHORA)).toBe('sin registro')
  })
})

describe('cuenta regresiva', () => {
  it('segundosRestantes nunca es negativo y es null sin fecha', () => {
    expect(segundosRestantes(new Date(AHORA.getTime() + 90_000).toISOString(), AHORA)).toBe(90)
    expect(segundosRestantes(antes(1), AHORA)).toBe(0)
    expect(segundosRestantes(null, AHORA)).toBeNull()
  })
  it('formato m:ss', () => {
    expect(formatoCuentaRegresiva(299)).toBe('4:59')
    expect(formatoCuentaRegresiva(5)).toBe('0:05')
    expect(formatoCuentaRegresiva(-3)).toBe('0:00')
  })
  it('minutosDesde no es negativo', () => {
    expect(minutosDesde(antes(12), AHORA)).toBe(12)
    expect(minutosDesde(new Date(AHORA.getTime() + 60_000).toISOString(), AHORA)).toBe(0)
  })
})

describe('fechas locales', () => {
  it('fechaLocalIso usa la fecha local, no UTC', () => {
    expect(fechaLocalIso(new Date(2026, 9, 18, 23, 30))).toBe('2026-10-18')
  })
  it('rangoSemana va de lunes a domingo', () => {
    // domingo 18-oct-2026
    expect(rangoSemana(new Date(2026, 9, 18, 12))).toEqual({ desde: '2026-10-12', hasta: '2026-10-18' })
    // lunes 19-oct-2026
    expect(rangoSemana(new Date(2026, 9, 19, 8))).toEqual({ desde: '2026-10-19', hasta: '2026-10-25' })
  })
  it('sumarDiasIso cruza meses', () => {
    expect(sumarDiasIso(new Date(2026, 9, 30), 3)).toBe('2026-11-02')
  })
})
