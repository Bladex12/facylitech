import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Marker } from 'react-leaflet'
import { CalendarClock, ChevronRight, KeyRound, Mail, MapPin, Phone, X } from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type { OrdenTrabajo, PrioridadOrdenTrabajo, TipoOrdenTrabajo, Usuario } from '../../../api/types'
import { MapaBase } from '../../../components/mapa/MapaBase'
import { Avatar } from '../../../components/operador/Avatar'
import { Cargando, ErrorConsulta } from '../../../components/operador/EstadoConsulta'
import { iconoTecnico } from '../../../components/operador/iconosMapa'
import { EMERGENCIA_LABEL } from '../../../domain/emergencias'
import {
  claveDisponibilidad,
  DISPONIBILIDAD,
  ubicacionDesactualizada,
  type CargaTrabajo,
} from '../../../domain/equipoTecnico'
import { ordenarListado } from '../../../domain/ordenamiento'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../../domain/semaforo'
import {
  formatoFechaCorta,
  formatoHora,
  rangoSemana,
  sumarDiasIso,
  tiempoTranscurrido,
} from '../../../domain/tiempoRelativo'
import { CargaSemanal } from './CargaSemanal'
import { RestablecerPassword } from './RestablecerPassword'

/** Del mockup (JOB_TYPE_LABELS / PRIORITY_CFG). */
const TIPO_LABEL: Record<TipoOrdenTrabajo, string> = {
  mantencion: 'Mantención',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
  inspeccion: 'Inspección',
  primera_visita: 'Primera Visita',
}
const PRIORIDAD: Record<PrioridadOrdenTrabajo, { label: string; color: string }> = {
  baja: { label: 'Baja', color: 'text-slate-500' },
  media: { label: 'Media', color: 'text-amber-600' },
  alta: { label: 'Alta', color: 'text-orange-600' },
  critica: { label: 'Crítica', color: 'text-red-600' },
}

const DIAS_PROXIMOS = 14

