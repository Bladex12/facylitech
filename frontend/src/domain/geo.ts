import type { Coordenadas } from '../api/types'

const RADIO_TIERRA_M = 6_371_000

/** Distancia en línea recta (Haversine), solo para mostrar "a X km" en el celular. */
export function distanciaM(a: Coordenadas, b: Coordenadas): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h))
}
