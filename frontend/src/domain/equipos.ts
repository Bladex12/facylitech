/**
 * Reglas de presentación de equipos (ascensores, montacargas, montaplatos):
 * agrupación por sector y categoría, búsqueda, certificación y pauta sugerida.
 */
import type {
  Ascensor,
  CategoriaEquipo,
  EstadoAscensor,
  Pauta,
  TipoOrdenTrabajo,
} from '../api/types'

export const CATEGORIAS: CategoriaEquipo[] = ['ascensor', 'montacarga', 'montaplatos']

export const SIN_SECTOR = 'Sin sector'

/** Tolerante a backends que aún no exponen `categoria` (default del contrato). */
export function categoriaDe(a: Pick<Ascensor, 'categoria'>): CategoriaEquipo {
  return a.categoria ?? 'ascensor'
}

const comparadorNatural = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

export function compararNatural(a: string, b: string): number {
  return comparadorNatural.compare(a, b)
}

export interface GrupoCategoria {
  categoria: CategoriaEquipo
  equipos: Ascensor[]
}

export interface GrupoSector {
  sector: string
  total: number
  categorias: GrupoCategoria[]
}

/** Agrupa por sector (`torre`) y, dentro, por categoría. Orden natural
 * (Torre 2 antes que Torre 10), "Sin sector" al final. */
export function agruparPorSector(equipos: Ascensor[]): GrupoSector[] {
  const sectores = new Map<string, Ascensor[]>()
  for (const e of equipos) {
    const sector = e.torre?.trim() || SIN_SECTOR
    const lista = sectores.get(sector)
    if (lista) lista.push(e)
    else sectores.set(sector, [e])
  }
  return [...sectores.entries()]
    .sort(([a], [b]) => {
      if (a === SIN_SECTOR) return 1
      if (b === SIN_SECTOR) return -1
      return compararNatural(a, b)
    })
    .map(([sector, lista]) => ({
      sector,
      total: lista.length,
      categorias: CATEGORIAS.map((categoria) => ({
        categoria,
        equipos: lista
          .filter((e) => categoriaDe(e) === categoria)
          .sort((a, b) => compararNatural(a.codigo, b.codigo)),
      })).filter((g) => g.equipos.length > 0),
    }))
}

export interface FiltroEquipos {
  texto?: string
  categoria?: CategoriaEquipo | null
  estado?: EstadoAscensor | null
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Búsqueda por código, QR, marca/modelo, sector o edificio (sin tildes). */
export function filtrarEquipos(
  equipos: Ascensor[],
  filtro: FiltroEquipos,
  nombreEdificio: (edificioId: string) => string = () => '',
): Ascensor[] {
  const q = normalizar(filtro.texto ?? '')
  return equipos.filter((e) => {
    if (filtro.categoria && categoriaDe(e) !== filtro.categoria) return false
    if (filtro.estado && e.estado !== filtro.estado) return false
    if (!q) return true
    const campos = [
      e.codigo,
      e.codigo_qr,
      e.marca,
      e.modelo,
      e.torre,
      e.numero,
      e.edificio?.nombre ?? nombreEdificio(e.edificio_id),
    ]
    return campos.some((c) => c && normalizar(c).includes(q))
  })
}

export function contarPor<K extends string>(
  equipos: Ascensor[],
  clave: (e: Ascensor) => K,
): Partial<Record<K, number>> {
  const res: Partial<Record<K, number>> = {}
  for (const e of equipos) {
    const k = clave(e)
    res[k] = (res[k] ?? 0) + 1
  }
  return res
}

export type EstadoCertificacion = 'sin_dato' | 'vigente' | 'proxima' | 'vencida'

/** Días de anticipación con que se avisa el vencimiento de la certificación. */
export const DIAS_AVISO_CERTIFICACION = 60

export function estadoCertificacion(
  vencimiento: string | null,
  hoyIso: string,
  diasAviso = DIAS_AVISO_CERTIFICACION,
): { estado: EstadoCertificacion; dias: number | null } {
  if (!vencimiento) return { estado: 'sin_dato', dias: null }
  const [a1, m1, d1] = vencimiento.slice(0, 10).split('-').map(Number)
  const [a2, m2, d2] = hoyIso.split('-').map(Number)
  const dias = Math.round((Date.UTC(a1, m1 - 1, d1) - Date.UTC(a2, m2 - 1, d2)) / 86_400_000)
  if (dias < 0) return { estado: 'vencida', dias }
  if (dias <= diasAviso) return { estado: 'proxima', dias }
  return { estado: 'vigente', dias }
}

/** Tipos de OT que siguen una pauta (checklist). Reparación/emergencia no. */
export const TIPOS_CON_PAUTA: TipoOrdenTrabajo[] = ['mantencion', 'inspeccion', 'primera_visita']

/**
 * Pauta sugerida para una OT: solo para tipos con checklist; prefiere la
 * pauta cuyo nombre menciona la categoría (montacarga/montaplatos) y luego la
 * que coincide con el tipo de equipo (electromecánico/hidráulico).
 */
export function sugerirPauta(
  pautas: Pauta[],
  tipo: TipoOrdenTrabajo,
  equipo: Pick<Ascensor, 'categoria' | 'tipo_equipo'> | null,
): Pauta | null {
  if (!TIPOS_CON_PAUTA.includes(tipo) || pautas.length === 0) return null
  if (!equipo) return null
  const categoria = categoriaDe(equipo)
  const puntaje = (p: Pauta): number => {
    const nombre = normalizar(p.nombre)
    let s = 0
    if (categoria !== 'ascensor' && nombre.includes(categoria.slice(0, 8))) s += 2
    if (categoria === 'ascensor' && !/montacarga|montaplato/.test(nombre)) s += 1
    if (p.tipo_equipo === equipo.tipo_equipo) s += 1
    return s
  }
  return [...pautas].sort((a, b) => puntaje(b) - puntaje(a))[0]
}
