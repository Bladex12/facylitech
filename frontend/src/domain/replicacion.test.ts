import { describe, expect, it } from 'vitest'
import type { OrdenReplicada } from '../api/types'
import { parsearMes, resumirPorDia } from './replicacion'

const o = (fecha: string, edificio: string, tecnico: string | null = 'Melvin Zúñiga'): OrdenReplicada => ({
  origen_codigo: 'WO-1',
  ascensor_codigo: 'PRI-A01',
  edificio_nombre: edificio,
  tecnico_nombre: tecnico,
  fecha_origen: fecha,
  fecha_programada: fecha,
  codigo: null,
})

describe('resumirPorDia', () => {
  it('agrupa por día local, cuenta y no repite edificios', () => {
    const r = resumirPorDia([
      o('2026-12-03T14:00:00-03:00', 'Torre Bioma', null),
      o('2026-12-02T08:30:00-03:00', 'Torre Prisma'),
      o('2026-12-02T10:00:00-03:00', 'Torre Prisma'),
      o('2026-12-02T14:00:00-03:00', 'Terraza Raíces'),
    ])
    expect(r).toEqual([
      { dia: '2026-12-02', cantidad: 3, edificios: ['Torre Prisma', 'Terraza Raíces'], sinTecnico: 0 },
      { dia: '2026-12-03', cantidad: 1, edificios: ['Torre Bioma'], sinTecnico: 1 },
    ])
  })

  it('vacío -> lista vacía', () => {
    expect(resumirPorDia([])).toEqual([])
  })
})

describe('parsearMes', () => {
  it('separa año y mes', () => {
    expect(parsearMes('2026-12')).toEqual({ anio: 2026, mes: 12 })
  })
})
