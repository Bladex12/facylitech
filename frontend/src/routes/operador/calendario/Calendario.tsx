import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../../../api/endpoints'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { OrdenTrabajo, TipoOrdenTrabajo } from '../../../api/types'
import { DIAS_SEMANA, formatoMesAnio, grillaMes, sumarMeses } from '../../../domain/fechas'
import { semaforoAgregado } from '../../../domain/agenda'
import { SEMAFORO_DOT_CLASS } from '../../../domain/semaforo'
import {
  HORA_DEFECTO,
  diaDeTimestamp,
  diasDeSemana,
  esDomingo,
  fechaIsoLocal,
  fechaSugerida,
  formatoDiaCorto,
  formatoRangoSemana,
  horaDeTimestamp,
  medioDia,
  rangoMes,
  sumarDias,
  type MedioDia,
} from '../../../domain/semana'
import { TIPO_OT_LABEL, iniciales } from '../comun/etiquetas'
import { useEdificios, useOrdenes, useTecnicos } from '../comun/consultas'
import { LeyendaSemaforo, NavegadorPeriodo, SelectFiltro } from '../comun/filtros'
import { NuevaOrdenModal, type ValoresInicialesOrden } from '../comun/NuevaOrdenModal'
import { OrdenPanel } from '../comun/OrdenPanel'
import { CLASE_BOTON_PRIMARIO, CLASE_TARJETA, ErrorVista } from '../comun/ui'

const SIN_TECNICO = 'sin'
const MAX_CHIPS_MES = 4

