import { describe, expect, it } from 'vitest'
import type { OrdenTrabajo, Semaforo, Usuario } from '../api/types'
import { calcularCarga, filtrarTecnicos, ubicacionDesactualizada } from './equipoTecnico'

// Domingo 18-oct-2026 10:00 hora local
const AHORA = new Date(2026, 9, 18, 10, 0)

function orden(fecha: Date, parcial: Partial<OrdenTrabajo> = {}): OrdenTrabajo {
  return {
    id: crypto.randomUUID(),
    estado: 'programado',
    semaforo: 'programado' as Semaforo,
    fecha_programada: fecha.toISOString(),
    ...parcial,
  } as OrdenTrabajo
}

function tecnico(parcial: Partial<Usuario>): Usuario {
  return {
    id: crypto.randomUUID(),
    nombre: 'X',
    email: '',
    rol: 'tecnico',
    telefono: null,
    activo: true,
    zona: null,
    especialidades: null,
    estado_disponibilidad: 'disponible',
    rut: null,
    ultima_ubicacion: null,
    ultima_ubicacion_at: null,
    ...parcial,
  }
}

describe('calcularCarga', () => {
  it('cuenta hoy, semana, vencidas y en curso, sin canceladas', () => {
    const carga = calcularCarga(
      [
        orden(new Date(2026, 9, 18, 9), { estado: 'completado', semaforo: 'completado' }),
        orden(new Date(2026, 9, 18, 15)),
        orden(new Date(2026, 9, 18, 8), { estado: 'en_curso', semaforo: 'en_curso' }),
        orden(new Date(2026, 9, 13, 9), { semaforo: 'vencido' }),
        orden(new Date(2026, 9, 12, 9), { estado: 'cancelado' }),
      ],
      AHORA,
    )
    expect(carga.hoy).toBe(3)
    expect(carga.hoyPendientes).toBe(2)
    expect(carga.semana).toBe(4)
    expect(carga.vencidas).toBe(1)
    expect(carga.enCurso).toBe(1)
    // lunes 12 (cancelada, no cuenta), martes 13 = 1, domingo 18 = 3
    expect(carga.porDia).toEqual([0, 1, 0, 0, 0, 0, 3])
  })
})

describe('ubicacionDesactualizada', () => {
  it('sin ubicación o más antigua que el umbral', () => {
    expect(ubicacionDesactualizada(null, AHORA)).toBe(true)
    expect(ubicacionDesactualizada(new Date(AHORA.getTime() - 10 * 60_000).toISOString(), AHORA)).toBe(false)
    expect(ubicacionDesactualizada(new Date(AHORA.getTime() - 45 * 60_000).toISOString(), AHORA)).toBe(true)
  })
})

describe('filtrarTecnicos', () => {
  const lista = [
    tecnico({ nombre: 'Omar Benali', zona: 'Zona Oeste', estado_disponibilidad: 'disponible' }),
    tecnico({ nombre: 'Marcus Delgado', zona: 'Zona Norte', estado_disponibilidad: 'en_terreno', rut: '12.345.678-9' }),
    tecnico({ nombre: 'Ángela Núñez', zona: 'Zona Sur', estado_disponibilidad: 'disponible' }),
  ]

  it('ordena por nombre y filtra por disponibilidad', () => {
    expect(filtrarTecnicos(lista, { texto: '', disponibilidad: 'todos' }).map((t) => t.nombre)).toEqual([
      'Ángela Núñez',
      'Marcus Delgado',
      'Omar Benali',
    ])
    expect(filtrarTecnicos(lista, { texto: '', disponibilidad: 'en_terreno' })).toHaveLength(1)
  })

  it('busca sin tildes por nombre, zona o RUT', () => {
    expect(filtrarTecnicos(lista, { texto: 'angela', disponibilidad: 'todos' })[0]?.nombre).toBe('Ángela Núñez')
    expect(filtrarTecnicos(lista, { texto: 'norte', disponibilidad: 'todos' })[0]?.nombre).toBe('Marcus Delgado')
    expect(filtrarTecnicos(lista, { texto: '345', disponibilidad: 'todos' })).toHaveLength(1)
  })
})
