import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { Circle, Marker, Polyline, useMap } from 'react-leaflet'
import { ChevronRight, Crosshair, LocateOff, MapPin, Navigation } from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import type { Coordenadas, OrdenTrabajo } from '../../api/types'
import { ErrorCarga } from '../../components/EstadosCarga'
import { BotonPantallaCompleta, usePantallaCompleta } from '../../components/mapa/PantallaCompleta'
import { MapaBase } from '../../components/mapa/MapaBase'
import { iconoPunto, linksNavegacion } from '../../components/mapa/mapaUtils'
import { agruparPorDia, esPendiente, paradasDelDia } from '../../domain/agrupacion'
import { distanciaM } from '../../domain/geo'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_HEX, SEMAFORO_LABEL } from '../../domain/semaforo'
import { diaLocal, formatoDistancia } from '../../domain/tiempo'
import { TIPO_ORDEN_LABEL } from './etiquetas'
import { useMisOrdenes } from './hooks'
import { useMiPosicion } from './useMiPosicion'

type Vista = 'hoy' | 'proximas'

/** Mueve el mapa cuando cambia `objetivo` (centrar en mí / en la parada elegida). */
function Volar({ objetivo }: { objetivo: { c: Coordenadas; n: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (objetivo) map.flyTo([objetivo.c.lat, objetivo.c.lon], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [objetivo, map])
  return null
}

/** Encuadra paradas + mi posición dejando libre la zona de los controles y la tarjeta inferior. */
function Encuadrar({ puntos }: { puntos: Coordenadas[] }) {
  const map = useMap()
  const clave = puntos.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|')
  useEffect(() => {
    if (puntos.length === 0) return
    if (puntos.length === 1) {
      map.setView([puntos[0].lat, puntos[0].lon], 15, { animate: false })
      return
    }
    map.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lon])), {
      paddingTopLeft: [36, 90],
      paddingBottomRight: [36, 250],
      maxZoom: 16,
      animate: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map])
  return null
}

