import L from 'leaflet'
import type { Coordenadas } from '../../api/types'

/** Centro por defecto: Santiago (Plaza de Armas). */
export const CENTRO_SANTIAGO: Coordenadas = { lat: -33.4378, lon: -70.6505 }

/**
 * Marcador circular con color de marca, sin depender de las imágenes PNG por
 * defecto de Leaflet (que se rompen con Vite). `icono` es SVG/emoji opcional.
 */
export function iconoPunto(color: string, opciones: { tamano?: number; borde?: string; html?: string } = {}) {
  const tamano = opciones.tamano ?? 18
  return L.divIcon({
    className: '',
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
    popupAnchor: [0, -tamano / 2],
    html: `<div style="width:${tamano}px;height:${tamano}px;border-radius:9999px;background:${color};border:2px solid ${opciones.borde ?? '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(tamano * 0.55)}px;font-weight:700">${opciones.html ?? ''}</div>`,
  })
}

/** Links externos de navegación (el técnico usa Waze/Google Maps del celular). */
export function linksNavegacion(c: Coordenadas) {
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`,
    waze: `https://waze.com/ul?ll=${c.lat},${c.lon}&navigate=yes`,
  }
}
