import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import type { OrdenTrabajo, Usuario } from '../../../api/types'
import {
  FRANJA_LABEL,
  SIN_TECNICO,
  agruparAgenda,
  bloquesPorFranja,
  cargaTecnico,
  claveCelda,
  type BloqueAgenda,
} from '../../../domain/agenda'
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
  sumarDias,
  type MedioDia,
} from '../../../domain/semana'
import { TIPO_OT_LABEL, iniciales } from '../comun/etiquetas'
import { useEdificios, useOrdenes, useTecnicos } from '../comun/consultas'
import { LeyendaSemaforo, NavegadorPeriodo, SelectFiltro } from '../comun/filtros'
import { NuevaOrdenModal, type ValoresInicialesOrden } from '../comun/NuevaOrdenModal'
import { OrdenPanel } from '../comun/OrdenPanel'
import {
  BadgeSemaforo,
  CLASE_BOTON_PRIMARIO,
  CLASE_TARJETA,
  Cargando,
  Drawer,
  ErrorVista,
  Vacio,
} from '../comun/ui'

interface Columna {
  id: string | null
  nombre: string
  zona: string | null
}

export function AgendaOperador() {
  const [params, setParams] = useSearchParams()
  const hoy = fechaIsoLocal(new Date())
  const ref = params.get('semana') ?? hoy
  const edificioId = params.get('edificio') ?? ''
  const dias = diasDeSemana(ref)
  const [bloque, setBloque] = useState<BloqueAgenda | null>(null)
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [nueva, setNueva] = useState<ValoresInicialesOrden | null>(null)

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  const tecnicos = useTecnicos()
  const edificios = useEdificios()
  const ordenes = useOrdenes({ desde: dias[0], hasta: dias[6], edificio_id: edificioId || undefined })
  const lista = useMemo(() => ordenes.data ?? [], [ordenes.data])
  const celdas = useMemo(() => agruparAgenda(lista), [lista])

  const hayDomingo = lista.some((o) => o.estado !== 'cancelado' && esDomingo(diaDeTimestamp(o.fecha_programada)))
  const diasVisibles = hayDomingo ? dias : dias.slice(0, 6)
  const sinAsignar = cargaTecnico(lista, null).total

  const columnas: Columna[] = [
    ...(tecnicos.data ?? []).map((t: Usuario) => ({ id: t.id, nombre: t.nombre, zona: t.zona })),
    ...(sinAsignar > 0 ? [{ id: null, nombre: 'Sin asignar', zona: null }] : []),
  ]

  const totalSemana = lista.filter((o) => o.estado !== 'cancelado')
  const completadas = totalSemana.filter((o) => o.estado === 'completado').length

  const crear = (tecnicoId: string | null, fecha: string, franja: MedioDia) =>
    setNueva({ fecha, hora: HORA_DEFECTO[franja], tecnicoId, edificioId: edificioId || undefined })

  return (
    <div className="space-y-5 p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Agenda de trabajos</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Cronograma semanal por técnico — medio día o día completo por edificio
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NavegadorPeriodo
            etiqueta={formatoRangoSemana(ref)}
            onAnterior={() => set('semana', sumarDias(ref, -7))}
            onSiguiente={() => set('semana', sumarDias(ref, 7))}
            onHoy={() => set('semana', null)}
            ancho="min-w-[170px]"
          />
          <button onClick={() => setNueva({ fecha: fechaSugerida(ref, hoy) })} className={CLASE_BOTON_PRIMARIO}>
            <Plus size={14} /> Nueva OT
          </button>
        </div>
      </div>

      <div className={`${CLASE_TARJETA} flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3`}>
        <SelectFiltro
          label="Edificio"
          valor={edificioId}
          onCambio={(v) => set('edificio', v || null)}
          todos="Todos"
          opciones={[...(edificios.data ?? [])]
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
            .map((e) => ({ valor: e.id, label: e.nombre }))}
        />
        <div className="flex items-center gap-3">
          <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">
            <b className="text-[var(--color-text)]">{completadas}</b> / {totalSemana.length} OTs completadas
          </span>
          <Progreso valor={completadas} total={totalSemana.length} ancho="w-40" />
        </div>
        {sinAsignar > 0 && (
          <span className="font-mono-brand text-xs text-amber-700">
            <b>{sinAsignar}</b> OT{sinAsignar === 1 ? '' : 's'} sin técnico
          </span>
        )}
        <div className="ml-auto">
          <LeyendaSemaforo />
        </div>
      </div>

      {ordenes.error || tecnicos.error ? (
        <ErrorVista
          error={ordenes.error ?? tecnicos.error}
          onReintentar={() => {
            ordenes.refetch()
            tecnicos.refetch()
          }}
        />
      ) : tecnicos.isLoading || ordenes.isLoading ? (
        <Cargando texto="Cargando agenda…" />
      ) : columnas.length === 0 ? (
        <Vacio titulo="No hay técnicos activos" detalle="Registra técnicos para planificar su agenda." />
      ) : (
        <div className={`${CLASE_TARJETA} overflow-x-auto`}>
          <div
            className="grid min-w-fit"
            style={{ gridTemplateColumns: `112px repeat(${columnas.length}, minmax(230px, 1fr))` }}
          >
            <div className="sticky left-0 z-10 border-b border-[var(--color-border)] bg-white" />
            {columnas.map((c) => {
              const carga = cargaTecnico(lista, c.id)
              return (
                <div key={c.id ?? SIN_TECNICO} className="border-b border-l border-[var(--color-border)] px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded font-mono-brand text-xs font-bold ${
                        c.id ? 'bg-[var(--color-navy)] text-white' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.id ? iniciales(c.nombre) : '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[var(--color-text)]">{c.nombre}</div>
                      <div className="truncate text-xs text-[var(--color-text-muted)]">
                        {c.zona ?? (c.id ? 'Sin zona' : 'Requieren técnico')}
                      </div>
                    </div>
                    <div className="text-right font-mono-brand text-[11px] text-[var(--color-text-muted)]">
                      <b className="text-[var(--color-text)]">{carga.total}</b> OTs
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progreso valor={carga.completadas} total={carga.total} />
                    <span className="font-mono-brand text-[10px] text-[var(--color-text-muted)]">
                      {carga.completadas}/{carga.total}
                    </span>
                  </div>
                </div>
              )
            })}

            {diasVisibles.map((d) => {
              const { dia, numero } = formatoDiaCorto(d)
              const esHoy = d === hoy
              return (
                <FilaDia key={d}>
                  <div
                    className={`sticky left-0 z-10 flex flex-col justify-center border-b border-[var(--color-border)]/60 px-3 py-2 ${
                      esHoy ? 'bg-[var(--color-accent)]/10' : 'bg-white'
                    }`}
                  >
                    <span className={`font-mono-brand text-[10px] tracking-widest uppercase ${esDomingo(d) ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>
                      {dia}
                    </span>
                    <span className={`text-xl leading-tight font-bold ${esHoy ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
                      {numero}
                    </span>
                    {esHoy && <span className="font-mono-brand text-[10px] text-[var(--color-accent)]">hoy</span>}
                  </div>
                  {columnas.map((c) => (
                    <Celda
                      key={`${c.id}-${d}`}
                      bloques={celdas.get(claveCelda(c.id, d))}
                      esHoy={esHoy}
                      onBloque={setBloque}
                      onCrear={(franja) => crear(c.id, d, franja)}
                    />
                  ))}
                </FilaDia>
              )
            })}
          </div>
        </div>
      )}

      {bloque && !orden && (
        <BloquePanel bloque={bloque} onCerrar={() => setBloque(null)} onOrden={setOrden} />
      )}
      {orden && (
        <OrdenPanel
          key={orden.id}
          orden={orden}
          onCerrar={() => {
            setOrden(null)
            setBloque(null)
          }}
          onVolver={bloque ? () => setOrden(null) : undefined}
        />
      )}
      {nueva && <NuevaOrdenModal inicial={nueva} onCerrar={() => setNueva(null)} />}
    </div>
  )
}

function FilaDia({ children }: { children: ReactNode }) {
  return <div className="contents">{children}</div>
}

function Progreso({ valor, total, ancho = 'flex-1' }: { valor: number; total: number; ancho?: string }) {
  const pct = total ? Math.round((valor / total) * 100) : 0
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)] ${ancho}`} aria-label={`${pct}% completado`}>
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Celda({
  bloques,
  esHoy,
  onBloque,
  onCrear,
}: {
  bloques: BloqueAgenda[] | undefined
  esHoy: boolean
  onBloque: (b: BloqueAgenda) => void
  onCrear: (franja: MedioDia) => void
}) {
  const f = bloquesPorFranja(bloques)
  return (
    <div className={`flex flex-col gap-1 border-b border-l border-[var(--color-border)]/60 p-1.5 ${esHoy ? 'bg-[var(--color-accent)]/[0.04]' : ''}`}>
      {f.completo.length > 0 && (
        <div className="flex gap-1.5">
          <span className="w-5 flex-shrink-0 pt-1.5 font-mono-brand text-[9px] text-[var(--color-navy)] uppercase">día</span>
          <div className="flex flex-1 flex-col gap-1">
            {f.completo.map((b) => (
              <Bloque key={b.clave} bloque={b} onClick={() => onBloque(b)} />
            ))}
          </div>
        </div>
      )}
      {(['manana', 'tarde'] as const)
        // Con un edificio de día completo, las franjas vacías no aportan: se ocultan.
        .filter((franja) => f.completo.length === 0 || f[franja].length > 0)
        .map((franja) => (
        <div key={franja} className="flex min-h-12 gap-1.5">
          <span className="w-5 flex-shrink-0 pt-1.5 font-mono-brand text-[9px] text-slate-400 uppercase">
            {franja === 'manana' ? 'am' : 'pm'}
          </span>
          <div className="flex flex-1 flex-col gap-1">
            {f[franja].map((b) => (
              <Bloque key={b.clave} bloque={b} onClick={() => onBloque(b)} />
            ))}
            {f[franja].length === 0 && (
              <button
                onClick={() => onCrear(franja)}
                className="group flex flex-1 items-center justify-center rounded border border-dashed border-transparent text-[10px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)]"
                aria-label={`Crear OT ${FRANJA_LABEL[franja]}`}
              >
                <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus size={11} /> {FRANJA_LABEL[franja]}
                </span>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Bloque({ bloque, onClick }: { bloque: BloqueAgenda; onClick: () => void }) {
  const completo = bloque.franja === 'completo'
  const hecho = bloque.completadas === bloque.total
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full overflow-hidden rounded border text-left transition-all hover:border-slate-400 hover:shadow-sm ${
        completo ? 'border-[var(--color-navy)]/30 bg-[var(--color-navy)]/[0.04]' : 'border-[var(--color-border)] bg-white'
      }`}
    >
      <span className={`w-1 flex-shrink-0 ${SEMAFORO_DOT_CLASS[bloque.semaforo]}`} />
      <span className="min-w-0 flex-1 px-2 py-1.5">
        <span className="flex items-center justify-between gap-1">
          <span className={`truncate text-xs font-semibold ${hecho ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
            {bloque.edificioNombre}
          </span>
          <span className="font-mono-brand text-[10px] text-[var(--color-text-muted)]">
            {bloque.completadas}/{bloque.total}
          </span>
        </span>
        <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
          {bloque.equipos} equipo{bloque.equipos === 1 ? '' : 's'} ·{' '}
          <span className={completo ? 'font-semibold text-[var(--color-navy)]' : ''}>{FRANJA_LABEL[bloque.franja]}</span>
          {' · '}
          {horaDeTimestamp(bloque.ordenes[0].fecha_programada)}
        </span>
        <span className="mt-1 block">
          <Progreso valor={bloque.completadas} total={bloque.total} ancho="w-full" />
        </span>
      </span>
    </button>
  )
}

function BloquePanel({
  bloque,
  onCerrar,
  onOrden,
}: {
  bloque: BloqueAgenda
  onCerrar: () => void
  onOrden: (o: OrdenTrabajo) => void
}) {
  const { dia, numero } = formatoDiaCorto(bloque.fecha)
  const tecnico = bloque.ordenes[0].tecnico?.nombre ?? 'Sin técnico asignado'
  return (
    <Drawer
      onCerrar={onCerrar}
      titulo={bloque.edificioNombre}
      subtitulo={`${tecnico} · ${dia} ${numero} · ${FRANJA_LABEL[bloque.franja]}`}
    >
      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { v: bloque.equipos, l: 'equipos' },
            { v: bloque.total, l: 'OTs' },
            { v: `${bloque.completadas}/${bloque.total}`, l: 'completadas' },
          ].map((s) => (
            <div key={s.l} className="rounded border border-[var(--color-border)] py-2">
              <div className="text-lg font-bold text-[var(--color-text)]">{s.v}</div>
              <div className="font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">{s.l}</div>
            </div>
          ))}
        </div>
        <Progreso valor={bloque.completadas} total={bloque.total} ancho="w-full" />
        <div className="divide-y divide-[var(--color-border)]/60 rounded border border-[var(--color-border)]">
          {bloque.ordenes.map((o) => (
            <button
              key={o.id}
              onClick={() => onOrden(o)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-subtle)]"
            >
              <span className="font-mono-brand text-xs font-semibold text-[var(--color-text)]">
                {horaDeTimestamp(o.fecha_programada)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono-brand text-xs font-semibold text-[var(--color-accent)]">{o.codigo}</span>
                  <span className="font-mono-brand text-xs text-[var(--color-text)]">{o.ascensor.codigo}</span>
                </div>
                <div className="truncate text-xs text-[var(--color-text-muted)]">
                  {TIPO_OT_LABEL[o.tipo]}
                  {o.ascensor.torre ? ` · ${o.ascensor.torre}` : ''}
                </div>
              </div>
              <BadgeSemaforo semaforo={o.semaforo} />
              <ChevronRight size={13} className="text-[var(--color-text-muted)]" />
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  )
}
