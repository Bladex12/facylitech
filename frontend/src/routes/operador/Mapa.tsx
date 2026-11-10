import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Marker, Polyline, Popup, useMap } from 'react-leaflet'
import { BotonPantallaCompleta, usePantallaCompleta } from '../../components/mapa/PantallaCompleta'
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  HardHat,
  MapPin,
  Navigation,
  RefreshCw,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import type {
  CandidatoTecnico,
  Coordenadas,
  MapaData,
  MapaEdificio,
  MapaEmergencia,
  MapaTecnico,
} from '../../api/types'
import { MapaBase } from '../../components/mapa/MapaBase'
import { Avatar } from '../../components/operador/Avatar'
import { Cargando, ErrorConsulta, Vacio } from '../../components/operador/EstadoConsulta'
import {
  COLOR_EDIFICIO,
  COLOR_MAPA,
  estadoEdificio,
  iconoEdificio,
  iconoEmergencia,
  iconoTecnico,
} from '../../components/operador/iconosMapa'
import { ListaCercanos } from '../../components/operador/ListaCercanos'
import { useAhora } from '../../components/operador/useAhora'
import { EMERGENCIA_COLOR_CLASS, EMERGENCIA_LABEL, ESTADO_EMERGENCIA } from '../../domain/emergencias'
import {
  claveDisponibilidad,
  DISPONIBILIDAD,
  ubicacionDesactualizada,
} from '../../domain/equipoTecnico'
import { tiempoTranscurrido } from '../../domain/tiempoRelativo'

type Capa = 'edificios' | 'tecnicos' | 'emergencias'
type Seleccion = { tipo: 'edificio' | 'tecnico' | 'emergencia'; id: string } | null

const CAPAS: { clave: Capa; label: string; icono: typeof Building2 }[] = [
  { clave: 'emergencias', label: 'Emergencias', icono: Zap },
  { clave: 'edificios', label: 'Edificios', icono: Building2 },
  { clave: 'tecnicos', label: 'Técnicos', icono: HardHat },
]

const ESTADO_EDIFICIO_LABEL = {
  emergencia: { label: 'Emergencia activa', cls: 'bg-red-50 text-red-700' },
  falla: { label: 'Equipos con falla', cls: 'bg-amber-50 text-amber-700' },
  normal: { label: 'Operacional', cls: 'bg-green-50 text-green-700' },
} as const

/**
 * Centra el mapa en la selección. Si hay varios puntos (edificio/emergencia +
 * técnicos cercanos) encuadra todos, para ver las líneas completas.
 */
function Enfocar({ destino }: { destino: { puntos: Coordenadas[]; n: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!destino || destino.puntos.length === 0) return
    if (destino.puntos.length === 1) {
      const [p] = destino.puntos
      map.flyTo([p!.lat, p!.lon], Math.max(map.getZoom(), 14), { duration: 0.6 })
    } else {
      map.flyToBounds(
        destino.puntos.map((p) => [p.lat, p.lon] as [number, number]),
        { padding: [50, 50], maxZoom: 15, duration: 0.6 },
      )
    }
  }, [destino, map])
  return null
}

