import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { Cargando, ErrorCarga, Vacio } from '../../components/EstadosCarga'
import { esPendiente } from '../../domain/agrupacion'
import { formatoDiaLargo } from '../../domain/fechas'
import { ordenarListado } from '../../domain/ordenamiento'
import { diaLocal } from '../../domain/tiempo'
import type { OrdenTrabajo } from '../../api/types'
import { BannerEmergencia } from './BannerEmergencia'
import { OrdenCard } from './OrdenCard'
import { useMisOrdenes } from './hooks'

function sumarDias(base: Date, n: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return diaLocal(d)
}

export function Agenda() {
  const { usuario } = useAuth()
  const { data, isLoading, isError, error, refetch } = useMisOrdenes()

  const { grupos, hoy, atrasadas } = useMemo(() => {
    const ahora = new Date()
    const hoyIso = diaLocal(ahora)
    const mananaIso = sumarDias(ahora, 1)
    const pasadoIso = sumarDias(ahora, 2)

    const buckets: Record<string, OrdenTrabajo[]> = {
      Atrasadas: [],
      Hoy: [],
      Mañana: [],
      'Pasado mañana': [],
      'Próximos días': [],
    }
    for (const orden of data?.items ?? []) {
      const fecha = diaLocal(orden.fecha_programada)
      if (fecha < hoyIso) {
        if (esPendiente(orden)) buckets['Atrasadas'].push(orden)
      } else if (fecha === hoyIso) buckets['Hoy'].push(orden)
      else if (fecha === mananaIso) buckets['Mañana'].push(orden)
      else if (fecha === pasadoIso) buckets['Pasado mañana'].push(orden)
      else buckets['Próximos días'].push(orden)
    }
    for (const key of Object.keys(buckets)) buckets[key] = ordenarListado(buckets[key])
    return {
      grupos: buckets,
      hoy: buckets['Hoy'],
      atrasadas: buckets['Atrasadas'].length,
    }
  }, [data])

  const hoyPendientes = hoy.filter(esPendiente).length
  const hoyListas = hoy.length - hoyPendientes
  const hayOrdenes = Object.values(grupos).some((g) => g.length > 0)

  return (
    <div className="space-y-5 p-4">
      <div>
        <p className="font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
          {formatoDiaLargo(diaLocal(new Date()))}
        </p>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Mi Agenda</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {usuario?.nombre} — {usuario?.zona ?? 'Técnico'}
        </p>
      </div>

      <BannerEmergencia />

      {data && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: hoyPendientes, l: 'Por hacer hoy', cls: 'text-[var(--color-text)]' },
            { n: hoyListas, l: 'Listas hoy', cls: 'text-green-700' },
            { n: atrasadas, l: 'Atrasadas', cls: atrasadas > 0 ? 'text-red-600' : 'text-[var(--color-text)]' },
          ].map((s) => (
            <div key={s.l} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5">
              <div className={`text-2xl leading-none font-bold ${s.cls}`}>{s.n}</div>
              <div className="mt-1 text-[10px] tracking-wide text-[var(--color-text-muted)] uppercase">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading && <Cargando filas={3} />}
      {isError && !data && <ErrorCarga error={error} onReintentar={() => refetch()} />}

      {data && !hayOrdenes && (
        <Vacio
          icono={<CalendarCheck size={32} />}
          titulo="Sin órdenes próximas"
          texto="Cuando el operador te asigne trabajos aparecerán aquí."
        >
          <Link to="/tecnico/trabajos" className="text-sm font-medium text-[var(--color-accent)]">
            Ver historial de trabajos
          </Link>
        </Vacio>
      )}

      {Object.entries(grupos).map(
        ([titulo, ordenes]) =>
          ordenes.length > 0 && (
            <section key={titulo}>
              <h2
                className={`mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase ${
                  titulo === 'Atrasadas' ? 'text-red-600' : 'text-[var(--color-text-muted)]'
                }`}
              >
                {titulo}
                <span className="font-mono-brand font-normal">({ordenes.length})</span>
              </h2>
              <div className="space-y-2">
                {ordenes.map((orden) => (
                  <OrdenCard
                    key={orden.id}
                    orden={orden}
                    mostrarFecha={titulo === 'Atrasadas' || titulo === 'Próximos días'}
                  />
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  )
}
