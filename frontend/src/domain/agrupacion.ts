import type { OrdenTrabajo, TipoOrdenTrabajo } from '../api/types'
import { ordenarListado } from './ordenamiento'
import { diaLocal, etiquetaDia } from './tiempo'

export interface GrupoFecha<T> {
  dia: string
  titulo: string
  items: T[]
}

/** Pendiente = todo lo que el técnico aún debe atender (incluye vencidas). */
export function esPendiente(orden: OrdenTrabajo): boolean {
  return orden.estado === 'programado' || orden.estado === 'en_curso'
}

/**
 * Agrupa órdenes por día local de `fecha_programada`.
 * - `asc`: pendientes (vencidas primero porque son de días pasados); dentro
 *   del día, regla del cliente (`ordenarListado`).
 * - `desc`: historial (lo más reciente arriba).
 */
export function agruparPorDia(
  ordenes: OrdenTrabajo[],
  ahora: Date,
  sentido: 'asc' | 'desc' = 'asc',
): GrupoFecha<OrdenTrabajo>[] {
  const porDia = new Map<string, OrdenTrabajo[]>()
  for (const o of ordenes) {
    const dia = diaLocal(o.fecha_programada)
    const lista = porDia.get(dia)
    if (lista) lista.push(o)
    else porDia.set(dia, [o])
  }
  const dias = [...porDia.keys()].sort()
  if (sentido === 'desc') dias.reverse()
  return dias.map((dia) => {
    const items = porDia.get(dia)!
    return {
      dia,
      titulo: etiquetaDia(dia, ahora),
      items:
        sentido === 'asc'
          ? ordenarListado(items)
          : [...items].sort((a, b) =>
              (b.fin_real ?? b.fecha_programada).localeCompare(a.fin_real ?? a.fecha_programada),
            ),
    }
  })
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Filtro de la vista Trabajos: tipo + búsqueda libre (código, equipo, edificio, dirección). */
export function filtrarOrdenes(
  ordenes: OrdenTrabajo[],
  filtro: { tipo: TipoOrdenTrabajo | 'todos'; busqueda: string },
): OrdenTrabajo[] {
  const terminos = normalizar(filtro.busqueda).split(/\s+/).filter(Boolean)
  return ordenes.filter((o) => {
    if (filtro.tipo !== 'todos' && o.tipo !== filtro.tipo) return false
    if (terminos.length === 0) return true
    const texto = normalizar(
      [
        o.codigo,
        o.ascensor.codigo,
        o.ascensor.edificio.nombre,
        o.ascensor.edificio.direccion,
        o.ascensor.edificio.comuna,
        o.descripcion ?? '',
      ].join(' '),
    )
    return terminos.every((t) => texto.includes(t))
  })
}

/** Paradas del día en orden de agenda (las que el técnico aún debe visitar). */
export function paradasDelDia(ordenes: OrdenTrabajo[], dia: string): OrdenTrabajo[] {
  return ordenarListado(
    ordenes.filter((o) => esPendiente(o) && diaLocal(o.fecha_programada) === dia),
  )
}
