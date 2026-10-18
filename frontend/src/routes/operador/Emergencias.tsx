import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Plus, ShieldCheck, Zap } from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import type { Emergencia, EstadoEmergencia } from '../../api/types'
import { Cargando, ErrorConsulta, Vacio } from '../../components/operador/EstadoConsulta'
import { useAhora } from '../../components/operador/useAhora'
import { ordenarEmergencias } from '../../domain/emergencias'
import { DetalleEmergencia } from './emergencias/DetalleEmergencia'
import { ListaEmergencias } from './emergencias/ListaEmergencias'
import { NuevaEmergencia } from './emergencias/NuevaEmergencia'

type Filtro = 'abiertas' | EstadoEmergencia | 'todas'

const FILTROS: { clave: Filtro; label: string }[] = [
  { clave: 'abiertas', label: 'Abiertas' },
  { clave: 'activa', label: 'Activas' },
  { clave: 'en_atencion', label: 'En atención' },
  { clave: 'cerrada', label: 'Cerradas' },
  { clave: 'todas', label: 'Todas' },
]

function cumple(e: Emergencia, filtro: Filtro): boolean {
  if (filtro === 'todas') return true
  if (filtro === 'abiertas') return e.estado !== 'cerrada'
  return e.estado === filtro
}

export function Emergencias() {
  const ahora = useAhora(30_000)
  const [params, setParams] = useSearchParams()
  const [filtro, setFiltro] = useState<Filtro>('abiertas')
  const [creando, setCreando] = useState(false)

  const lista = useQuery({
    queryKey: ['emergencias', 'lista'],
    queryFn: () => endpoints.emergencias.listar(),
    refetchInterval: 10_000,
    retry: 1,
  })

  const todas = useMemo(() => ordenarEmergencias(lista.data?.items ?? []), [lista.data])
  const visibles = todas.filter((e) => cumple(e, filtro))

  // Selección: la de la URL (?id=, p.ej. desde el mapa) o la primera activa.
  const idUrl = params.get('id')
  const seleccionadaId = idUrl ?? todas.find((e) => e.estado === 'activa')?.id ?? visibles[0]?.id ?? null

  function seleccionar(id: string) {
    setParams({ id }, { replace: true })
  }

  const contar = (f: Filtro) => todas.filter((e) => cumple(e, f)).length
  const activas = contar('activa')

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Emergencias</h2>
          <p className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
            <ShieldCheck size={13} /> Respuesta inmediata — despacho en cascada aprobado por el
            operador
          </p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Plus size={14} /> Nueva emergencia
        </button>
      </div>

      {activas > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-red-600 px-4 py-3 text-white">
          <Zap size={18} className="flex-shrink-0" />
          <div className="text-sm">
            <span className="font-bold">
              {activas} emergencia{activas === 1 ? '' : 's'} sin técnico asignado.
            </span>{' '}
            <span className="text-red-100">Revisa el ranking de cercanía y aprueba la cascada.</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            onClick={() => setFiltro(f.clave)}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-all ${
              filtro === f.clave
                ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-slate-400'
            }`}
          >
            {f.label} ({contar(f.clave)})
          </button>
        ))}
      </div>

      {lista.isLoading && <Cargando texto="Cargando emergencias…" />}
      {lista.isError && (
        <ErrorConsulta
          error={lista.error}
          titulo="No se pudieron cargar las emergencias"
          onReintentar={() => lista.refetch()}
        />
      )}

      {lista.data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {visibles.length === 0 ? (
              <Vacio
                icono={<ShieldCheck size={28} />}
                titulo={filtro === 'abiertas' ? 'Sin emergencias abiertas' : 'Sin emergencias en este filtro'}
                detalle="Cuando llegue un aviso, regístralo con «Nueva emergencia»."
              />
            ) : (
              <ListaEmergencias
                emergencias={visibles}
                seleccionadaId={seleccionadaId}
                ahora={ahora}
                onSeleccionar={seleccionar}
              />
            )}
          </div>
          <div className="lg:col-span-3">
            {seleccionadaId ? (
              <DetalleEmergencia key={seleccionadaId} id={seleccionadaId} />
            ) : (
              <Vacio
                icono={<Zap size={28} />}
                titulo="Selecciona una emergencia"
                detalle="Verás su detalle, los técnicos más cercanos y el estado del despacho."
              />
            )}
          </div>
        </div>
      )}

      {creando && (
        <NuevaEmergencia
          onCerrar={() => setCreando(false)}
          onCreada={(e) => {
            setCreando(false)
            setFiltro('abiertas')
            seleccionar(e.id)
          }}
        />
      )}
    </div>
  )
}