export function Calendario() {
  const [params, setParams] = useSearchParams()
  const hoy = fechaIsoLocal(new Date())
  const vista = params.get('vista') === 'semana' ? 'semana' : 'mes'
  const ref = params.get('fecha') ?? hoy
  const tecnicoId = params.get('tecnico') ?? ''
  const tipo = (params.get('tipo') ?? '') as TipoOrdenTrabajo | ''
  const edificioId = params.get('edificio') ?? ''
  const [verCanceladas, setVerCanceladas] = useState(false)
  const [ordenAbierta, setOrdenAbierta] = useState<OrdenTrabajo | null>(null)
  const [nueva, setNueva] = useState<ValoresInicialesOrden | null>(null)

  // Deep-link `?orden=<id>` (p.ej. desde la OT creada al aceptar una emergencia):
  // abre el panel de esa OT y salta al mes en que está programada.
  const ordenParam = params.get('orden')
  const ordenEnlazada = useQuery({
    queryKey: ['orden', ordenParam],
    queryFn: () => endpoints.ordenes.obtener(ordenParam!),
    enabled: !!ordenParam,
  })
  useEffect(() => {
    if (!ordenEnlazada.data) return
    setOrdenAbierta(ordenEnlazada.data)
    const p = new URLSearchParams(params)
    p.delete('orden')
    p.set('fecha', diaDeTimestamp(ordenEnlazada.data.fecha_programada))
    setParams(p, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenEnlazada.data])

  const set = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setParams(p, { replace: true })
  }

  const [anio, mes] = ref.split('-').map(Number)
  const semana = diasDeSemana(ref)
  const rango = vista === 'mes' ? rangoMes(anio, mes) : { desde: semana[0], hasta: semana[6] }

  const tecnicos = useTecnicos()
  const edificios = useEdificios()
  const ordenes = useOrdenes({
    ...rango,
    tipo: tipo || undefined,
    edificio_id: edificioId || undefined,
  })

  const visibles = useMemo(
    () =>
      (ordenes.data ?? [])
        .filter((o) => verCanceladas || o.estado !== 'cancelado')
        .filter((o) =>
          !tecnicoId ? true : tecnicoId === SIN_TECNICO ? !o.tecnico : o.tecnico?.id === tecnicoId,
        )
        .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada)),
    [ordenes.data, verCanceladas, tecnicoId],
  )
  const porDia = useMemo(() => {
    const m = new Map<string, OrdenTrabajo[]>()
    for (const o of visibles) {
      const d = diaDeTimestamp(o.fecha_programada)
      const l = m.get(d)
      if (l) l.push(o)
      else m.set(d, [o])
    }
    return m
  }, [visibles])

  const activas = visibles.filter((o) => o.estado !== 'cancelado')
  const resumen = {
    total: activas.length,
    vencidas: activas.filter((o) => o.semaforo === 'vencido').length,
    sinTecnico: activas.filter((o) => !o.tecnico).length,
  }

  function mover(delta: number) {
    if (vista === 'mes') {
      const s = sumarMeses(anio, mes, delta)
      set({ fecha: `${s.anio}-${String(s.mes).padStart(2, '0')}-01` })
    } else set({ fecha: sumarDias(ref, 7 * delta) })
  }

  const crearEn = (fecha: string, franja: MedioDia = 'manana') =>
    setNueva({
      fecha,
      hora: HORA_DEFECTO[franja],
      edificioId: edificioId || undefined,
      tecnicoId: tecnicoId && tecnicoId !== SIN_TECNICO ? tecnicoId : undefined,
      tipo: tipo || undefined,
    })

  return (
    <div className="space-y-5 p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Calendario</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Semáforo de órdenes de trabajo — clic en una OT para editarla, en un día vacío para crear
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded border border-[var(--color-border)] bg-white">
            {(['mes', 'semana'] as const).map((v) => (
              <button
                key={v}
                onClick={() => set({ vista: v === 'mes' ? null : v })}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  vista === v ? 'bg-[var(--color-navy)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]'
                }`}
              >
                {v === 'mes' ? 'Mes' : 'Semana'}
              </button>
            ))}
          </div>
          <NavegadorPeriodo
            etiqueta={vista === 'mes' ? formatoMesAnio(anio, mes) : formatoRangoSemana(ref)}
            onAnterior={() => mover(-1)}
            onSiguiente={() => mover(1)}
            onHoy={() => set({ fecha: null })}
            ancho="min-w-[170px]"
          />
          <button onClick={() => crearEn(fechaSugerida(ref, hoy))} className={CLASE_BOTON_PRIMARIO}>
            <Plus size={14} /> Nueva OT
          </button>
        </div>
      </div>

      <div className={`${CLASE_TARJETA} flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3`}>
        <SelectFiltro
          label="Técnico"
          valor={tecnicoId}
          onCambio={(v) => set({ tecnico: v || null })}
          todos="Todos"
          opciones={[
            ...(tecnicos.data ?? []).map((t) => ({ valor: t.id, label: t.nombre })),
            { valor: SIN_TECNICO, label: 'Sin asignar' },
          ]}
        />
        <SelectFiltro
          label="Tipo"
          valor={tipo}
          onCambio={(v) => set({ tipo: v || null })}
          todos="Todos"
          opciones={(Object.keys(TIPO_OT_LABEL) as TipoOrdenTrabajo[]).map((t) => ({ valor: t, label: TIPO_OT_LABEL[t] }))}
        />
        <SelectFiltro
          label="Edificio"
          valor={edificioId}
          onCambio={(v) => set({ edificio: v || null })}
          todos="Todos"
          opciones={[...(edificios.data ?? [])]
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
            .map((e) => ({ valor: e.id, label: e.nombre }))}
        />
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input type="checkbox" checked={verCanceladas} onChange={(e) => setVerCanceladas(e.target.checked)} />
          Ver canceladas
        </label>
        {(tecnicoId || tipo || edificioId) && (
          <button
            onClick={() => set({ tecnico: null, tipo: null, edificio: null })}
            className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            Limpiar filtros
          </button>
        )}
        <div className="ml-auto flex items-center gap-4 font-mono-brand text-xs text-[var(--color-text-muted)]">
          <span>
            <b className="text-[var(--color-text)]">{resumen.total}</b> OTs
          </span>
          {resumen.vencidas > 0 && (
            <span className="text-red-600">
              <b>{resumen.vencidas}</b> vencida{resumen.vencidas === 1 ? '' : 's'}
            </span>
          )}
          {resumen.sinTecnico > 0 && (
            <span className="text-amber-700">
              <b>{resumen.sinTecnico}</b> sin técnico
            </span>
          )}
        </div>
      </div>

      {ordenes.error && <ErrorVista error={ordenes.error} onReintentar={() => ordenes.refetch()} />}

      <div className="relative">
        {ordenes.isFetching && (
          <div className="absolute top-0 right-0 left-0 z-10 h-0.5 animate-pulse bg-[var(--color-accent)]" />
        )}
        {vista === 'mes' ? (
          <VistaMes
            anio={anio}
            mes={mes}
            hoy={hoy}
            porDia={porDia}
            cargando={ordenes.isLoading}
            onOrden={setOrdenAbierta}
            onDia={(f) => crearEn(f)}
            onVerSemana={(f) => set({ vista: 'semana', fecha: f })}
          />
        ) : (
          <VistaSemana
            dias={semana}
            hoy={hoy}
            porDia={porDia}
            cargando={ordenes.isLoading}
            onOrden={setOrdenAbierta}
            onSlot={crearEn}
          />
        )}
      </div>

      <LeyendaSemaforo
        extra={
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400" /> Cancelada
          </span>
        }
      />

      {ordenAbierta && (
        <OrdenPanel key={ordenAbierta.id} orden={ordenAbierta} onCerrar={() => setOrdenAbierta(null)} />
      )}
      {nueva && <NuevaOrdenModal inicial={nueva} onCerrar={() => setNueva(null)} />}
    </div>
  )
}

function ChipOrden({
  orden,
  onClick,
  detallado,
}: {
  orden: OrdenTrabajo
  onClick: () => void
  detallado?: boolean
}) {
  const cancelada = orden.estado === 'cancelado'
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={`${orden.codigo} · ${TIPO_OT_LABEL[orden.tipo]} · ${orden.ascensor.codigo} — ${orden.ascensor.edificio.nombre}${orden.tecnico ? ` · ${orden.tecnico.nombre}` : ' · sin técnico'}`}
      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left font-mono-brand text-[10px] transition-colors hover:bg-slate-200 ${
        cancelada ? 'bg-transparent text-slate-400 line-through' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text)]'
      } ${detallado ? 'flex-col items-start gap-0 border border-[var(--color-border)] bg-white px-2 py-1.5' : ''}`}
    >
      {detallado ? (
        <>
          <span className="flex w-full items-center gap-1.5">
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full ${cancelada ? 'border border-dashed border-slate-400' : SEMAFORO_DOT_CLASS[orden.semaforo]}`}
            />
            <span className="font-semibold">{horaDeTimestamp(orden.fecha_programada)}</span>
            <span className="truncate">{orden.ascensor.codigo}</span>
            <span
              className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded px-0.5 text-[8px] ${orden.tecnico ? 'bg-[var(--color-navy)] text-white' : 'bg-amber-100 text-amber-800'}`}
            >
              {orden.tecnico ? iniciales(orden.tecnico.nombre) : '?'}
            </span>
          </span>
          <span className="w-full truncate font-sans text-[11px] text-[var(--color-text-muted)]">
            {TIPO_OT_LABEL[orden.tipo]} · {orden.ascensor.edificio.nombre}
          </span>
        </>
      ) : (
        <>
          <span
            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cancelada ? 'border border-dashed border-slate-400' : SEMAFORO_DOT_CLASS[orden.semaforo]}`}
          />
          <span className="truncate">
            {horaDeTimestamp(orden.fecha_programada)} {orden.ascensor.codigo}
          </span>
        </>
      )}
    </button>
  )
}

function VistaMes({
  anio,
  mes,
  hoy,
  porDia,
  cargando,
  onOrden,
  onDia,
  onVerSemana,
}: {
  anio: number
  mes: number
  hoy: string
  porDia: Map<string, OrdenTrabajo[]>
  cargando: boolean
  onOrden: (o: OrdenTrabajo) => void
  onDia: (fecha: string) => void
  onVerSemana: (fecha: string) => void
}) {
  const semanas = grillaMes(anio, mes)
  return (
    <div className={`${CLASE_TARJETA} overflow-hidden`}>
      <div className="grid grid-cols-7 border-b border-[var(--color-border)]/60">
        {DIAS_SEMANA.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-center font-mono-brand text-xs tracking-widest uppercase ${i === 6 ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {semanas.flatMap((semana, si) =>
          semana.map((fecha, di) => {
            if (!fecha)
              return <div key={`${si}-${di}`} className="min-h-28 border-r border-b border-[var(--color-border)]/40 bg-[var(--color-bg-subtle)]/60" />
            const ordenes = porDia.get(fecha) ?? []
            const activas = ordenes.filter((o) => o.estado !== 'cancelado')
            const domingo = di === 6
            const esHoy = fecha === hoy
            return (
              <div
                key={fecha}
                role="button"
                tabIndex={0}
                onClick={() => onDia(fecha)}
                onKeyDown={(e) => e.key === 'Enter' && onDia(fecha)}
                className={`group relative min-h-28 cursor-pointer border-r border-b border-[var(--color-border)]/40 p-1.5 transition-colors hover:bg-[var(--color-bg-subtle)] ${domingo ? 'bg-red-50/30' : 'bg-white'}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`flex h-6 min-w-6 items-center justify-center rounded-full text-sm font-semibold ${
                      esHoy ? 'bg-[var(--color-navy)] px-1.5 text-white' : domingo ? 'text-red-400' : 'text-gray-700'
                    }`}
                  >
                    {Number(fecha.slice(-2))}
                  </span>
                  <span className="flex items-center gap-1">
                    <Plus size={12} className="text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    {activas.length > 0 && (
                      <span className={`h-2.5 w-2.5 rounded-full ${SEMAFORO_DOT_CLASS[semaforoAgregado(activas.map((o) => o.semaforo))]}`} />
                    )}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {ordenes.slice(0, MAX_CHIPS_MES).map((o) => (
                    <ChipOrden key={o.id} orden={o} onClick={() => onOrden(o)} />
                  ))}
                  {ordenes.length > MAX_CHIPS_MES && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onVerSemana(fecha)
                      }}
                      className="pl-1 text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                    >
                      +{ordenes.length - MAX_CHIPS_MES} más · ver semana
                    </button>
                  )}
                </div>
              </div>
            )
          }),
        )}
      </div>
      {cargando && (
        <div className="border-t border-[var(--color-border)]/60 px-4 py-2 text-xs text-[var(--color-text-muted)]">
          Cargando órdenes…
        </div>
      )}
    </div>
  )
}

