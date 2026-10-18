import { api, toQueryString } from './client'
import type { Pagina } from './types'

/** Máximo que aceptan los listados del backend (`limit ≤ 100`). */
const LIMITE = 100
/** Tope de seguridad: con ~20 usuarios y ~80 equipos (RNF-06) nunca se llega. */
const MAX_PAGINAS = 20

/**
 * Trae todas las páginas de un listado paginado. Los listados por defecto
 * devuelven 20 elementos, y un edificio real (Clínica Aether) tiene 22
 * equipos y un mes del calendario supera las 80 OTs.
 */
export async function traerTodo<T>(
  ruta: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const items: T[] = []
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const res = await api.get<Pagina<T>>(
      `${ruta}${toQueryString({ ...params, limit: LIMITE, offset: items.length })}`,
    )
    items.push(...res.items)
    if (res.items.length === 0 || items.length >= res.total) break
  }
  return items
}
