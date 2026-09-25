import { describe, expect, it } from 'vitest'
import { ordenarListado } from './ordenamiento'
import type { OrdenTrabajo } from '../api/types'

function orden(parcial: Partial<OrdenTrabajo>): OrdenTrabajo {
  return {
    id: crypto.randomUUID(),
    codigo: 'WO-1',
    tipo: 'mantencion',
    prioridad: 'media',
    estado: 'programado',
    semaforo: 'programado',
    ascensor: {
      id: '1',
      codigo: 'ELV-01A',
      torre: null,
      numero: null,
      manas: null,
      edificio: {
        id: '1',
        nombre: 'Edificio',
        direccion: '',
        comuna: '',
        manas: null,
        instrucciones_reinicio: null,
      },
    },
    tecnico: null,
    emergencia_id: null,
    fecha_programada: '2026-09-25T10:00:00Z',
    inicio_real: null,
    fin_real: null,
    descripcion: null,
    papeleta_id: null,
    papeleta_estado: null,
    ...parcial,
  }
}

describe('ordenarListado', () => {
  it('pone vencidos antes que en_curso, programados y completados', () => {
    const completado = orden({ id: 'a', semaforo: 'completado' })
    const programado = orden({ id: 'b', semaforo: 'programado' })
    const enCurso = orden({ id: 'c', semaforo: 'en_curso' })
    const vencido = orden({ id: 'd', semaforo: 'vencido' })

    const resultado = ordenarListado([completado, programado, enCurso, vencido])

    expect(resultado.map((o) => o.id)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('dentro del mismo semáforo, prioridad crítica va primero', () => {
    const baja = orden({ id: 'baja', semaforo: 'programado', prioridad: 'baja' })
    const critica = orden({ id: 'critica', semaforo: 'programado', prioridad: 'critica' })

    const resultado = ordenarListado([baja, critica])

    expect(resultado.map((o) => o.id)).toEqual(['critica', 'baja'])
  })

  it('con igual semáforo y prioridad, la fecha más próxima va primero', () => {
    const tarde = orden({ id: 'tarde', fecha_programada: '2026-09-30T10:00:00Z' })
    const temprano = orden({ id: 'temprano', fecha_programada: '2026-09-20T10:00:00Z' })

    const resultado = ordenarListado([tarde, temprano])

    expect(resultado.map((o) => o.id)).toEqual(['temprano', 'tarde'])
  })
})
