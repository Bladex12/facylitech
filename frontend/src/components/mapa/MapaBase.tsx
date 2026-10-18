import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import type { Coordenadas } from '../../api/types'
import { CENTRO_SANTIAGO } from './mapaUtils'

function AjustarVista({ puntos }: { puntos: Coordenadas[] }) {
  const map = useMap()
  const clave = puntos.map((p) => `${p.lat},${p.lon}`).join('|')
  useEffect(() => {
    if (puntos.length === 0) return
    if (puntos.length === 1) {
      map.setView([puntos[0].lat, puntos[0].lon], 15)
      return
    }
    map.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lon])), { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map])
  return null
}

/**
 * Mapa base Leaflet + OpenStreetMap compartido por operador y técnico.
 * Los hijos son <Marker>, <Circle>, <Polyline>, etc. de react-leaflet.
 * `ajustarA` encuadra el mapa a esos puntos cuando cambian.
 */
export function MapaBase({
  children,
  ajustarA = [],
  centro = CENTRO_SANTIAGO,
  zoom = 11,
  className = 'h-full w-full',
}: {
  children?: ReactNode
  ajustarA?: Coordenadas[]
  centro?: Coordenadas
  zoom?: number
  className?: string
}) {
  return (
    <MapContainer center={[centro.lat, centro.lon]} zoom={zoom} className={className} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AjustarVista puntos={ajustarA} />
      {children}
    </MapContainer>
  )
}
