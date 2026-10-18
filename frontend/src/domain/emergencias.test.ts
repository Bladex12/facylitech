import { describe, expect, it } from 'vitest'
import type { AsignacionEmergencia, CandidatoTecnico, EstadoAsignacion, Usuario } from '../api/types'
import {
  alternarEnCascada,
  moverEnCascada,
  ordenarEmergencias,
  resumirCascada,
  sugerirCascada,
} from './emergencias'

function candidato(id: string, distancia_m: number | null): CandidatoTecnico {
  return {
    tecnico: { id, nombre: id } as Usuario,
    distancia_m,
    eta_min: distancia_m === null ? null : Math.round(distancia_m / 416),
    especialidad_match: false,
    disponible: true,
    ordenes_en_curso: 0,
  }
}

function asignacion(orden: number, estado: EstadoAsignacion): AsignacionEmergencia {
  return {
    id: `a${orden}`,
    emergencia_id: 'e1',
    tecnico: { id: `t${orden}`, nombre: `Técnico ${orden}` },
    orden,
    estado,
    distancia_m: 1000 * orden,
    notificada_at: null,
    respondida_at: null,
    expira_at: null,
    motivo_rechazo: null,
  }
}

describe('ordenarEmergencias', () => {
  it('activas > en atención > cerradas, y la más reciente primero dentro del grupo', () => {
    const lista = [
      { id: 'cerrada', estado: 'cerrada' as const, reportada_at: '2026-10-18T14:00:00Z' },
      { id: 'vieja', estado: 'activa' as const, reportada_at: '2026-10-18T09:00:00Z' },
      { id: 'atencion', estado: 'en_atencion' as const, reportada_at: '2026-10-18T13:00:00Z' },
      { id: 'nueva', estado: 'activa' as const, reportada_at: '2026-10-18T12:00:00Z' },
    ]
    expect(ordenarEmergencias(lista).map((e) => e.id)).toEqual(['nueva', 'vieja', 'atencion', 'cerrada'])
  })
})

describe('armado de la cascada', () => {
  it('sugerirCascada respeta el ranking y omite técnicos sin ubicación', () => {
    const ranking = [candidato('a', 500), candidato('b', null), candidato('c', 900), candidato('d', 1200), candidato('e', 3000)]
    expect(sugerirCascada(ranking)).toEqual(['a', 'c', 'd'])
    expect(sugerirCascada(ranking, 1)).toEqual(['a'])
  })

  it('alternarEnCascada agrega al final o quita', () => {
    expect(alternarEnCascada(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
    expect(alternarEnCascada(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('moverEnCascada sube y baja sin salirse del rango', () => {
    expect(moverEnCascada(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moverEnCascada(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    const lista = ['a', 'b']
    expect(moverEnCascada(lista, 0, -1)).toBe(lista)
    expect(moverEnCascada(lista, 1, 1)).toBe(lista)
  })
})

describe('resumirCascada', () => {
  it('sin asignaciones -> sin despacho', () => {
    expect(resumirCascada({ asignaciones: [], cascada_agotada: false }).fase).toBe('sin_despacho')
  })

  it('con una pendiente -> esperando, y ordena por `orden`', () => {
    const r = resumirCascada({
      asignaciones: [asignacion(3, 'en_espera'), asignacion(1, 'rechazada'), asignacion(2, 'pendiente')],
      cascada_agotada: false,
    })
    expect(r.fase).toBe('esperando')
    expect(r.actual?.orden).toBe(2)
    expect(r.asignaciones.map((a) => a.orden)).toEqual([1, 2, 3])
  })

  it('una aceptada manda sobre todo lo demás', () => {
    const r = resumirCascada({
      asignaciones: [asignacion(1, 'rechazada'), asignacion(2, 'aceptada'), asignacion(3, 'cancelada')],
      cascada_agotada: false,
    })
    expect(r.fase).toBe('aceptada')
    expect(r.actual?.tecnico.nombre).toBe('Técnico 2')
  })

  it('todos rechazaron o expiraron -> agotada (aunque el flag no venga)', () => {
    const asignaciones = [asignacion(1, 'rechazada'), asignacion(2, 'expirada')]
    expect(resumirCascada({ asignaciones, cascada_agotada: true }).fase).toBe('agotada')
    expect(resumirCascada({ asignaciones, cascada_agotada: false }).fase).toBe('agotada')
  })
})
