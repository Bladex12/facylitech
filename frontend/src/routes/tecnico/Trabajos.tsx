import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck, Search, X } from 'lucide-react'
import type { TipoOrdenTrabajo } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { Cargando, ErrorCarga, Vacio } from '../../components/EstadosCarga'
import { agruparPorDia, esPendiente, filtrarOrdenes } from '../../domain/agrupacion'
import { OrdenCard } from './OrdenCard'
import { TIPO_ORDEN_LABEL } from './etiquetas'
import { useMisOrdenes } from './hooks'

type Pestana = 'pendientes' | 'completadas'
const TIPOS: (TipoOrdenTrabajo | 'todos')[] = [
  'todos',
  'mantencion',
  'reparacion',
  'emergencia',
  'inspeccion',
  'primera_visita',
]

export function Trabajos() {
  const { usuario } = useAuth()
  const [params, setParams] = useSearchParams()
  const pestana: Pestana = params.get('ver') === 'completadas' ? 'completadas' : 'pendientes'
  const [tipo, setTipo] = useState<TipoOrdenTrabajo | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const { data, isLoading, isError, error, refetch } = useMisOrdenes()

  const { pendientes, completadas } = useMemo(() => {
    const items = data?.items ?? []
    return {
      pendientes: items.filter(esPendiente),
      completadas: items.filter((o) => o.estado === 'completado' || o.estado === 'cancelado'),
    }
  }, [data])

  const grupos = useMemo(() => {
    const base = pestana === 'pendientes' ? pendientes : completadas
    const filtradas = filtrarOrdenes(base, { tipo, busqueda })
    return agruparPorDia(filtradas, new Date(), pestana === 'pendientes' ? 'asc' : 'desc')
  }, [pestana, pendientes, completadas, tipo, busqueda])

  const total = grupos.reduce((t, g) => t + g.items.length, 0)
  const hayFiltro = tipo !== 'todos' || busqueda.trim() !== ''

  function cambiarPestana(p: Pestana) {
    setParams(p === 'completadas' ? { ver: 'completadas' } : {}, { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 space-y-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 pt-4 pb-3 backdrop-blur">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Mis Trabajos</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {usuario?.zona ?? 'Técnico'}
            {data && ` — ${data.items.length} órdenes asignadas`}
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-lg border border-[var(--color-border)] bg-white p-1">
          {(['pendientes', 'completadas'] as const).map((p) => {
            const n = p === 'pendientes' ? pendientes.length : completadas.length
            return (
              <button
                key={p}
                onClick={() => cambiarPestana(p)}
                className={`rounded py-2 text-sm font-semibold capitalize transition-colors ${
                  pestana === p
                    ? 'bg-[var(--color-navy)] text-white'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {p} <span className="font-mono-brand text-xs font-normal opacity-70">{data ? n : ''}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-white px-3 py-2">
          <Search size={15} className="flex-shrink-0 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código, equipo, edificio o dirección"
            className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" className="text-[var(--color-text-muted)]">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {TIPOS.map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`flex-shrink-0 rounded border px-2.5 py-1 font-mono-brand text-xs transition-all ${
                tipo === t
                  ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)]'
              }`}
            >
              {t === 'todos' ? 'Todos' : TIPO_ORDEN_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {isLoading && <Cargando filas={4} />}
        {isError && !data && <ErrorCarga error={error} onReintentar={() => refetch()} />}

        {data && total === 0 && (
          <Vacio
            icono={<ClipboardCheck size={32} />}
            titulo={
              hayFiltro
                ? 'Ningún trabajo coincide'
                : pestana === 'pendientes'
                  ? '¡Todo al día!'
                  : 'Aún no hay trabajos completados'
            }
            texto={
              hayFiltro
                ? 'Prueba con otro tipo o término de búsqueda.'
                : pestana === 'pendientes'
                  ? 'No tienes órdenes pendientes.'
                  : 'Las órdenes que completes quedarán aquí como historial.'
            }
          >
            {hayFiltro && (
              <button
                onClick={() => {
                  setTipo('todos')
                  setBusqueda('')
                }}
                className="text-sm font-medium text-[var(--color-accent)]"
              >
                Quitar filtros
              </button>
            )}
          </Vacio>
        )}

        {grupos.map((g) => (
          <section key={g.dia}>
            <h2 className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
              {g.titulo}
              <span className="font-mono-brand font-normal">({g.items.length})</span>
            </h2>
            <div className="space-y-2">
              {g.items.map((o) => (
                <OrdenCard key={o.id} orden={o} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
