import { describe, expect, it } from 'vitest'
import { agruparAgenda, bloquesPorFranja, cargaTecnico, claveCelda, semaforoAgregado } from './agenda'
import type { OrdenTrabajo } from '../api/types'

const local = (d: number, h: number) => new Date(2026, 9, d, h, 0).toISOString()

let n = 0
function orden(p: {
  edificio?: string
  ascensor?: string
  tecnico?: string | null
  fecha: string
  estado?: OrdenTrabajo['estado']
  semaforo?: OrdenTrabajo['semaforo']
}): OrdenTrabajo {
  n += 1
  const edificio = p.edificio ?? 'torre-prisma'
  return {
    id: `o${n}`,
    codigo: `WO-${n}`,
    tipo: 'mantencion',
    prioridad: 'media',
    estado: p.estado ?? 'programado',
    semaforo: p.semaforo ?? 'programado',
    ascensor: {
      id: p.ascensor ?? `a${n}`,
      codigo: `ELV-${n}`,
      torre: null,
      numero: null,
      manas: null,
      edificio: {
        id: edificio,
        nombre: edificio === 'torre-prisma' ? 'Torre Prisma' : 'Clínica Aether',
        direccion: '',
        comuna: '',
        manas: null,
        instrucciones_reinicio: null,
      },
    },
    tecnico: p.tecnico === null ? null : { id: p.tecnico ?? 't1', nombre: 'Técnico' },
    emergencia_id: null,
    fecha_programada: p.fecha,
    inicio_real: null,
    fin_real: null,
    descripcion: null,
    papeleta_id: null,
    papeleta_estado: null,
  }
}

describe('semaforoAgregado', () => {
  it('el peor estado manda', () => {
    expect(semaforoAgregado(['completado', 'programado', 'vencido'])).toBe('vencido')
    expect(semaforoAgregado(['completado', 'en_curso', 'programado'])).toBe('en_curso')
    expect(semaforoAgregado(['completado', 'completado'])).toBe('completado')
  })
})

describe('agruparAgenda', () => {
  it('agrupa por técnico, día, edificio y medio día con progreso', () => {
    const ordenes = [
      orden({ fecha: local(20, 9), estado: 'completado', semaforo: 'completado' }),
      orden({ fecha: local(20, 10) }),
      orden({ fecha: local(20, 11) }),
      orden({ fecha: local(20, 15), edificio: 'clinica-aether' }),
    ]
    const celdas = agruparAgenda(ordenes)
    const bloques = celdas.get(claveCelda('t1', '2026-10-20'))!
    expect(bloques).toHaveLength(2)
    const [prisma, aether] = bloques
    expect(prisma).toMatchObject({
      edificioNombre: 'Torre Prisma',
      franja: 'manana',
      equipos: 3,
      total: 3,
      completadas: 1,
      semaforo: 'programado',
    })
    expect(aether.franja).toBe('tarde')
    const porFranja = bloquesPorFranja(bloques)
    expect(porFranja.manana).toHaveLength(1)
    expect(porFranja.tarde).toHaveLength(1)
  })

  it('un edificio con OTs en mañana y tarde es día completo', () => {
    const celdas = agruparAgenda([
      orden({ fecha: local(21, 9) }),
      orden({ fecha: local(21, 16) }),
    ])
    const [bloque] = celdas.get(claveCelda('t1', '2026-10-21'))!
    expect(bloque.franja).toBe('completo')
    expect(bloque.total).toBe(2)
  })

  it('cuenta equipos distintos y separa técnicos y sin asignar', () => {
    const celdas = agruparAgenda([
      orden({ fecha: local(22, 9), ascensor: 'x' }),
      orden({ fecha: local(22, 10), ascensor: 'x' }),
      orden({ fecha: local(22, 9), tecnico: 't2' }),
      orden({ fecha: local(22, 9), tecnico: null }),
    ])
    expect(celdas.get(claveCelda('t1', '2026-10-22'))![0].equipos).toBe(1)
    expect(celdas.get(claveCelda('t2', '2026-10-22'))).toHaveLength(1)
    expect(celdas.get(claveCelda(null, '2026-10-22'))).toHaveLength(1)
  })

  it('no agenda OTs canceladas', () => {
    const celdas = agruparAgenda([orden({ fecha: local(23, 9), estado: 'cancelado' })])
    expect(celdas.size).toBe(0)
  })
})

describe('cargaTecnico', () => {
  it('cuenta OTs activas y completadas del técnico', () => {
    const ordenes = [
      orden({ fecha: local(20, 9), estado: 'completado' }),
      orden({ fecha: local(20, 10) }),
      orden({ fecha: local(20, 11), estado: 'cancelado' }),
      orden({ fecha: local(20, 11), tecnico: 't2' }),
    ]
    expect(cargaTecnico(ordenes, 't1')).toEqual({ total: 2, completadas: 1 })
  })
})
