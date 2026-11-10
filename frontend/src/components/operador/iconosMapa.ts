import L from 'leaflet'
import type { EstadoDisponibilidadTecnico, MapaEdificio } from '../../api/types'
import { iniciales } from '../../domain/cercania'

/**
 * Colores de los marcadores Leaflet del operador. Los marcadores son HTML
 * fuera del árbol de React (divIcon) y las polilíneas son atributos SVG, que
 * no aceptan clases de Tailwind ni (en SVG) `var(--...)`: por eso se
 * centralizan aquí, alineados con el mockup (STATUS_ELV / estados de técnico).
 */
export const COLOR_MAPA = {
  navy: '#0D1B2A',
  acento: '#0284C7',
  critico: '#DC2626',
  advertencia: '#F59E0B',
  disponible: '#10B981',
  sinEstado: '#94A3B8',
} as const

export type EstadoEdificioMapa = 'emergencia' | 'falla' | 'normal'

export function estadoEdificio(e: Pick<MapaEdificio, 'emergencia_activa' | 'equipos_con_falla'>): EstadoEdificioMapa {
  if (e.emergencia_activa) return 'emergencia'
  if (e.equipos_con_falla > 0) return 'falla'
  return 'normal'
}

export const COLOR_EDIFICIO: Record<EstadoEdificioMapa, string> = {
  emergencia: COLOR_MAPA.critico,
  falla: COLOR_MAPA.advertencia,
  normal: COLOR_MAPA.navy,
}

export function colorTecnico(estado: EstadoDisponibilidadTecnico | null | undefined): string {
  if (estado === 'disponible') return COLOR_MAPA.disponible
  if (estado === 'en_terreno') return COLOR_MAPA.acento
  return COLOR_MAPA.sinEstado
}

/** Cuadrado redondeado con el nº de equipos (como el mockup). */
export function iconoEdificio(color: string, texto: string | number, seleccionado = false) {
  const t = 26
  const halo = seleccionado
    ? `<div style="position:absolute;inset:-9px;border-radius:10px;background:${color};opacity:.18"></div>`
    : ''
  return L.divIcon({
    className: '',
    iconSize: [t, t],
    iconAnchor: [t / 2, t / 2],
    popupAnchor: [0, -t / 2],
    html: `<div style="position:relative;width:${t}px;height:${t}px">${halo}<div style="position:relative;width:${t}px;height:${t}px;border-radius:5px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 11px Barlow,system-ui,sans-serif">${texto}</div></div>`,
  })
}

/** Círculo con iniciales; los disponibles llevan halo verde (mockup). */
export function iconoTecnico(
  nombre: string,
  estado: EstadoDisponibilidadTecnico | null | undefined,
  opciones: { seleccionado?: boolean; desactualizado?: boolean } = {},
) {
  const t = 28
  const color = colorTecnico(estado)
  const halo =
    estado === 'disponible' || opciones.seleccionado
      ? `<div style="position:absolute;inset:-7px;border-radius:9999px;background:${color};opacity:${opciones.seleccionado ? 0.3 : 0.16}"></div>`
      : ''
  return L.divIcon({
    className: '',
    iconSize: [t, t],
    iconAnchor: [t / 2, t / 2],
    popupAnchor: [0, -t / 2],
    html: `<div style="position:relative;width:${t}px;height:${t}px;opacity:${opciones.desactualizado ? 0.55 : 1}">${halo}<div style="position:relative;width:${t}px;height:${t}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 9px 'DM Mono',ui-monospace,monospace">${iniciales(nombre)}</div></div>`,
  })
}

/**
 * Marcador de emergencia: círculo rojo con rayo. Las activas (sin técnico)
 * llevan onda pulsante (animate-ping de Tailwind); las en atención, un anillo fijo.
 */
export function iconoEmergencia(opciones: { seleccionado?: boolean; pulsante?: boolean } = {}) {
  const t = 34
  const { seleccionado = false, pulsante = true } = opciones
  return L.divIcon({
    className: '',
    iconSize: [t, t],
    iconAnchor: [t / 2, t / 2],
    popupAnchor: [0, -t / 2],
    html: `<div style="position:relative;width:${t}px;height:${t}px;display:flex;align-items:center;justify-content:center">
      ${
        pulsante
          ? `<span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:${COLOR_MAPA.critico};opacity:.45"></span>`
          : `<span style="position:absolute;inset:2px;border-radius:9999px;background:${COLOR_MAPA.critico};opacity:.18"></span>`
      }
      ${seleccionado ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid ${COLOR_MAPA.critico}"></span>` : ''}
      <span style="position:relative;width:24px;height:24px;border-radius:9999px;background:${COLOR_MAPA.critico};border:2px solid #fff;box-shadow:0 1px 6px rgba(220,38,38,.6);display:flex;align-items:center;justify-content:center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </span>
    </div>`,
  })
}
