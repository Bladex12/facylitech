import { describe, expect, it } from 'vitest'
import {
  SIN_SECTOR,
  agruparPorSector,
  estadoCertificacion,
  filtrarEquipos,
  sugerirPauta,
} from './equipos'
import type { Ascensor, Pauta } from '../api/types'

let n = 0
function equipo(p: Partial<Ascensor>): Ascensor {
  n += 1
  return {
    id: `e${n}`,
    edificio_id: 'b1',
    codigo: `ELV-${n}`,
    codigo_qr: `QR-${n}`,
    torre: null,
    numero: null,
    marca: 'Schindler',
    modelo: '3300',
    anio_instalacion: 2015,
    pisos: 10,
    tipo_equipo: 'electromecanico',
    categoria: 'ascensor',
    estado: 'operacional',
    tasa_fallo: null,
    manas: null,
    ultima_mantencion: null,
    ...p,
  }
}

describe('agruparPorSector', () => {
  it('agrupa por sector con orden natural y categorías, "Sin sector" al final', () => {
    const equipos = [
      equipo({ torre: 'Pabellón 10', codigo: 'A-2' }),
      equipo({ torre: null, codigo: 'X-1' }),
      equipo({ torre: 'Pabellón 2', codigo: 'A-10', categoria: 'montacarga' }),
      equipo({ torre: 'Pabellón 2', codigo: 'A-9' }),
      equipo({ torre: 'Pabellón 2', codigo: 'A-1', categoria: 'montaplatos' }),
    ]
    const grupos = agruparPorSector(equipos)
    expect(grupos.map((g) => g.sector)).toEqual(['Pabellón 2', 'Pabellón 10', SIN_SECTOR])
    expect(grupos[0].total).toBe(3)
    expect(grupos[0].categorias.map((c) => c.categoria)).toEqual([
      'ascensor',
      'montacarga',
      'montaplatos',
    ])
  })

  it('trata categoria ausente como ascensor (backend previo al contrato)', () => {
    const sinCategoria = equipo({}) as Partial<Ascensor>
    delete sinCategoria.categoria
    const [grupo] = agruparPorSector([sinCategoria as Ascensor])
    expect(grupo.categorias[0].categoria).toBe('ascensor')
  })
})

describe('filtrarEquipos', () => {
  const equipos = [
    equipo({ codigo: 'AET-01', torre: 'Pabellón A' }),
    equipo({ codigo: 'AET-02', categoria: 'montaplatos', estado: 'critico' }),
    equipo({ codigo: 'ALV-01', edificio_id: 'b2' }),
  ]
  const nombre = (id: string) => (id === 'b2' ? 'Alva Corporate Center' : 'Clínica Aether')

  it('busca por código, sector y nombre de edificio sin tildes', () => {
    expect(filtrarEquipos(equipos, { texto: 'aet-0' }, nombre)).toHaveLength(2)
    expect(filtrarEquipos(equipos, { texto: 'pabellon a' }, nombre)).toHaveLength(1)
    expect(filtrarEquipos(equipos, { texto: 'clinica' }, nombre)).toHaveLength(2)
    expect(filtrarEquipos(equipos, { texto: 'alva' }, nombre)[0].codigo).toBe('ALV-01')
  })

  it('combina filtros de categoría y estado', () => {
    expect(filtrarEquipos(equipos, { categoria: 'montaplatos' })).toHaveLength(1)
    expect(filtrarEquipos(equipos, { estado: 'critico', categoria: 'ascensor' })).toHaveLength(0)
  })
})

describe('estadoCertificacion', () => {
  it('clasifica vencida, próxima (≤60 días), vigente y sin dato', () => {
    expect(estadoCertificacion('2026-10-01', '2026-10-18')).toEqual({ estado: 'vencida', dias: -17 })
    expect(estadoCertificacion('2026-11-30', '2026-10-18')).toEqual({ estado: 'proxima', dias: 43 })
    expect(estadoCertificacion('2027-06-01', '2026-10-18').estado).toBe('vigente')
    expect(estadoCertificacion(null, '2026-10-18').estado).toBe('sin_dato')
  })
})

describe('sugerirPauta', () => {
  const pauta = (nombre: string, tipo_equipo: Pauta['tipo_equipo']): Pauta => ({
    id: nombre,
    nombre,
    tipo_equipo,
    descripcion: null,
    items: [],
  })
  const pautas = [
    pauta('Mantención preventiva electromecánica', 'electromecanico'),
    pauta('Mantención preventiva hidráulica', 'hidraulico'),
    pauta('Mantención montacargas', 'electromecanico'),
  ]

  it('sugiere por tipo de equipo para ascensores', () => {
    expect(
      sugerirPauta(pautas, 'mantencion', { categoria: 'ascensor', tipo_equipo: 'hidraulico' })?.id,
    ).toBe('Mantención preventiva hidráulica')
  })

  it('prefiere la pauta de la categoría si existe', () => {
    expect(
      sugerirPauta(pautas, 'mantencion', { categoria: 'montacarga', tipo_equipo: 'electromecanico' })
        ?.id,
    ).toBe('Mantención montacargas')
  })

  it('no sugiere pauta para reparaciones o sin equipo', () => {
    expect(sugerirPauta(pautas, 'reparacion', { categoria: 'ascensor', tipo_equipo: 'hidraulico' })).toBeNull()
    expect(sugerirPauta(pautas, 'mantencion', null)).toBeNull()
  })
})
