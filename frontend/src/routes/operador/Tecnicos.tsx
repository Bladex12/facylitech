import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { MapPin, Phone, Search, Users, Wrench } from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import type { OrdenTrabajo, Usuario } from '../../api/types'
import { Avatar } from '../../components/operador/Avatar'
import { Cargando, ErrorConsulta, Vacio } from '../../components/operador/EstadoConsulta'
import { useAhora } from '../../components/operador/useAhora'
import { EMERGENCIA_LABEL } from '../../domain/emergencias'
import {
  calcularCarga,
  claveDisponibilidad,
  DISPONIBILIDAD,
  filtrarTecnicos,
  ubicacionDesactualizada,
  type CargaTrabajo,
  type FiltroDisponibilidad,
} from '../../domain/equipoTecnico'
import { rangoSemana, tiempoTranscurrido } from '../../domain/tiempoRelativo'
import { CargaSemanal } from './tecnicos/CargaSemanal'
import { DetalleTecnico } from './tecnicos/DetalleTecnico'

const FILTROS: { clave: FiltroDisponibilidad; label: string }[] = [
  { clave: 'todos', label: 'Todos' },
  { clave: 'disponible', label: 'Disponibles' },
  { clave: 'en_terreno', label: 'En terreno' },
]

export function Tecnicos() {
  const ahora = useAhora(60_000)
  const [params, setParams] = useSearchParams()
  const [texto, setTexto] = useState('')
  const [disponibilidad, setDisponibilidad] = useState<FiltroDisponibilidad>('todos')
  const semana = rangoSemana(ahora)

  const tecnicos = useQuery({
    queryKey: ['usuarios', 'tecnico'],
    queryFn: () => endpoints.usuarios.listar('tecnico'),
    refetchInterval: 30_000,
    retry: 1,
  })
  const activos = useMemo(() => (tecnicos.data?.items ?? []).filter((t) => t.activo), [tecnicos.data])

  const enCurso = useQuery({
    queryKey: ['ordenes', { estado: 'en_curso' }],
    queryFn: () => endpoints.ordenes.listar({ estado: 'en_curso', limit: 100 }),
    refetchInterval: 30_000,
    retry: 1,
  })
  const ordenEnCurso = useMemo(() => {
    const m = new Map<string, OrdenTrabajo>()
    for (const o of enCurso.data?.items ?? []) if (o.tecnico) m.set(o.tecnico.id, o)
    return m
  }, [enCurso.data])

  // Carga de la semana por técnico (lunes a domingo), una consulta por técnico (~5-10).
  const cargas = useQueries({
    queries: activos.map((t) => ({
      queryKey: ['ordenes', { tecnico_id: t.id, desde: semana.desde, hasta: semana.hasta }],
      queryFn: () =>
        endpoints.ordenes.listar({ tecnico_id: t.id, desde: semana.desde, hasta: semana.hasta, limit: 100 }),
      refetchInterval: 60_000,
      retry: 1,
    })),
  })
  const cargaPorTecnico = new Map<string, CargaTrabajo | null>(
    activos.map((t, i) => [t.id, cargas[i]?.data ? calcularCarga(cargas[i].data.items, ahora) : null]),
  )

  const visibles = filtrarTecnicos(activos, { texto, disponibilidad })
  const seleccionadoId = params.get('id')
  const seleccionado = activos.find((t) => t.id === seleccionadoId) ?? null

  const contar = (f: FiltroDisponibilidad) =>
    f === 'todos' ? activos.length : activos.filter((t) => t.estado_disponibilidad === f).length
  const otsHoy = [...cargaPorTecnico.values()].reduce((a, c) => a + (c?.hoy ?? 0), 0)
  const vencidas = [...cargaPorTecnico.values()].reduce((a, c) => a + (c?.vencidas ?? 0), 0)

  const stats = [
    { label: 'Técnicos activos', valor: activos.length, sub: 'en el equipo', color: 'text-[var(--color-navy)]' },
    { label: 'Disponibles', valor: contar('disponible'), sub: 'para emergencias', color: 'text-green-600' },
    { label: 'En terreno', valor: contar('en_terreno'), sub: `${ordenEnCurso.size} con OT en curso`, color: 'text-[var(--color-accent)]' },
    { label: 'Trabajos hoy', valor: otsHoy, sub: vencidas ? `${vencidas} vencidos esta semana` : 'sin vencidos esta semana', color: 'text-blue-600' },
  ]

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Técnicos</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Equipo de campo y carga de trabajo</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-[var(--color-border)] bg-white p-5">
            <div className={`mb-1 text-3xl font-bold ${s.color}`}>{tecnicos.isLoading ? '—' : s.valor}</div>
            <div className="mb-0.5 text-sm font-semibold text-[var(--color-text)]">{s.label}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, zona o RUT"
            className="w-full rounded border border-[var(--color-border)] bg-white py-2 pr-3 pl-8 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.clave}
              onClick={() => setDisponibilidad(f.clave)}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-all ${
                disponibilidad === f.clave
                  ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-slate-400'
              }`}
            >
              {f.label} ({contar(f.clave)})
            </button>
          ))}
        </div>
      </div>

      {tecnicos.isLoading && <Cargando texto="Cargando equipo técnico…" />}
      {tecnicos.isError && (
        <ErrorConsulta error={tecnicos.error} titulo="No se pudo cargar el equipo" onReintentar={() => tecnicos.refetch()} />
      )}

      {tecnicos.data && (
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            {visibles.length === 0 ? (
              <Vacio
                icono={<Users size={28} />}
                titulo={activos.length === 0 ? 'Aún no hay técnicos registrados' : 'Ningún técnico coincide con el filtro'}
                detalle={activos.length === 0 ? undefined : 'Prueba con otro texto o disponibilidad.'}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {visibles.map((t) => (
                  <TarjetaTecnico
                    key={t.id}
                    tecnico={t}
                    ordenActual={ordenEnCurso.get(t.id) ?? null}
                    carga={cargaPorTecnico.get(t.id) ?? null}
                    seleccionado={t.id === seleccionadoId}
                    ahora={ahora}
                    onClick={() => setParams(t.id === seleccionadoId ? {} : { id: t.id }, { replace: true })}
                  />
                ))}
              </div>
            )}
          </div>
          {seleccionado && (
            <DetalleTecnico
              key={seleccionado.id}
              tecnico={seleccionado}
              ordenActual={ordenEnCurso.get(seleccionado.id) ?? null}
              carga={cargaPorTecnico.get(seleccionado.id) ?? null}
              ahora={ahora}
              onCerrar={() => setParams({}, { replace: true })}
            />
          )}
        </div>
      )}
    </div>
  )
}

function TarjetaTecnico({
  tecnico: t,
  ordenActual,
  carga,
  seleccionado,
  ahora,
  onClick,
}: {
  tecnico: Usuario
  ordenActual: OrdenTrabajo | null
  carga: CargaTrabajo | null
  seleccionado: boolean
  ahora: Date
  onClick: () => void
}) {
  const disp = DISPONIBILIDAD[claveDisponibilidad(t.estado_disponibilidad)]
  const ubicacionAt = t.ultima_ubicacion_at ?? null
  const viejo = ubicacionDesactualizada(ubicacionAt, ahora)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className={`cursor-pointer rounded-lg border bg-white p-5 transition-all ${
        seleccionado
          ? 'border-[var(--color-accent)] shadow-sm ring-1 ring-[var(--color-accent)]/30'
          : 'border-[var(--color-border)] hover:border-slate-300'
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <Avatar nombre={t.nombre} tamano="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[var(--color-text)]">{t.nombre}</div>
          <div className="flex flex-wrap items-center gap-x-2.5 text-xs text-[var(--color-text-muted)]">
            <span>{t.zona ?? 'Sin zona'}</span>
            {t.telefono && (
              <>
                <a
                  href={`tel:${t.telefono.replace(/\s/g, '')}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 hover:text-[var(--color-accent)]"
                >
                  <Phone size={10} /> {t.telefono}
                </a>
              </>
            )}
          </div>
          <div className={`mt-1 inline-block rounded px-2 py-0.5 font-mono text-xs ${disp.cls}`}>{disp.label}</div>
        </div>
        <div className="ml-auto text-right font-mono-brand text-xs text-[var(--color-text-muted)]">
          {t.rut ?? <span className="text-slate-300">sin RUT</span>}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {(t.especialidades ?? []).length === 0 && (
          <span className="text-xs text-[var(--color-text-muted)]">Sin especialidades registradas</span>
        )}
        {(t.especialidades ?? []).map((e) => (
          <span key={e} className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-[10px] text-slate-700">
            {EMERGENCIA_LABEL[e]}
          </span>
        ))}
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5 truncate text-slate-700">
          <Wrench size={11} className="flex-shrink-0 text-[var(--color-text-muted)]" />
          {ordenActual ? (
            <span className="truncate">
              <span className="font-mono-brand font-semibold text-[var(--color-accent)]">{ordenActual.codigo}</span> ·{' '}
              {ordenActual.ascensor.edificio.nombre}
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">Sin orden en curso</span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 ${t.ultima_ubicacion && viejo ? 'text-amber-700' : 'text-[var(--color-text-muted)]'}`}>
          <MapPin size={11} className="flex-shrink-0" />
          {t.ultima_ubicacion ? `Ubicación ${tiempoTranscurrido(ubicacionAt, ahora)}` : 'Sin ubicación reportada'}
        </div>
      </div>

      <div className="mt-3 flex items-end gap-4 border-t border-[var(--color-bg-subtle)] pt-3">
        <div className="grid flex-1 grid-cols-3 gap-2">
          {[
            { label: 'Hoy', v: carga?.hoy, c: 'text-blue-600' },
            { label: 'Semana', v: carga?.semana, c: 'text-[var(--color-navy)]' },
            { label: 'Vencidos', v: carga?.vencidas, c: carga?.vencidas ? 'text-red-600' : 'text-slate-400' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-xl font-bold ${s.c}`}>{s.v ?? '·'}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>
        <CargaSemanal porDia={carga?.porDia ?? null} hoy={ahora} compacto />
      </div>
    </div>
  )
}
