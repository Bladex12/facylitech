import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_DOT_CLASS, SEMAFORO_LABEL } from '../../domain/semaforo'
import {
  DIAS_SEMANA,
  formatoDiaLargo,
  formatoMesAnio,
  grillaMes,
  sumarMeses,
} from '../../domain/fechas'
import type { Especialidad, EstadoOrdenTrabajo, Semaforo } from '../../api/types'

const HOY_ISO = new Date().toISOString().slice(0, 10)

const EMERGENCIA_LABEL: Record<Especialidad, string> = {
  persona_atrapada: 'Persona Atrapada',
  mecanica: 'Falla Mecánica',
  corte_energia: 'Corte de Energía',
  incendio: 'Incendio',
  inundacion: 'Inundación',
}

function esDomingo(fechaIso: string): boolean {
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  return new Date(anio, mes - 1, dia).getDay() === 0
}

export function Dashboard() {
  const hoy = new Date()
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 })
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)

  const mesStr = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'calendario', mesStr],
    queryFn: () => endpoints.dashboard.calendario(mesStr),
  })

  const ordenesPorDia = useMemo(() => {
    const mapa = new Map(data?.dias.map((d) => [d.fecha, d.ordenes]) ?? [])
    return mapa
  }, [data])

  const semanas = grillaMes(periodo.anio, periodo.mes)
  const diaInfo = diaSeleccionado ? ordenesPorDia.get(diaSeleccionado) : undefined
  const emergencias = data?.emergencias_abiertas ?? []

  const todasLasOrdenes = data?.dias.flatMap((d) => d.ordenes) ?? []
  const stats = [
    { label: 'Trabajos del mes', valor: todasLasOrdenes.length, color: 'text-[var(--color-navy)]' },
    {
      label: 'Vencidos',
      valor: todasLasOrdenes.filter((o) => o.semaforo === 'vencido').length,
      color: 'text-red-600',
    },
    {
      label: 'En curso',
      valor: todasLasOrdenes.filter((o) => o.semaforo === 'en_curso').length,
      color: 'text-amber-600',
    },
    { label: 'Emergencias', valor: emergencias.length, color: 'text-[var(--color-accent)]' },
  ]

  const contadores = diaInfo?.reduce<Record<EstadoOrdenTrabajo, number>>(
    (acc, o) => {
      acc[o.estado] = (acc[o.estado] ?? 0) + 1
      return acc
    },
    { programado: 0, en_curso: 0, completado: 0, cancelado: 0 },
  )

  return (
    <div className="space-y-5 p-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Resumen operacional</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border bg-white p-5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className={`mb-1 text-3xl font-bold ${s.color}`}>{s.valor}</div>
            <div className="text-sm font-semibold text-[var(--color-text)]">{s.label}</div>
          </div>
        ))}
      </div>

      {emergencias.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg bg-red-600 p-4 text-white">
          <Zap size={20} className="flex-shrink-0" />
          <div>
            <div className="font-bold">
              {EMERGENCIA_LABEL[emergencias[0].tipo]} — {emergencias[0].edificio_nombre}
            </div>
            <div className="text-sm text-red-100">
              {emergencias[0].descripcion}
              {emergencias.length > 1 &&
                ` · +${emergencias.length - 1} emergencia${emergencias.length - 1 === 1 ? '' : 's'} más — ver sección Emergencias`}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPeriodo((p) => sumarMeses(p.anio, p.mes, -1))}
              className="rounded px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <h3 className="w-40 text-center text-base font-semibold text-[var(--color-text)] capitalize">
              {formatoMesAnio(periodo.anio, periodo.mes)}
            </h3>
            <button
              onClick={() => setPeriodo((p) => sumarMeses(p.anio, p.mes, 1))}
              className="rounded px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
          <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
            {(Object.keys(SEMAFORO_LABEL) as Semaforo[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${SEMAFORO_DOT_CLASS[s]}`} />
                {SEMAFORO_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        <div
          className="grid grid-cols-7 gap-px overflow-hidden rounded border text-xs"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-border)' }}
        >
          {DIAS_SEMANA.map((d, i) => (
            <div
              key={d}
              className={`bg-[var(--color-bg-subtle)] px-2 py-1 text-center font-mono-brand tracking-widest uppercase ${i === 6 ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}
            >
              {d}
            </div>
          ))}
          {semanas.flatMap((semana, si) =>
            semana.map((fecha, di) => {
              const ordenes = fecha ? (ordenesPorDia.get(fecha) ?? []) : []
              const esHoy = fecha === HOY_ISO
              return (
                <button
                  key={`${si}-${di}`}
                  disabled={!fecha}
                  onClick={() => fecha && setDiaSeleccionado(fecha)}
                  className={`min-h-24 bg-white p-1.5 text-left align-top disabled:bg-[var(--color-bg-subtle)]/50 ${
                    diaSeleccionado === fecha ? 'ring-2 ring-[var(--color-navy)] ring-inset' : ''
                  } ${di === 6 ? 'bg-red-50/30' : ''}`}
                >
                  {fecha && (
                    <>
                      <span
                        className={`text-sm font-semibold ${
                          di === 6 ? 'text-red-400' : 'text-[var(--color-text-muted)]'
                        } ${esHoy ? 'text-[var(--color-navy)]' : ''}`}
                      >
                        {Number(fecha.slice(-2))}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {ordenes.slice(0, 3).map((o) => (
                          <div
                            key={o.id}
                            className="flex items-center gap-1 truncate rounded bg-[var(--color-bg-subtle)] px-1 py-0.5 font-mono-brand text-[9px] text-[var(--color-text)]"
                          >
                            <span
                              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${SEMAFORO_DOT_CLASS[o.semaforo]}`}
                            />
                            {o.hora} {o.ascensor_codigo}
                          </div>
                        ))}
                        {ordenes.length > 3 && (
                          <div className="pl-1 text-[9px] text-[var(--color-text-muted)]">
                            +{ordenes.length - 3} más
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </button>
              )
            }),
          )}
        </div>
        {isLoading && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Cargando calendario…</p>
        )}
      </div>

      {diaSeleccionado && (
        <div
          className="rounded-lg border bg-white p-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text)] capitalize">
              {formatoDiaLargo(diaSeleccionado)} · {diaInfo?.length ?? 0} trabajo
              {diaInfo?.length === 1 ? '' : 's'}
            </h3>
            {esDomingo(diaSeleccionado) && <span className="text-xs text-red-600">Domingo</span>}
          </div>
          {contadores && (
            <div className="mb-3 flex gap-3 text-xs text-[var(--color-text-muted)]">
              <span>Programados: {contadores.programado}</span>
              <span>En curso: {contadores.en_curso}</span>
              <span>Completados: {contadores.completado}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-[var(--color-text-muted)]" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="pb-2">Código</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Ascensor</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2">Prioridad</th>
                  <th className="pb-2">Hora</th>
                </tr>
              </thead>
              <tbody>
                {diaInfo?.map((o) => (
                  <tr key={o.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-bg-subtle)' }}>
                    <td className="py-2 font-mono-brand font-medium text-[var(--color-accent)]">
                      {o.codigo}
                    </td>
                    <td className="py-2 capitalize">{o.tipo}</td>
                    <td className="py-2">
                      {o.ascensor_codigo} · {o.edificio_nombre}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${SEMAFORO_BADGE_CLASS[o.semaforo]}`}
                      >
                        {SEMAFORO_LABEL[o.semaforo]}
                      </span>
                    </td>
                    <td className="py-2 capitalize">{o.prioridad}</td>
                    <td className="py-2">{o.hora}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