export function Mapa() {
  const ahora = useAhora(30_000)
  const [capas, setCapas] = useState<Record<Capa, boolean>>({
    edificios: true,
    tecnicos: true,
    emergencias: true,
  })
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [enfoque, setEnfoque] = useState<{ puntos: Coordenadas[]; n: number } | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const pantalla = usePantallaCompleta()
  const [resaltado, setResaltado] = useState<string | null>(null)

  const mapa = useQuery({
    queryKey: ['mapa'],
    queryFn: endpoints.mapa.obtener,
    refetchInterval: 30_000,
    retry: 1,
  })
  const datos: MapaData = mapa.data ?? { edificios: [], tecnicos: [], emergencias: [] }

  const edificioSel =
    seleccion?.tipo === 'edificio' ? datos.edificios.find((e) => e.id === seleccion.id) : undefined
  const tecnicoSel =
    seleccion?.tipo === 'tecnico' ? datos.tecnicos.find((t) => t.id === seleccion.id) : undefined
  const emergenciaSel =
    seleccion?.tipo === 'emergencia'
      ? datos.emergencias.find((e) => e.id === seleccion.id)
      : undefined

  const cercanosEdificio = useQuery({
    queryKey: ['tecnicos', 'cercanos', edificioSel?.ubicacion.lat, edificioSel?.ubicacion.lon],
    queryFn: () => endpoints.tecnicos.cercanos(edificioSel!.ubicacion, 5),
    enabled: !!edificioSel,
    refetchInterval: 30_000,
    retry: 1,
  })
  const candidatosEmergencia = useQuery({
    queryKey: ['emergencias', emergenciaSel?.id, 'candidatos'],
    queryFn: () => endpoints.emergencias.candidatos(emergenciaSel!.id, 5),
    enabled: !!emergenciaSel,
    refetchInterval: 30_000,
    retry: 1,
  })
  const cercanos = edificioSel ? cercanosEdificio : emergenciaSel ? candidatosEmergencia : null
  const origen = edificioSel?.ubicacion ?? emergenciaSel?.ubicacion ?? null

  // Encuadre inicial: solo edificios (no salta cuando los técnicos se mueven).
  const encuadre = useMemo(
    () => datos.edificios.map((e) => e.ubicacion),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos.edificios.map((e) => e.id).join('|')],
  )

  function seleccionar(s: Seleccion, coords?: Coordenadas | null) {
    setSeleccion(s)
    setResaltado(null)
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    if (coords) setEnfoque((prev) => ({ puntos: [coords], n: (prev?.n ?? 0) + 1 }))
  }

  // Al llegar el ranking de cercanía, encuadrar origen + técnicos.
  const claveCercanos = cercanos?.data?.map((c) => c.tecnico.id).join('|')
  useEffect(() => {
    if (!origen || !cercanos?.data) return
    const puntos = [
      origen,
      ...cercanos.data.flatMap((c) => (c.tecnico.ultima_ubicacion ? [c.tecnico.ultima_ubicacion] : [])),
    ]
    setEnfoque((prev) => ({ puntos, n: (prev?.n ?? 0) + 1 }))
    // Solo cuando cambia la selección o el conjunto de técnicos, no en cada refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion?.id, claveCercanos])

  const edificiosConEmergencia = new Set(datos.emergencias.map((e) => e.edificio_id))
  const tecnicosConUbicacion = datos.tecnicos.filter((t) => t.ubicacion)
  const totalEquipos = datos.edificios.reduce((a, e) => a + e.total_equipos, 0)
  const conFalla = datos.edificios.reduce((a, e) => a + e.equipos_con_falla, 0)

  return (
    <div className="flex h-full flex-col gap-4 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Mapa</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Posición de edificios, técnicos y emergencias en tiempo real
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CAPAS.map(({ clave, label, icono: Icono }) => {
            const n =
              clave === 'edificios'
                ? datos.edificios.length
                : clave === 'tecnicos'
                  ? datos.tecnicos.length
                  : datos.emergencias.length
            return (
              <button
                key={clave}
                onClick={() => setCapas((c) => ({ ...c, [clave]: !c[clave] }))}
                aria-pressed={capas[clave]}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-all ${
                  capas[clave]
                    ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                    : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-slate-400'
                }`}
              >
                <Icono size={11} /> {label}
                <span className={capas[clave] ? 'text-white/60' : 'text-slate-400'}>{n}</span>
              </button>
            )
          })}
          <span
            className="ml-1 flex items-center gap-1 font-mono text-[10px] text-[var(--color-text-muted)]"
            title="Se actualiza cada 30 s"
          >
            <RefreshCw size={10} className={mapa.isFetching ? 'animate-spin' : ''} />
            {mapa.dataUpdatedAt
              ? new Date(mapa.dataUpdatedAt).toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })
              : '—'}
          </span>
        </div>
      </div>

      {mapa.isError && !mapa.data && (
        <ErrorConsulta
          error={mapa.error}
          titulo="No se pudo cargar el mapa"
          onReintentar={() => mapa.refetch()}
        />
      )}

      <div className="flex min-h-[520px] flex-1 flex-col gap-4 lg:flex-row">
        {/* Mapa */}
        <div
          ref={pantalla.ref}
          className={`relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white ${pantalla.claseCss}`}
        >
          <MapaBase ajustarA={encuadre}>
            <Enfocar destino={enfoque} />

            {capas.edificios &&
              datos.edificios.map((e) => {
                const estado = estadoEdificio(e)
                return (
                  <Marker
                    key={e.id}
                    position={[e.ubicacion.lat, e.ubicacion.lon]}
                    icon={iconoEdificio(
                      COLOR_EDIFICIO[estado],
                      e.total_equipos,
                      seleccion?.id === e.id,
                    )}
                    eventHandlers={{ click: () => seleccionar({ tipo: 'edificio', id: e.id }) }}
                  >
                    <Popup>
                      <PopupEdificio edificio={e} />
                    </Popup>
                  </Marker>
                )
              })}

            {capas.tecnicos &&
              tecnicosConUbicacion.map((t) => (
                <Marker
                  key={t.id}
                  position={[t.ubicacion!.lat, t.ubicacion!.lon]}
                  zIndexOffset={500}
                  icon={iconoTecnico(t.nombre, t.estado_disponibilidad, {
                    seleccionado: seleccion?.id === t.id || resaltado === t.id,
                    desactualizado: ubicacionDesactualizada(t.ubicacion_at, ahora),
                  })}
                  eventHandlers={{ click: () => seleccionar({ tipo: 'tecnico', id: t.id }) }}
                >
                  <Popup>
                    <PopupTecnico tecnico={t} ahora={ahora} />
                  </Popup>
                </Marker>
              ))}

            {capas.emergencias &&
              datos.emergencias.map((em) => (
                <Marker
                  key={em.id}
                  position={[em.ubicacion.lat, em.ubicacion.lon]}
                  zIndexOffset={1000}
                  icon={iconoEmergencia({
                    seleccionado: seleccion?.id === em.id,
                    pulsante: em.estado === 'activa',
                  })}
                  eventHandlers={{ click: () => seleccionar({ tipo: 'emergencia', id: em.id }) }}
                >
                  <Popup>
                    <PopupEmergencia emergencia={em} ahora={ahora} />
                  </Popup>
                </Marker>
              ))}

            {origen &&
              cercanos?.data
                ?.filter((c) => c.tecnico.ultima_ubicacion)
                .map((c, idx) => {
                  const destacado = resaltado ? resaltado === c.tecnico.id : idx === 0
                  return (
                    <Polyline
                      key={c.tecnico.id}
                      positions={[
                        [origen.lat, origen.lon],
                        [c.tecnico.ultima_ubicacion!.lat, c.tecnico.ultima_ubicacion!.lon],
                      ]}
                      pathOptions={{
                        color: destacado ? COLOR_MAPA.acento : COLOR_MAPA.navy,
                        weight: destacado ? 3 : 1.5,
                        opacity: destacado ? 0.9 : 0.35,
                        dashArray: destacado ? undefined : '4 6',
                      }}
                    />
                  )
                })}
          </MapaBase>

          {mapa.isLoading && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/60">
              <Cargando texto="Cargando mapa…" className="rounded-lg border border-[var(--color-border)] bg-white" />
            </div>
          )}

          <BotonPantallaCompleta
            activa={pantalla.activa}
            onClick={pantalla.alternar}
            className="absolute top-3 right-3 z-[1000]"
          />

          {pantalla.activa && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-[1000] -translate-x-1/2">
              {datos.emergencias.length > 0 ? (
                <div
                  role="alert"
                  className="flex animate-pulse items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg"
                >
                  <Zap size={16} />
                  {datos.emergencias.length === 1
                    ? '1 emergencia activa'
                    : `${datos.emergencias.length} emergencias activas`}
                  <span className="font-normal opacity-90">
                    · {datos.emergencias.map((e) => e.edificio_nombre).join(', ')}
                  </span>
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--color-border)] bg-white/95 px-3 py-1.5 text-xs text-[var(--color-text-muted)] shadow">
                  Sin emergencias activas · actualizado{' '}
                  {mapa.dataUpdatedAt
                    ? new Date(mapa.dataUpdatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
                    : '—'}
                </div>
              )}
            </div>
          )}

          <Leyenda />
        </div>

        {/* Panel lateral */}
        <aside ref={panelRef} className="flex w-full flex-shrink-0 flex-col gap-3 overflow-y-auto lg:w-80">
          {edificioSel && (
            <TarjetaEdificio
              edificio={edificioSel}
              tieneEmergencia={edificiosConEmergencia.has(edificioSel.id)}
              onCerrar={() => setSeleccion(null)}
            />
          )}
          {tecnicoSel && (
            <TarjetaTecnico tecnico={tecnicoSel} ahora={ahora} onCerrar={() => setSeleccion(null)} />
          )}
          {emergenciaSel && (
            <TarjetaEmergencia
              emergencia={emergenciaSel}
              ahora={ahora}
              onCerrar={() => setSeleccion(null)}
            />
          )}
          {!seleccion && (
            <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 text-sm text-[var(--color-text-muted)]">
              Haz clic en un edificio, técnico o emergencia para ver detalles y los técnicos más
              cercanos.
            </div>
          )}

          {cercanos && (
            <PanelCercanos
              consulta={cercanos}
              esEmergencia={!!emergenciaSel}
              resaltado={resaltado}
              onResaltar={setResaltado}
            />
          )}

          <ListaCapas
            datos={datos}
            capas={capas}
            seleccionId={seleccion?.id ?? null}
            ahora={ahora}
            onSeleccionar={seleccionar}
          />

          <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <div className="mb-3 font-mono text-xs tracking-widest text-[var(--color-text-muted)] uppercase">
              Resumen
            </div>
            <div className="space-y-2 text-sm">
              <FilaResumen label="Edificios" valor={datos.edificios.length} />
              <FilaResumen label="Equipos" valor={totalEquipos} />
              <FilaResumen
                label="Técnicos disponibles"
                valor={datos.tecnicos.filter((t) => t.estado_disponibilidad === 'disponible').length}
              />
              <FilaResumen
                label="Técnicos en terreno"
                valor={datos.tecnicos.filter((t) => t.estado_disponibilidad === 'en_terreno').length}
              />
              <FilaResumen label="Equipos con falla" valor={conFalla} cls="text-amber-600" />
              <FilaResumen
                label="Emergencias abiertas"
                valor={datos.emergencias.length}
                cls="text-red-600"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function FilaResumen({ label, valor, cls }: { label: string; valor: number; cls?: string }) {
  return (
    <div className="flex justify-between">
      <span className={cls && valor > 0 ? cls : 'text-[var(--color-text-muted)]'}>{label}</span>
      <span className={`font-semibold ${cls && valor > 0 ? cls : 'text-[var(--color-text)]'}`}>
        {valor}
      </span>
    </div>
  )
}

function Leyenda() {
  return (
    <div className="absolute bottom-3 left-3 z-[1000] space-y-1 rounded border border-[var(--color-border)] bg-white/95 p-2.5 text-xs shadow-sm">
      <div className="mb-1 font-mono text-[9px] tracking-widest text-[var(--color-text-muted)] uppercase">
        Leyenda
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-green-500" /> Técnico disponible
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-[var(--color-accent)]" /> Técnico en terreno
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-[var(--color-navy)]" /> Edificio operacional
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-amber-500" /> Equipos con falla
      </div>
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
        </span>
        Emergencia
      </div>
    </div>
  )
}

// ─── Popups (dentro del mapa) ────────────────────────────────────────────────

const POPUP_CLS = 'min-w-[200px] font-[Barlow,system-ui,sans-serif] text-[var(--color-text)]'

function PopupEdificio({ edificio: e }: { edificio: MapaEdificio }) {
  const estado = estadoEdificio(e)
  return (
    <div className={POPUP_CLS}>
      <div className="text-sm font-semibold">{e.nombre}</div>
      <div className="text-xs text-[var(--color-text-muted)]">
        {e.direccion}, {e.comuna}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 border-t border-[var(--color-bg-subtle)] pt-2 text-center">
        <div>
          <div className="text-base font-bold">{e.total_equipos}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Equipos</div>
        </div>
        <div>
          <div className={`text-base font-bold ${e.equipos_con_falla > 0 ? 'text-amber-600' : ''}`}>
            {e.equipos_con_falla}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Con falla</div>
        </div>
        <div>
          <div className="text-base font-bold text-blue-600">{e.ordenes_hoy}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">OTs hoy</div>
        </div>
      </div>
      <span
        className={`mt-2 inline-block rounded px-2 py-0.5 font-mono text-[10px] ${ESTADO_EDIFICIO_LABEL[estado].cls}`}
      >
        {ESTADO_EDIFICIO_LABEL[estado].label}
      </span>
    </div>
  )
}

function PopupTecnico({ tecnico: t, ahora }: { tecnico: MapaTecnico; ahora: Date }) {
  const disp = DISPONIBILIDAD[claveDisponibilidad(t.estado_disponibilidad)]
  const viejo = ubicacionDesactualizada(t.ubicacion_at, ahora)
  return (
    <div className={POPUP_CLS}>
      <div className="flex items-center gap-2">
        <Avatar nombre={t.nombre} tamano="sm" />
        <div>
          <div className="text-sm font-semibold">{t.nombre}</div>
          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${disp.cls}`}>{disp.label}</span>
        </div>
      </div>
      <div className="mt-2 space-y-1 border-t border-[var(--color-bg-subtle)] pt-2 text-xs">
        {t.orden_actual ? (
          <div>
            <span className="text-[var(--color-text-muted)]">En curso: </span>
            <span className="font-mono-brand font-semibold text-[var(--color-accent)]">
              {t.orden_actual.codigo}
            </span>{' '}
            · {t.orden_actual.edificio_nombre}
          </div>
        ) : (
          <div className="text-[var(--color-text-muted)]">Sin orden en curso</div>
        )}
        <div className={`flex items-center gap-1 ${viejo ? 'text-amber-700' : 'text-[var(--color-text-muted)]'}`}>
          <Clock size={10} /> Ubicación {tiempoTranscurrido(t.ubicacion_at, ahora)}
        </div>
      </div>
    </div>
  )
}

function PopupEmergencia({ emergencia: em, ahora }: { emergencia: MapaEmergencia; ahora: Date }) {
  return (
    <div className={POPUP_CLS}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${EMERGENCIA_COLOR_CLASS[em.tipo]}`}>
          {EMERGENCIA_LABEL[em.tipo]}
        </span>
        <span className="font-mono-brand text-[10px] text-[var(--color-text-muted)]">{em.codigo}</span>
      </div>
      <div className="text-sm font-semibold">{em.edificio_nombre}</div>
      <div className="text-xs text-[var(--color-text-muted)]">
        {ESTADO_EMERGENCIA[em.estado].label.toLowerCase()} · {tiempoTranscurrido(em.reportada_at, ahora)}
      </div>
      <Link
        to={`/operador/emergencias?id=${em.id}`}
        className="mt-2 flex items-center justify-center gap-1 rounded bg-[var(--color-accent)] px-2 py-1.5 text-xs font-semibold !text-white hover:bg-[var(--color-accent-hover)]"
      >
        Gestionar despacho <ChevronRight size={12} />
      </Link>
    </div>
  )
}

// ─── Panel lateral ───────────────────────────────────────────────────────────

function BotonCerrar({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Cerrar detalle" className="rounded p-0.5 hover:bg-[var(--color-bg-subtle)]">
      <X size={14} className="text-[var(--color-text-muted)]" />
    </button>
  )
}

function TarjetaEdificio({
  edificio: e,
  tieneEmergencia,
  onCerrar,
}: {
  edificio: MapaEdificio
  tieneEmergencia: boolean
  onCerrar: () => void
}) {
  const estado = estadoEdificio(e)
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${tieneEmergencia ? 'border-red-200' : 'border-[var(--color-border)]'}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--color-text)]">{e.nombre}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {e.direccion}, {e.comuna}
          </div>
        </div>
        <BotonCerrar onClick={onCerrar} />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-xs text-[var(--color-text-muted)] capitalize">{e.tipo}</span>
        <span className={`rounded px-2 py-0.5 font-mono text-[10px] ${ESTADO_EDIFICIO_LABEL[estado].cls}`}>
          {ESTADO_EDIFICIO_LABEL[estado].label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-[var(--color-bg-subtle)] pt-3 text-center">
        <div>
          <div className="text-xl font-bold text-[var(--color-navy)]">{e.total_equipos}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Equipos</div>
        </div>
        <div>
          <div className={`text-xl font-bold ${e.equipos_con_falla > 0 ? 'text-amber-600' : 'text-[var(--color-navy)]'}`}>
            {e.equipos_con_falla}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Con falla</div>
        </div>
        <div>
          <div className="text-xl font-bold text-blue-600">{e.ordenes_hoy}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">OTs hoy</div>
        </div>
      </div>
    </div>
  )
}

function TarjetaTecnico({
  tecnico: t,
  ahora,
  onCerrar,
}: {
  tecnico: MapaTecnico
  ahora: Date
  onCerrar: () => void
}) {
  const disp = DISPONIBILIDAD[claveDisponibilidad(t.estado_disponibilidad)]
  const viejo = ubicacionDesactualizada(t.ubicacion_at, ahora)
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Avatar nombre={t.nombre} />
          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">{t.nombre}</div>
            <span className={`inline-flex rounded px-2 py-0.5 font-mono text-xs ${disp.cls}`}>{disp.label}</span>
          </div>
        </div>
        <BotonCerrar onClick={onCerrar} />
      </div>
      <div className="space-y-1.5 border-t border-[var(--color-bg-subtle)] pt-3 text-xs">
        {t.orden_actual ? (
          <div className="text-slate-700">
            En curso:{' '}
            <span className="font-mono-brand font-semibold text-[var(--color-accent)]">
              {t.orden_actual.codigo}
            </span>{' '}
            · {t.orden_actual.edificio_nombre}
          </div>
        ) : (
          <div className="text-[var(--color-text-muted)]">Sin orden en curso</div>
        )}
        <div className={`flex items-center gap-1 ${viejo ? 'text-amber-700' : 'text-[var(--color-text-muted)]'}`}>
          <MapPin size={11} />
          {t.ubicacion ? `Ubicación ${tiempoTranscurrido(t.ubicacion_at, ahora)}` : 'Sin ubicación reportada'}
          {t.ubicacion && viejo && <span className="font-mono text-[10px]">(desactualizada)</span>}
        </div>
      </div>
      <Link
        to={`/operador/tecnicos?id=${t.id}`}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
      >
        Ver ficha y carga de trabajo <ChevronRight size={12} />
      </Link>
    </div>
  )
}

function TarjetaEmergencia({
  emergencia: em,
  ahora,
  onCerrar,
}: {
  emergencia: MapaEmergencia
  ahora: Date
  onCerrar: () => void
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold text-white ${EMERGENCIA_COLOR_CLASS[em.tipo]}`}>
            {EMERGENCIA_LABEL[em.tipo]}
          </span>
          <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">{em.codigo}</span>
        </div>
        <BotonCerrar onClick={onCerrar} />
      </div>
      <div className="text-sm font-semibold text-[var(--color-text)]">{em.edificio_nombre}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span
          className={`rounded px-1.5 py-0.5 font-mono ${ESTADO_EMERGENCIA[em.estado].cls} ${em.estado === 'activa' ? 'animate-pulse' : ''}`}
        >
          {ESTADO_EMERGENCIA[em.estado].label}
        </span>
        <span className="flex items-center gap-1 font-mono text-[var(--color-text-muted)]">
          <Clock size={10} /> {tiempoTranscurrido(em.reportada_at, ahora)}
        </span>
      </div>
      <Link
        to={`/operador/emergencias?id=${em.id}`}
        className="mt-3 flex items-center justify-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
      >
        <Zap size={12} /> Gestionar despacho
      </Link>
    </div>
  )
}

function PanelCercanos({
  consulta,
  esEmergencia,
  resaltado,
  onResaltar,
}: {
  consulta: { data?: CandidatoTecnico[]; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown }
  esEmergencia: boolean
  resaltado: string | null
  onResaltar: (id: string | null) => void
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold tracking-wider text-[var(--color-text)] uppercase">
        <Navigation size={13} className="text-[var(--color-accent)]" /> Técnicos más cercanos
      </h3>
      {consulta.isLoading && <Cargando texto="Calculando cercanía…" className="p-2" />}
      {consulta.isError && (
        <ErrorConsulta error={consulta.error} titulo="No se pudo calcular la cercanía" onReintentar={() => consulta.refetch()} />
      )}
      {consulta.data && consulta.data.length === 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">No hay técnicos activos con ubicación conocida.</p>
      )}
      {consulta.data && consulta.data.length > 0 && (
        <>
          <ListaCercanos
            candidatos={consulta.data}
            mostrarEspecialidad={esEmergencia}
            resaltadoId={resaltado}
            onResaltar={onResaltar}
          />
          <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
            ETA estimado a 25 km/h (tráfico urbano). Pasa el cursor para ver la ruta en el mapa.
          </p>
        </>
      )}
    </div>
  )
}

function ListaCapas({
  datos,
  capas,
  seleccionId,
  ahora,
  onSeleccionar,
}: {
  datos: MapaData
  capas: Record<Capa, boolean>
  seleccionId: string | null
  ahora: Date
  onSeleccionar: (s: Seleccion, coords?: Coordenadas | null) => void
}) {
  const nada = !capas.edificios && !capas.tecnicos && !capas.emergencias
  const fila = (activo: boolean) =>
    `flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-xs transition-colors ${
      activo ? 'bg-[var(--color-accent)]/10' : 'hover:bg-[var(--color-bg-subtle)]'
    }`

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-3">
      {nada && (
        <Vacio
          icono={<Users size={20} />}
          titulo="Todas las capas ocultas"
          detalle="Activa una capa arriba para ver la lista."
          className="border-0 p-4"
        />
      )}

      {capas.emergencias && datos.emergencias.length > 0 && (
        <SeccionLista titulo="Emergencias abiertas" n={datos.emergencias.length}>
          {datos.emergencias.map((em) => (
            <button key={em.id} className={fila(seleccionId === em.id)} onClick={() => onSeleccionar({ tipo: 'emergencia', id: em.id }, em.ubicacion)}>
              <AlertTriangle size={13} className="flex-shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[var(--color-text)]">{em.edificio_nombre}</div>
                <div className="truncate text-[10px] text-[var(--color-text-muted)]">
                  {EMERGENCIA_LABEL[em.tipo]} · {tiempoTranscurrido(em.reportada_at, ahora)}
                </div>
              </div>
              <span className={`rounded px-1 py-0.5 font-mono text-[9px] ${ESTADO_EMERGENCIA[em.estado].cls}`}>
                {ESTADO_EMERGENCIA[em.estado].label}
              </span>
            </button>
          ))}
        </SeccionLista>
      )}

      {capas.edificios && (
        <SeccionLista titulo="Edificios" n={datos.edificios.length}>
          {datos.edificios.length === 0 && <p className="px-2 py-1 text-xs text-[var(--color-text-muted)]">Sin edificios.</p>}
          {datos.edificios.map((e) => (
            <button key={e.id} className={fila(seleccionId === e.id)} onClick={() => onSeleccionar({ tipo: 'edificio', id: e.id }, e.ubicacion)}>
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: COLOR_EDIFICIO[estadoEdificio(e)] }} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[var(--color-text)]">{e.nombre}</div>
                <div className="truncate text-[10px] text-[var(--color-text-muted)]">{e.comuna}</div>
              </div>
              <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                {e.total_equipos} eq · {e.ordenes_hoy} OT
              </span>
            </button>
          ))}
        </SeccionLista>
      )}

      {capas.tecnicos && (
        <SeccionLista titulo="Técnicos" n={datos.tecnicos.length}>
          {datos.tecnicos.length === 0 && <p className="px-2 py-1 text-xs text-[var(--color-text-muted)]">Sin técnicos activos.</p>}
          {datos.tecnicos.map((t) => {
            const disp = DISPONIBILIDAD[claveDisponibilidad(t.estado_disponibilidad)]
            return (
              <button key={t.id} className={fila(seleccionId === t.id)} onClick={() => onSeleccionar({ tipo: 'tecnico', id: t.id }, t.ubicacion)}>
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${disp.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--color-text)]">{t.nombre}</div>
                  <div className="truncate text-[10px] text-[var(--color-text-muted)]">
                    {t.orden_actual ? `${t.orden_actual.codigo} · ${t.orden_actual.edificio_nombre}` : disp.label}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                  {t.ubicacion ? tiempoTranscurrido(t.ubicacion_at, ahora).replace('hace ', '') : 'sin GPS'}
                </span>
              </button>
            )
          })}
        </SeccionLista>
      )}
    </div>
  )
}

function SeccionLista({ titulo, n, children }: { titulo: string; n: number; children: ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center justify-between px-2 font-mono text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
        {titulo} <span>{n}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