export function Mapa() {
  const { data, isLoading, isError, error, refetch } = useMisOrdenes()
  const { posicion, estado: estadoGps } = useMiPosicion()
  const [vistaElegida, setVista] = useState<Vista | null>(null)
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const [objetivo, setObjetivo] = useState<{ c: Coordenadas; n: number } | null>(null)
  const pantalla = usePantallaCompleta()

  const { hoy, proximas } = useMemo(() => {
    const items = data?.items ?? []
    const hoyIso = diaLocal(new Date())
    return {
      hoy: paradasDelDia(items, hoyIso),
      proximas: agruparPorDia(
        items.filter((o) => esPendiente(o) && diaLocal(o.fecha_programada) > hoyIso),
        new Date(),
      )
        .flatMap((g) => g.items)
        .slice(0, 15),
    }
  }, [data])
  // Si hoy no hay visitas, abre directo en Próximas.
  const vista: Vista = vistaElegida ?? (hoy.length === 0 && proximas.length > 0 ? 'proximas' : 'hoy')
  const paradas = vista === 'hoy' ? hoy : proximas

  // OrdenTrabajo trae el edificio sin coordenadas: se piden los edificios involucrados (cacheados).
  const edificioIds = useMemo(
    () => [...new Set([...hoy, ...proximas].map((o) => o.ascensor.edificio.id))],
    [hoy, proximas],
  )
  const edificios = useQueries({
    queries: edificioIds.map((id) => ({
      queryKey: ['edificio', id],
      queryFn: () => endpoints.edificios.obtener(id),
      staleTime: 10 * 60_000,
    })),
  })
  const coordsPorEdificio = new Map<string, Coordenadas>()
  edificios.forEach((q) => {
    if (q.data) coordsPorEdificio.set(q.data.id, q.data.ubicacion)
  })

  const conCoords = paradas
    .map((o, i) => ({ orden: o, numero: i + 1, c: coordsPorEdificio.get(o.ascensor.edificio.id) }))
    .filter((p): p is { orden: OrdenTrabajo; numero: number; c: Coordenadas } => !!p.c)

  // Varias OTs en el mismo edificio → un solo marcador con el primer número.
  const marcadores = new Map<string, { numeros: number[]; c: Coordenadas; orden: OrdenTrabajo }>()
  for (const p of conCoords) {
    const k = p.orden.ascensor.edificio.id
    const m = marcadores.get(k)
    if (m) m.numeros.push(p.numero)
    else marcadores.set(k, { numeros: [p.numero], c: p.c, orden: p.orden })
  }

  const seleccion =
    conCoords.find((p) => p.orden.id === seleccionId) ?? conCoords[0] ?? null
  const ruta: [number, number][] = [
    ...(posicion ? [[posicion.lat, posicion.lon] as [number, number]] : []),
    ...[...marcadores.values()].map((m) => [m.c.lat, m.c.lon] as [number, number]),
  ]

  function elegir(o: OrdenTrabajo, c: Coordenadas) {
    setSeleccionId(o.id)
    setObjetivo((prev) => ({ c, n: (prev?.n ?? 0) + 1 }))
  }

  if (isError && !data)
    return (
      <div className="p-4">
        <ErrorCarga error={error} onReintentar={() => refetch()} />
      </div>
    )

  const links = seleccion ? linksNavegacion(seleccion.c) : null
  const distancia = seleccion && posicion ? distanciaM(posicion, seleccion.c) : null

  return (
    <div ref={pantalla.ref} className={`relative h-full min-h-[420px] ${pantalla.claseCss}`}>
      <MapaBase className="absolute inset-0 z-0 [&_.leaflet-control-zoom]:hidden">
        <Encuadrar
          puntos={[
            ...[...marcadores.values()].map((m) => m.c),
            // posición redondeada (~1 km) para no re-encuadrar con cada lectura del GPS
            ...(posicion ? [{ lat: +posicion.lat.toFixed(2), lon: +posicion.lon.toFixed(2) }] : []),
          ]}
        />
        <Volar objetivo={objetivo} />
        {ruta.length > 1 && (
          <Polyline positions={ruta} pathOptions={{ color: '#0d1b2a', weight: 3, opacity: 0.55, dashArray: '6 8' }} />
        )}
        {posicion && (
          <>
            {posicion.precision < 1500 && (
              <Circle
                center={[posicion.lat, posicion.lon]}
                radius={posicion.precision}
                pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }}
              />
            )}
            <Marker
              position={[posicion.lat, posicion.lon]}
              icon={iconoPunto('#2563eb', { tamano: 18, borde: '#fff' })}
              zIndexOffset={1000}
            />
          </>
        )}
        {[...marcadores.entries()].map(([k, m]) => {
          const activo = seleccion?.orden.ascensor.edificio.id === k
          return (
            <Marker
              key={`${k}-${activo}-${m.numeros.join(',')}`}
              position={[m.c.lat, m.c.lon]}
              icon={iconoPunto(SEMAFORO_HEX[m.orden.semaforo], {
                tamano: activo ? 34 : 28,
                borde: activo ? '#0d1b2a' : '#fff',
                html: m.numeros.length > 1 ? `${m.numeros[0]}<sup style="font-size:9px">+</sup>` : String(m.numeros[0]),
              })}
              zIndexOffset={activo ? 500 : 0}
              eventHandlers={{ click: () => elegir(m.orden, m.c) }}
            />
          )
        })}
      </MapaBase>

      {/* Controles superiores */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex items-start justify-between gap-2">
        <div className="pointer-events-auto grid grid-cols-2 rounded-lg border border-[var(--color-border)] bg-white p-1 shadow-md">
          {(['hoy', 'proximas'] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setVista(v)
                setSeleccionId(null)
              }}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                vista === v ? 'bg-[var(--color-navy)] text-white' : 'text-[var(--color-text-muted)]'
              }`}
            >
              {v === 'hoy' ? 'Hoy' : 'Próximas'}{' '}
              <span className="font-mono-brand font-normal opacity-70">
                {v === 'hoy' ? hoy.length : proximas.length}
              </span>
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex gap-2">
        <BotonPantallaCompleta activa={pantalla.activa} onClick={pantalla.alternar} />
        <button
          onClick={() => posicion && setObjetivo((prev) => ({ c: posicion, n: (prev?.n ?? 0) + 1 }))}
          disabled={!posicion}
          aria-label="Centrar en mi posición"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-navy)] shadow-md disabled:text-slate-300"
        >
          {estadoGps === 'denegado' || estadoGps === 'no_disponible' ? <LocateOff size={18} /> : <Crosshair size={18} />}
        </button>
        </div>
      </div>

      {(estadoGps === 'denegado' || estadoGps === 'no_disponible' || estadoGps === 'error') && (
        <div className="absolute inset-x-3 top-[60px] z-[1000] rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-800 shadow">
          {estadoGps === 'denegado'
            ? 'Ubicación bloqueada: actívala para este sitio en los ajustes del navegador para ver dónde estás y la distancia a cada edificio.'
            : estadoGps === 'no_disponible'
              ? 'Este navegador no permite obtener tu ubicación.'
              : 'No se pudo obtener tu ubicación. Revisa que el GPS esté encendido.'}
        </div>
      )}

      {/* Tarjeta inferior */}
      <div className="absolute inset-x-3 bottom-3 z-[1000] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-xl">
        {isLoading ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">Cargando tus trabajos…</p>
        ) : paradas.length === 0 ? (
          <div className="flex items-center gap-3 p-4">
            <MapPin size={22} className="flex-shrink-0 text-slate-300" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {vista === 'hoy' ? 'Sin visitas pendientes hoy' : 'Sin visitas próximas'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {vista === 'hoy' ? 'Revisa la pestaña Próximas.' : 'No tienes órdenes programadas.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 overflow-x-auto border-b border-[var(--color-bg-subtle)] px-3 py-2 [scrollbar-width:none]">
              {conCoords.map((p) => (
                <button
                  key={p.orden.id}
                  onClick={() => elegir(p.orden, p.c)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs ${
                    seleccion?.orden.id === p.orden.id
                      ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                  }`}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full font-mono-brand text-[10px] font-bold text-white"
                    style={{ background: SEMAFORO_HEX[p.orden.semaforo] }}
                  >
                    {p.numero}
                  </span>
                  {new Date(p.orden.fecha_programada).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
                </button>
              ))}
            </div>
            {seleccion && links && (
              <div className="p-3.5">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono-brand text-xs font-semibold text-[var(--color-accent)]">
                    {seleccion.orden.codigo}
                  </span>
                  <span className={`rounded px-2 py-0.5 font-mono-brand text-[10px] ${SEMAFORO_BADGE_CLASS[seleccion.orden.semaforo]}`}>
                    {SEMAFORO_LABEL[seleccion.orden.semaforo]}
                  </span>
                  {distancia != null && (
                    <span className="ml-auto font-mono-brand text-xs text-[var(--color-text-muted)]">
                      a {formatoDistancia(distancia)}
                    </span>
                  )}
                </div>
                <p className="truncate font-semibold text-[var(--color-text)]">
                  {TIPO_ORDEN_LABEL[seleccion.orden.tipo]} — {seleccion.orden.ascensor.codigo}
                </p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">
                  {seleccion.orden.ascensor.edificio.nombre} · {seleccion.orden.ascensor.edificio.direccion}
                </p>
                <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <a
                    href={links.googleMaps}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded bg-[var(--color-accent)] py-2.5 text-xs font-semibold text-white active:bg-[var(--color-accent-hover)]"
                  >
                    <Navigation size={13} /> Google Maps
                  </a>
                  <a
                    href={links.waze}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded border border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-text)] active:bg-[var(--color-bg)]"
                  >
                    <Navigation size={13} /> Waze
                  </a>
                  <Link
                    to={`/tecnico/ordenes/${seleccion.orden.id}`}
                    className="flex items-center justify-center gap-0.5 rounded bg-[var(--color-navy)] px-3 py-2.5 text-xs font-semibold text-white"
                  >
                    Ver orden <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            )}
            {conCoords.length === 0 && (
              <p className="p-4 text-sm text-[var(--color-text-muted)]">Ubicando edificios…</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
