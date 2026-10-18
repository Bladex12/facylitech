import { describe, expect, it } from 'vitest'
import {
  combinarFechaHora,
  diaDeTimestamp,
  diasDeSemana,
  fechaSugerida,
  formatoRangoSemana,
  horaDeTimestamp,
  inicioSemana,
  medioDia,
  rangoMes,
  sumarDias,
} from './semana'

const local = (a: number, m: number, d: number, h = 0, mi = 0) =>
  new Date(a, m - 1, d, h, mi).toISOString()

describe('semanas', () => {
  it('el lunes de la semana de un domingo es el lunes anterior', () => {
    expect(inicioSemana('2026-10-18')).toBe('2026-10-12')
    expect(inicioSemana('2026-10-19')).toBe('2026-10-19')
  })

  it('diasDeSemana devuelve lun-dom cruzando de mes', () => {
    expect(diasDeSemana('2026-10-01')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })

  it('sumarDias cruza fin de año', () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('rangoMes considera años bisiestos', () => {
    expect(rangoMes(2028, 2)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
    expect(rangoMes(2026, 10)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
  })

  it('formatoRangoSemana abrevia el mes y muestra ambos si cruza', () => {
    expect(formatoRangoSemana('2026-10-21')).toBe('19 – 25 oct 2026')
    expect(formatoRangoSemana('2026-10-01')).toBe('28 sep – 4 oct 2026')
    expect(formatoRangoSemana('2026-12-31')).toBe('28 dic 2026 – 3 ene 2027')
  })
})

describe('fechaSugerida', () => {
  it('no propone fechas pasadas ni domingos', () => {
    expect(fechaSugerida('2026-10-01', '2026-10-14')).toBe('2026-10-14')
    expect(fechaSugerida('2026-10-18', '2026-10-14')).toBe('2026-10-19')
    expect(fechaSugerida('2026-10-01', '2026-10-18')).toBe('2026-10-19')
    expect(fechaSugerida('2026-10-21', '2026-10-18')).toBe('2026-10-21')
  })
})

describe('horas locales', () => {
  it('combinarFechaHora y vuelta conservan día y hora locales', () => {
    const ts = combinarFechaHora('2026-10-20', '14:30')
    expect(diaDeTimestamp(ts)).toBe('2026-10-20')
    expect(horaDeTimestamp(ts)).toBe('14:30')
  })

  it('medioDia corta a las 13:00', () => {
    expect(medioDia(local(2026, 10, 20, 8, 0))).toBe('manana')
    expect(medioDia(local(2026, 10, 20, 12, 59))).toBe('manana')
    expect(medioDia(local(2026, 10, 20, 13, 0))).toBe('tarde')
  })
})
