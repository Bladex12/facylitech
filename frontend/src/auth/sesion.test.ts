import { describe, expect, it } from 'vitest'
import {
  destinoTrasLogin,
  formatoEspera,
  generarPassword,
  parsearSesion,
  rutaInicial,
  rutaPermitida,
  sesionVigente,
  validarPasswordNueva,
  type Sesion,
} from './sesion'

const usuario = { id: 'u1', nombre: 'Melvin', email: 'm@f.cl', rol: 'tecnico', activo: true }
const valida = { token: 'abc.def.ghi', usuario, expira_at: '2026-10-19T12:00:00-03:00' }

describe('parsearSesion', () => {
  it('acepta una sesión completa', () => {
    const s = parsearSesion(JSON.stringify(valida))
    expect(s?.token).toBe('abc.def.ghi')
    expect(s?.usuario.rol).toBe('tecnico')
  })

  it.each([
    ['null', null],
    ['vacío', ''],
    ['JSON roto', '{no es json'],
    ['un arreglo', '[]'],
    ['sin token', JSON.stringify({ ...valida, token: '' })],
    ['token no string', JSON.stringify({ ...valida, token: 5 })],
    ['sin usuario', JSON.stringify({ ...valida, usuario: null })],
    ['rol desconocido', JSON.stringify({ ...valida, usuario: { ...usuario, rol: 'cliente' } })],
    ['expira_at inválido', JSON.stringify({ ...valida, expira_at: 'mañana' })],
    ['sin expira_at', JSON.stringify({ token: 'x', usuario })],
  ])('rechaza %s', (_nombre, raw) => {
    expect(parsearSesion(raw)).toBeNull()
  })
})

describe('sesionVigente', () => {
  const sesion = valida as unknown as Sesion
  it('es vigente antes de expira_at', () => {
    expect(sesionVigente(sesion, new Date('2026-10-19T14:00:00Z'))).toBe(true)
  })
  it('vence exactamente en expira_at y después', () => {
    expect(sesionVigente(sesion, new Date('2026-10-19T15:00:00Z'))).toBe(false)
    expect(sesionVigente(sesion, new Date('2026-10-20T00:00:00Z'))).toBe(false)
  })
})

describe('validarPasswordNueva', () => {
  it('exige al menos 8 caracteres', () => {
    expect(validarPasswordNueva('1234567', '1234567')).toMatch(/al menos 8/)
  })
  it('exige que la confirmación coincida', () => {
    expect(validarPasswordNueva('12345678', '12345679')).toMatch(/no coincide/)
  })
  it('acepta una contraseña válida', () => {
    expect(validarPasswordNueva('12345678', '12345678')).toBeNull()
  })
})

describe('generarPassword', () => {
  it('genera el largo pedido, válido y sin caracteres ambiguos', () => {
    const p = generarPassword(12)
    expect(p).toHaveLength(12)
    expect(p).not.toMatch(/[0O1lI]/)
    expect(validarPasswordNueva(p, p)).toBeNull()
  })
  it('usa el generador de azar inyectado', () => {
    expect(generarPassword(3, () => 0)).toBe('aaa')
  })
})

describe('redirecciones por rol', () => {
  it('rutaInicial', () => {
    expect(rutaInicial('operador')).toBe('/operador')
    expect(rutaInicial('tecnico')).toBe('/tecnico')
  })

  it('rutaPermitida no confunde prefijos parecidos', () => {
    expect(rutaPermitida('/operador/mapa', 'operador')).toBe(true)
    expect(rutaPermitida('/operador', 'operador')).toBe(true)
    expect(rutaPermitida('/operador/mapa', 'tecnico')).toBe(false)
    expect(rutaPermitida('/operadorx', 'operador')).toBe(false)
    expect(rutaPermitida('/login', 'operador')).toBe(false)
  })

  it('vuelve a la ruta pedida si es del rol, conservando query y hash', () => {
    expect(
      destinoTrasLogin({ pathname: '/tecnico/ordenes/9', search: '?a=1', hash: '#x' }, 'tecnico'),
    ).toBe('/tecnico/ordenes/9?a=1#x')
  })

  it('ignora la ruta pedida si es de otro rol o no hay', () => {
    expect(destinoTrasLogin({ pathname: '/operador/mapa' }, 'tecnico')).toBe('/tecnico')
    expect(destinoTrasLogin(undefined, 'operador')).toBe('/operador')
    expect(destinoTrasLogin(null, 'tecnico')).toBe('/tecnico')
    expect(destinoTrasLogin({ pathname: '/login' }, 'operador')).toBe('/operador')
  })
})

describe('formatoEspera', () => {
  it('formatea segundos y minutos', () => {
    expect(formatoEspera(45)).toBe('45 s')
    expect(formatoEspera(60)).toBe('1 min')
    expect(formatoEspera(125)).toBe('2 min 05 s')
    expect(formatoEspera(-3)).toBe('0 s')
    expect(formatoEspera(44.2)).toBe('45 s')
  })
})