function VistaSemana({
  dias,
  hoy,
  porDia,
  cargando,
  onOrden,
  onSlot,
}: {
  dias: string[]
  hoy: string
  porDia: Map<string, OrdenTrabajo[]>
  cargando: boolean
  onOrden: (o: OrdenTrabajo) => void
  onSlot: (fecha: string, franja: MedioDia) => void
}) {
  const franjas: { id: MedioDia; label: string; rango: string }[] = [
    { id: 'manana', label: 'Mañana', rango: '08–13 h' },
    { id: 'tarde', label: 'Tarde', rango: '13–19 h' },
  ]
  return (
    <div className={`${CLASE_TARJETA} overflow-hidden`}>
      <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-[var(--color-border)]">
        <div />
        {dias.map((d) => {
          const { dia, numero } = formatoDiaCorto(d)
          const n = (porDia.get(d) ?? []).filter((o) => o.estado !== 'cancelado').length
          return (
            <div key={d} className={`border-l border-[var(--color-border)]/60 px-2 py-2 text-center ${d === hoy ? 'bg-[var(--color-navy)]/5' : ''}`}>
              <div className={`font-mono-brand text-[10px] tracking-widest uppercase ${esDomingo(d) ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>
                {dia}
              </div>
              <div className={`text-lg font-bold ${d === hoy ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>{numero}</div>
              <div className="font-mono-brand text-[10px] text-[var(--color-text-muted)]">
                {n} OT{n === 1 ? '' : 's'}
              </div>
            </div>
          )
        })}
      </div>
      {franjas.map((f) => (
        <div key={f.id} className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-[var(--color-border)]/60 last:border-0">
          <div className="flex flex-col justify-start px-2 py-3">
            <span className="text-xs font-semibold text-gray-700">{f.label}</span>
            <span className="font-mono-brand text-[10px] text-[var(--color-text-muted)]">{f.rango}</span>
          </div>
          {dias.map((d) => {
            const ordenes = (porDia.get(d) ?? []).filter((o) => medioDia(o.fecha_programada) === f.id)
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                onClick={() => onSlot(d, f.id)}
                onKeyDown={(e) => e.key === 'Enter' && onSlot(d, f.id)}
                className={`group min-h-36 cursor-pointer space-y-1 border-l border-[var(--color-border)]/60 p-1.5 transition-colors hover:bg-[var(--color-bg-subtle)] ${
                  esDomingo(d) ? 'bg-red-50/30' : d === hoy ? 'bg-[var(--color-navy)]/[0.03]' : ''
                }`}
              >
                {ordenes.map((o) => (
                  <ChipOrden key={o.id} orden={o} onClick={() => onOrden(o)} detallado />
                ))}
                <div className="flex items-center justify-center gap-1 rounded border border-dashed border-transparent py-1 text-[10px] text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:border-[var(--color-border)] group-hover:opacity-100">
                  <Plus size={11} /> Nueva OT
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {cargando && (
        <div className="px-4 py-2 text-xs text-[var(--color-text-muted)]">Cargando órdenes…</div>
      )}
    </div>
  )
}