export function DetalleTecnico({
  tecnico: t,
  ordenActual,
  carga,
  ahora,
  onCerrar,
}: {
  tecnico: Usuario
  ordenActual: OrdenTrabajo | null
  carga: CargaTrabajo | null
  ahora: Date
  onCerrar: () => void
}) {
  const [restableciendo, setRestableciendo] = useState(false)
  const disp = DISPONIBILIDAD[claveDisponibilidad(t.estado_disponibilidad)]
  const desde = rangoSemana(ahora).desde
  const hasta = sumarDiasIso(ahora, DIAS_PROXIMOS)

  const proximas = useQuery({
    queryKey: ['ordenes', { tecnico_id: t.id, desde, hasta }],
    queryFn: () => endpoints.ordenes.listar({ tecnico_id: t.id, desde, hasta, limit: 100 }),
    refetchInterval: 60_000,
    retry: 1,
  })
  const pendientes = ordenarListado(
    (proximas.data?.items ?? []).filter((o) => o.estado !== 'completado' && o.estado !== 'cancelado'),
  )

  return (
    <aside className="w-full flex-shrink-0 space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-5 xl:sticky xl:top-0 xl:w-[380px]">
      <div className="flex items-start gap-3">
        <Avatar nombre={t.nombre} tamano="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-lg leading-tight font-bold text-[var(--color-text)]">{t.nombre}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 font-mono text-xs ${disp.cls}`}>{disp.label}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{t.zona ?? 'Sin zona'}</span>
          </div>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar detalle" className="rounded p-1 hover:bg-[var(--color-bg-subtle)]">
          <X size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-[var(--color-text-muted)]">RUT</dt>
        <dd className="font-mono-brand text-[var(--color-text)]">{t.rut ?? '—'}</dd>
        <dt className="text-[var(--color-text-muted)]">Teléfono</dt>
        <dd>
          {t.telefono ? (
            <a href={`tel:${t.telefono.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-mono-brand text-[var(--color-accent)] hover:underline">
              <Phone size={10} /> {t.telefono}
            </a>
          ) : (
            '—'
          )}
        </dd>
        <dt className="text-[var(--color-text-muted)]">Email</dt>
        <dd className="truncate">
          <a href={`mailto:${t.email}`} className="inline-flex items-center gap-1 text-slate-700 hover:text-[var(--color-accent)]">
            <Mail size={10} /> {t.email}
          </a>
        </dd>
        <dt className="text-[var(--color-text-muted)]">Especialidades</dt>
        <dd className="flex flex-wrap gap-1">
          {(t.especialidades ?? []).length === 0 && '—'}
          {(t.especialidades ?? []).map((e) => (
            <span key={e} className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-[10px] text-slate-700">
              {EMERGENCIA_LABEL[e]}
            </span>
          ))}
        </dd>
      </dl>

      {/* Última ubicación */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
            Última ubicación
          </span>
          {t.ultima_ubicacion && (
            <span
              className={`text-[11px] ${ubicacionDesactualizada(t.ultima_ubicacion_at, ahora) ? 'text-amber-700' : 'text-[var(--color-text-muted)]'}`}
            >
              {tiempoTranscurrido(t.ultima_ubicacion_at, ahora)}
            </span>
          )}
        </div>
        {t.ultima_ubicacion ? (
          <div className="h-36 overflow-hidden rounded border border-[var(--color-border)]">
            <MapaBase centro={t.ultima_ubicacion} zoom={14}>
              <Marker
                position={[t.ultima_ubicacion.lat, t.ultima_ubicacion.lon]}
                icon={iconoTecnico(t.nombre, t.estado_disponibilidad, { seleccionado: true })}
              />
            </MapaBase>
          </div>
        ) : (
          <div className="flex h-20 items-center justify-center gap-1.5 rounded border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            <MapPin size={12} /> Sin ubicación reportada
          </div>
        )}
        {ordenActual && (
          <div className="mt-2 rounded bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            En curso: <span className="font-mono-brand font-semibold">{ordenActual.codigo}</span> ·{' '}
            {ordenActual.ascensor.codigo} · {ordenActual.ascensor.edificio.nombre}
            {ordenActual.inicio_real && ` · desde ${formatoHora(ordenActual.inicio_real)}`}
          </div>
        )}
      </div>

      {/* Carga */}
      <div>
        <div className="mb-2 font-mono text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
          Carga de la semana
        </div>
        <div className="flex items-end justify-between gap-3">
          <CargaSemanal porDia={carga?.porDia ?? null} hoy={ahora} />
          <div className="space-y-1 text-right text-xs">
            <div>
              <span className="text-lg font-bold text-blue-600">{carga?.hoyPendientes ?? '·'}</span>
              <span className="text-[var(--color-text-muted)]"> pendientes hoy</span>
            </div>
            <div>
              <span className="text-lg font-bold text-[var(--color-navy)]">{carga?.semana ?? '·'}</span>
              <span className="text-[var(--color-text-muted)]"> en la semana</span>
            </div>
          </div>
        </div>
      </div>

      {/* Próximas OTs */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1 font-mono text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
            <CalendarClock size={11} /> Próximas órdenes
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">hasta {DIAS_PROXIMOS} días</span>
        </div>
        {proximas.isLoading && <Cargando texto="Cargando órdenes…" className="p-3" />}
        {proximas.isError && (
          <ErrorConsulta error={proximas.error} titulo="No se pudieron cargar las órdenes" onReintentar={() => proximas.refetch()} />
        )}
        {proximas.data && pendientes.length === 0 && (
          <p className="rounded bg-[var(--color-bg-subtle)] px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
            Sin órdenes pendientes en los próximos {DIAS_PROXIMOS} días.
          </p>
        )}
        {pendientes.length > 0 && (
          <ul className="divide-y divide-[var(--color-bg-subtle)]">
            {pendientes.slice(0, 8).map((o) => (
              <li key={o.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-brand text-xs font-semibold text-[var(--color-accent)]">{o.codigo}</span>
                  <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-medium ${SEMAFORO_BADGE_CLASS[o.semaforo]}`}>
                    {SEMAFORO_LABEL[o.semaforo]}
                  </span>
                </div>
                <div className="truncate text-xs text-[var(--color-text)]">
                  {TIPO_LABEL[o.tipo]} — {o.ascensor.codigo} · {o.ascensor.edificio.nombre}
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] text-[var(--color-text-muted)]">
                  <span className="capitalize">
                    {formatoFechaCorta(o.fecha_programada)} · {formatoHora(o.fecha_programada)}
                  </span>
                  <span className={`font-semibold ${PRIORIDAD[o.prioridad].color}`}>{PRIORIDAD[o.prioridad].label}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pendientes.length > 8 && (
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">+{pendientes.length - 8} más</p>
        )}
        <Link
          to="/operador/agenda"
          className="mt-2 flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          Ver agenda completa <ChevronRight size={12} />
        </Link>
      </div>

      {/* Cuenta */}
      <div className="border-t border-[var(--color-bg-subtle)] pt-4">
        <div className="mb-2 font-mono text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
          Cuenta
        </div>
        <button
          type="button"
          onClick={() => setRestableciendo(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-[var(--color-bg-subtle)]"
        >
          <KeyRound size={13} aria-hidden="true" /> Restablecer contraseña
        </button>
      </div>
      {restableciendo && <RestablecerPassword tecnico={t} onCerrar={() => setRestableciendo(false)} />}
    </aside>
  )
}
