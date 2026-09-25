import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../../api/endpoints'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_DOT_CLASS, SEMAFORO_LABEL } from '../../domain/semaforo'
import { DIAS_SEMANA, formatoDiaLargo, formatoMesAnio, grillaMes, sumarMeses } from '../../domain/fechas'
import type { EstadoOrdenTrabajo, Semaforo } from '../../api/types'

const HOY_ISO = new Date().toISOString().slice(0, 10)

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

  const contadores = diaInfo?.reduce<Record<EstadoOrdenTrabajo, number>>(
    (acc, o) => {
      acc[o.estado] = (acc[o.estado] ?? 0) + 1
      return acc
    },
    { programado: 0, en_curso: 0, completado: 0, cancelado: 0 },
  )

  return (
    <div className="space-y-4 p-6">
      {(data?.emergencias_abiertas ?? 0) > 0 && (
        <div className="rounded bg-red-600 px-4 py-3 text-sm font-medium text-white">
          {data!.emergencias_abiertas} emergencia{data!.emergencias_abiertas === 1 ? '' : 's'}{' '}
          abierta{data!.emergencias_abiertas === 1 ? '' : 's'} — requiere atención
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPeriodo((p) => sumarMeses(p.anio, p.mes, -1))}
              className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <h2 className="w-40 text-center text-base font-semibold capitalize">
              {formatoMesAnio(periodo.anio, periodo.mes)}
            </h2>
            <button
              onClick={() => setPeriodo((p) => sumarMeses(p.anio, p.mes, 1))}
              className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            {(Object.keys(SEMAFORO_LABEL) as Semaforo[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${SEMAFORO_DOT_CLASS[s]}`} />
                {SEMAFORO_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-gray-200 bg-gray-200 text-xs">
          {DIAS_SEMANA.map((d, i) => (
            <div
              key={d}
              className={`bg-gray-50 px-2 py-1 text-center font-medium ${i === 6 ? 'text-red-600' : 'text-gray-500'}`}
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
                  className={`min-h-20 bg-white p-1 text-left align-top disabled:bg-gray-50 ${
                    diaSeleccionado === fecha ? 'ring-2 ring-inset ring-[#1e2a78]' : ''
                  }`}
                >
                  {fecha && (
                    <>
                      <span
                        className={`text-xs ${
                          di === 6 ? 'text-red-600' : 'text-gray-500'
                        } ${esHoy ? 'font-bold text-[#1e2a78]' : ''}`}
                      >
                        {Number(fecha.slice(-2))}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {ordenes.slice(0, 3).map((o) => (
                          <div key={o.id} className="flex items-center gap-1 truncate text-[10px]">
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${SEMAFORO_DOT_CLASS[o.semaforo]}`} />
                            {o.hora} {o.ascensor_codigo}
                          </div>
                        ))}
                        {ordenes.length > 3 && (
                          <div className="text-[10px] text-gray-400">+{ordenes.length - 3} más</div>
                        )}
                      </div>
                    </>
                  )}
                </button>
              )
            }),
          )}
        </div>
        {isLoading && <p className="mt-2 text-xs text-gray-400">Cargando calendario…</p>}
      </div>

      {diaSeleccionado && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold capitalize">
              {formatoDiaLargo(diaSeleccionado)} · {diaInfo?.length ?? 0} trabajo
              {diaInfo?.length === 1 ? '' : 's'}
            </h3>
            {esDomingo(diaSeleccionado) && <span className="text-xs text-red-600">Domingo</span>}
          </div>
          {contadores && (
            <div className="mb-3 flex gap-3 text-xs text-gray-500">
              <span>Programados: {contadores.programado}</span>
              <span>En curso: {contadores.en_curso}</span>
              <span>Completados: {contadores.completado}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
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
                  <tr key={o.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-medium">{o.codigo}</td>
                    <td className="py-2 capitalize">{o.tipo}</td>
                    <td className="py-2">
                      {o.ascensor_codigo} · {o.edificio_nombre}
                    </td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${SEMAFORO_BADGE_CLASS[o.semaforo]}`}>
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
