import { describe, expect, it } from 'vitest'
import type { OrdenTrabajo } from '../api/types'
import { agruparPorDia, filtrarOrdenes, paradasDelDia } from './agrupacion'
import { distanciaM } from './geo'
import { calcularDimensiones, formatoBytes } from './imagen'
import { extraerCodigoQr } from './qr'
import {
  etiquetaDia,
  formatoCuentaRegresiva,
  formatoDistancia,
  formatoMarcaChat,
  segundosRestantes,
} from './tiempo'

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
        nombre: 'Northgate Tower',
        direccion: 'Av. Providencia 1240',
        comuna: 'Santiago',
        manas: null,
        instrucciones_reinicio: null,
      },
    },
    tecnico: null,
    emergencia_id: null,
    fecha_programada: new Date(2026, 9, 18, 10).toISOString(),
    inicio_real: null,
    fin_real: null,
    descripcion: null,
    papeleta_id: null,
    papeleta_estado: null,
    ...parcial,
  }
}

describe('extraerCodigoQr', () => {
  it('acepta el código tal cual y lo normaliza a mayúsculas', () => {
    expect(extraerCodigoQr('  fcy-b01-01a ')).toBe('FCY-B01-01A')
  })
  it('extrae el código desde una URL', () => {
    expect(extraerCodigoQr('https://facylitech.cl/qr/FCY-B04-04B?x=1')).toBe('FCY-B04-04B')
  })
  it('completa el prefijo en la entrada manual', () => {
    expect(extraerCodigoQr('b01-01a')).toBe('FCY-B01-01A')
    expect(extraerCodigoQr('B01 01A')).toBe('FCY-B01-01A')
  })
  it('rechaza texto que no es un código', () => {
    expect(extraerCodigoQr('')).toBeNull()
    expect(extraerCodigoQr('hola')).toBeNull()
    expect(extraerCodigoQr('https://google.com')).toBeNull()
  })
})

describe('calcularDimensiones', () => {
  it('reduce el lado mayor a 1600 manteniendo proporción', () => {
    expect(calcularDimensiones(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 })
    expect(calcularDimensiones(3024, 4032)).toEqual({ ancho: 1200, alto: 1600 })
  })
  it('no agranda imágenes pequeñas', () => {
    expect(calcularDimensiones(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })
  it('tolera dimensiones inválidas', () => {
    expect(calcularDimensiones(0, 100)).toEqual({ ancho: 0, alto: 0 })
  })
  it('formatea tamaños', () => {
    expect(formatoBytes(512)).toBe('512 B')
    expect(formatoBytes(310 * 1024)).toBe('310 KB')
    expect(formatoBytes(2.4 * 1024 * 1024)).toBe('2,4 MB')
  })
})

describe('cuenta regresiva y formatos', () => {
  const ahora = new Date(2026, 9, 18, 12, 0, 0)
  it('calcula segundos restantes y no baja de 0', () => {
    expect(segundosRestantes(new Date(2026, 9, 18, 12, 4, 59).toISOString(), ahora)).toBe(299)
    expect(segundosRestantes(new Date(2026, 9, 18, 11, 0).toISOString(), ahora)).toBe(0)
    expect(segundosRestantes(null, ahora)).toBeNull()
  })
  it('formatea m:ss y h:mm:ss', () => {
    expect(formatoCuentaRegresiva(299)).toBe('4:59')
    expect(formatoCuentaRegresiva(5)).toBe('0:05')
    expect(formatoCuentaRegresiva(3725)).toBe('1:02:05')
    expect(formatoCuentaRegresiva(-3)).toBe('0:00')
  })
  it('formatea distancias', () => {
    expect(formatoDistancia(847)).toBe('850 m')
    expect(formatoDistancia(2340)).toBe('2,3 km')
    expect(formatoDistancia(15400)).toBe('15 km')
    expect(formatoDistancia(null)).toBe('—')
  })
  it('etiqueta días relativos', () => {
    expect(etiquetaDia('2026-10-18', ahora)).toBe('Hoy')
    expect(etiquetaDia('2026-10-19', ahora)).toBe('Mañana')
    expect(etiquetaDia('2026-10-17', ahora)).toBe('Ayer')
    expect(etiquetaDia('2026-10-20', ahora)).toBe('martes 20 de octubre')
    expect(etiquetaDia('2025-12-01', ahora)).toBe('lunes 1 de diciembre de 2025')
  })
  it('marca de chat compacta', () => {
    expect(formatoMarcaChat(new Date(2026, 9, 17, 9).toISOString(), ahora)).toBe('ayer')
    expect(formatoMarcaChat(new Date(2026, 9, 2, 9).toISOString(), ahora)).toBe('2 oct')
  })
})

describe('agrupación de trabajos', () => {
  const ahora = new Date(2026, 9, 18, 8)
  it('agrupa por día y ordena con la regla del cliente', () => {
    const a = orden({ id: 'a', fecha_programada: new Date(2026, 9, 19, 9).toISOString() })
    const b = orden({ id: 'b', prioridad: 'baja' })
    const c = orden({ id: 'c', prioridad: 'critica', fecha_programada: new Date(2026, 9, 18, 15).toISOString() })
    const grupos = agruparPorDia([a, b, c], ahora)
    expect(grupos.map((g) => g.titulo)).toEqual(['Hoy', 'Mañana'])
    expect(grupos[0].items.map((o) => o.id)).toEqual(['c', 'b'])
  })
  it('el historial va del más reciente al más antiguo', () => {
    const viejo = orden({ id: 'v', estado: 'completado', fecha_programada: new Date(2026, 9, 1).toISOString() })
    const nuevo = orden({ id: 'n', estado: 'completado', fecha_programada: new Date(2026, 9, 10).toISOString() })
    expect(agruparPorDia([viejo, nuevo], ahora, 'desc').map((g) => g.items[0].id)).toEqual(['n', 'v'])
  })
  it('filtra por tipo y búsqueda sin tildes', () => {
    const m = orden({ id: 'm' })
    const r = orden({
      id: 'r',
      tipo: 'reparacion',
      ascensor: { ...m.ascensor, edificio: { ...m.ascensor.edificio, nombre: 'Clínica Las Nieves' } },
    })
    expect(filtrarOrdenes([m, r], { tipo: 'reparacion', busqueda: '' }).map((o) => o.id)).toEqual(['r'])
    expect(filtrarOrdenes([m, r], { tipo: 'todos', busqueda: 'clinica' }).map((o) => o.id)).toEqual(['r'])
    expect(filtrarOrdenes([m, r], { tipo: 'todos', busqueda: 'wo-1 northgate' }).map((o) => o.id)).toEqual(['m'])
    expect(filtrarOrdenes([m, r], { tipo: 'todos', busqueda: 'elv-01a' })).toHaveLength(2)
  })
  it('paradas del día excluye completadas y otros días', () => {
    const hoy = orden({ id: 'h' })
    const hecha = orden({ id: 'x', estado: 'completado', semaforo: 'completado' })
    const manana = orden({ id: 'm', fecha_programada: new Date(2026, 9, 19, 9).toISOString() })
    expect(paradasDelDia([hoy, hecha, manana], '2026-10-18').map((o) => o.id)).toEqual(['h'])
  })
})

describe('distanciaM', () => {
  it('Plaza de Armas → Costanera Center ≈ 4,7 km', () => {
    const d = distanciaM({ lat: -33.4378, lon: -70.6505 }, { lat: -33.4176, lon: -70.6067 })
    expect(d).toBeGreaterThan(4500)
    expect(d).toBeLessThan(5000)
  })
})
