import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Navigation,
  Play,
  QrCode,
  Send,
  Trash2,
  Zap,
} from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import type { Papeleta } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { Cargando, ErrorCarga } from '../../components/EstadosCarga'
import { linksNavegacion } from '../../components/mapa/mapaUtils'
import { SEMAFORO_BADGE_CLASS, SEMAFORO_LABEL } from '../../domain/semaforo'
import { mensajeError } from '../../lib/red'
import { EvidenciasPapeleta } from './EvidenciasPapeleta'
import { PRIORIDAD_CFG, TIPO_ORDEN_LABEL } from './etiquetas'
import { reportarUbicacionEvento } from './hooks'

type EstadoGuardado = 'guardando' | 'guardado' | 'error' | undefined

function Seccion({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wider text-[var(--color-text)] uppercase">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function IndicadorGuardado({ estado }: { estado: EstadoGuardado }) {
  if (!estado) return null
  if (estado === 'guardando')
    return <span className="font-mono-brand text-[10px] text-[var(--color-text-muted)]">Guardando…</span>
  if (estado === 'guardado')
    return (
      <span className="flex items-center gap-0.5 font-mono-brand text-[10px] text-green-700">
        <Check size={10} /> Guardado
      </span>
    )
  return <span className="font-mono-brand text-[10px] text-red-600">No se guardó</span>
}

export function OrdenDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const [nuevaPieza, setNuevaPieza] = useState({ nombre: '', marca: '', esOriginal: true })
  const [guardado, setGuardado] = useState<Record<string, EstadoGuardado>>({})
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const ordenQuery = useQuery({
    queryKey: ['orden', id],
    queryFn: () => endpoints.ordenes.obtener(id!),
    enabled: !!id,
  })
  const orden = ordenQuery.data

  const papeletaQuery = useQuery({
    queryKey: ['papeleta', orden?.papeleta_id],
    queryFn: () => endpoints.papeletas.obtener(orden!.papeleta_id!),
    enabled: !!orden?.papeleta_id,
  })
  const papeleta = papeletaQuery.data

  const edificioQuery = useQuery({
    queryKey: ['edificio', orden?.ascensor.edificio.id],
    queryFn: () => endpoints.edificios.obtener(orden!.ascensor.edificio.id),
    enabled: !!orden,
    staleTime: 10 * 60_000,
  })

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['orden', id] })
    queryClient.invalidateQueries({ queryKey: ['papeleta'] })
    queryClient.invalidateQueries({ queryKey: ['ordenes'] })
  }
  const alFallar = (e: unknown) => setErrorAccion(mensajeError(e))

  // RNF-01: Iniciar crea la papeleta en el mismo toque (un paso menos que antes).
  const iniciarMutation = useMutation({
    mutationFn: async () => {
      setErrorAccion(null)
      if (usuario) reportarUbicacionEvento(usuario.id)
      const ot = await endpoints.ordenes.iniciar(id!)
      if (!ot.papeleta_id) await endpoints.ordenes.crearPapeleta(id!)
      return ot
    },
    onSuccess: invalidar,
    onError: (e) => {
      alFallar(e)
      invalidar()
    },
  })
  const crearPapeletaMutation = useMutation({
    mutationFn: () => endpoints.ordenes.crearPapeleta(id!),
    onSuccess: invalidar,
    onError: alFallar,
  })
  // Optimista: el check responde al instante aunque la señal sea mala (RNF-02).
  const marcarItemMutation = useMutation({
    mutationFn: ({ itemId, completado }: { itemId: string; completado: boolean }) =>
      endpoints.papeletas.marcarItem(papeleta!.id, itemId, { completado }),
    onMutate: async ({ itemId, completado }) => {
      const clave = ['papeleta', papeleta!.id]
      await queryClient.cancelQueries({ queryKey: clave })
      const previa = queryClient.getQueryData<Papeleta>(clave)
      queryClient.setQueryData<Papeleta>(clave, (p) =>
        p ? { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, completado } : i)) } : p,
      )
      return { previa }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previa) queryClient.setQueryData(['papeleta', papeleta!.id], ctx.previa)
      alFallar(e)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['papeleta', papeleta?.id] }),
  })
  const actualizarPapeletaMutation = useMutation({
    mutationFn: (datos: Partial<Papeleta>) => endpoints.papeletas.actualizar(papeleta!.id, datos),
    onMutate: (datos) => setGuardado((g) => ({ ...g, [Object.keys(datos)[0]]: 'guardando' })),
    onSuccess: (p, datos) => {
      queryClient.setQueryData(['papeleta', p.id], p)
      setGuardado((g) => ({ ...g, [Object.keys(datos)[0]]: 'guardado' }))
    },
    onError: (_e, datos) => setGuardado((g) => ({ ...g, [Object.keys(datos)[0]]: 'error' })),
  })
  const enviarPapeletaMutation = useMutation({
    mutationFn: () => endpoints.papeletas.enviar(papeleta!.id),
    onSuccess: invalidar,
    onError: alFallar,
  })
  const completarMutation = useMutation({
    mutationFn: () => {
      setErrorAccion(null)
      if (usuario) reportarUbicacionEvento(usuario.id)
      return endpoints.ordenes.completar(id!)
    },
    onSuccess: invalidar,
    onError: alFallar,
  })
  const agregarPiezaMutation = useMutation({
    mutationFn: () =>
      endpoints.papeletas.agregarPieza(papeleta!.id, {
        nombre: nuevaPieza.nombre.trim(),
        marca: nuevaPieza.marca.trim() || null,
        es_original: nuevaPieza.esOriginal,
      }),
    onSuccess: (p) => {
      setNuevaPieza({ nombre: '', marca: '', esOriginal: true })
      queryClient.setQueryData(['papeleta', p.id], p)
    },
    onError: alFallar,
  })
  const eliminarPiezaMutation = useMutation({
    mutationFn: (piezaId: string) => endpoints.papeletas.eliminarPieza(papeleta!.id, piezaId),
    onSuccess: (p) => queryClient.setQueryData(['papeleta', p.id], p),
    onError: alFallar,
  })

  if (ordenQuery.isLoading)
    return (
      <div className="p-4">
        <Cargando filas={3} />
      </div>
    )
  if (ordenQuery.isError || !orden)
    return (
      <div className="space-y-4 p-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <ArrowLeft size={13} /> Volver
        </button>
        <ErrorCarga error={ordenQuery.error} onReintentar={() => ordenQuery.refetch()} titulo="No se pudo cargar la orden" />
      </div>
    )

  const puedeIniciar = orden.estado === 'programado'
  const enCurso = orden.estado === 'en_curso'
  const puedeCompletar = enCurso && papeleta?.estado === 'enviada'
  const soloLectura = papeleta?.estado === 'enviada' || orden.estado === 'completado'
  const manasEdificio = orden.ascensor.edificio.manas
  const instrucciones = orden.ascensor.edificio.instrucciones_reinicio
  const manasAscensor = orden.ascensor.manas
  const prioridad = PRIORIDAD_CFG[orden.prioridad]
  const fecha = new Date(orden.fecha_programada)
  const links = edificioQuery.data ? linksNavegacion(edificioQuery.data.ubicacion) : null
  const totalItems = papeleta?.items.length ?? 0
  const hechos = papeleta?.items.filter((i) => i.completado).length ?? 0
  const progreso = totalItems ? Math.round((hechos / totalItems) * 100) : 0

  const campoTexto = (campo: 'observaciones' | 'falla_detectada' | 'trabajo_realizado', etiqueta: string) => (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--color-text-muted)]">
        {etiqueta}
        <IndicadorGuardado estado={guardado[campo]} />
      </span>
      <textarea
        disabled={soloLectura}
        defaultValue={papeleta?.[campo] ?? ''}
        onBlur={(e) => {
          if ((papeleta?.[campo] ?? '') !== e.target.value)
            actualizarPapeletaMutation.mutate({ [campo]: e.target.value })
        }}
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-2.5 text-sm focus:border-[var(--color-accent)] focus:bg-white focus:outline-none disabled:text-[var(--color-text-muted)]"
        rows={2}
      />
    </label>
  )

  return (
    <div className="space-y-4 p-4 pb-8">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/tecnico/agenda'))}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
      >
        <ArrowLeft size={13} /> Mis trabajos
      </button>

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-mono-brand font-semibold text-[var(--color-accent)]">{orden.codigo}</span>
          <span className={`rounded px-2 py-0.5 font-mono-brand text-xs font-medium ${SEMAFORO_BADGE_CLASS[orden.semaforo]}`}>
            {SEMAFORO_LABEL[orden.semaforo]}
          </span>
          <span className={`font-mono-brand text-[11px] font-semibold ${prioridad.color}`}>{prioridad.label}</span>
        </div>
        <h1 className="flex items-center gap-1.5 text-xl font-bold text-[var(--color-text)]">
          {orden.tipo === 'emergencia' && <Zap size={18} className="text-red-600" />}
          {TIPO_ORDEN_LABEL[orden.tipo]} — {orden.ascensor.codigo}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {orden.ascensor.edificio.nombre} · {orden.ascensor.edificio.direccion}, {orden.ascensor.edificio.comuna}
        </p>
        <p className="mt-0.5 font-mono-brand text-xs text-[var(--color-text-muted)]">
          {fecha.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
          {fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
          {orden.ascensor.torre && ` · Torre ${orden.ascensor.torre}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a
          href={links?.googleMaps}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!links}
          className={`flex flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white py-2.5 text-[11px] font-medium text-[var(--color-text)] active:bg-[var(--color-bg)] ${links ? '' : 'pointer-events-none opacity-40'}`}
        >
          <Navigation size={16} className="text-[var(--color-accent)]" /> Cómo llegar
        </a>
        <Link
          to={`/tecnico/escanear?verificar=${orden.ascensor.id}&orden=${orden.id}`}
          className="flex flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white py-2.5 text-[11px] font-medium text-[var(--color-text)] active:bg-[var(--color-bg)]"
        >
          <QrCode size={16} className="text-[var(--color-accent)]" /> Verificar QR
        </Link>
        <Link
          to={`/tecnico/mensajes?orden=${orden.id}`}
          className="flex flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white py-2.5 text-[11px] font-medium text-[var(--color-text)] active:bg-[var(--color-bg)]"
        >
          <MessageSquare size={16} className="text-[var(--color-accent)]" /> Consultar
        </Link>
      </div>

      {orden.descripcion && (
        <p className="rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-text)]">
          {orden.descripcion}
        </p>
      )}

      {(manasEdificio || instrucciones || manasAscensor) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-amber-700 uppercase">
            <AlertTriangle size={12} /> Mañas e instrucciones
          </p>
          {manasEdificio && (
            <p>
              <span className="font-semibold">Edificio:</span> {manasEdificio}
            </p>
          )}
          {manasAscensor && (
            <p className="mt-1">
              <span className="font-semibold">Equipo:</span> {manasAscensor}
            </p>
          )}
          {instrucciones && (
            <p className="mt-1">
              <span className="font-semibold">Reinicio:</span> {instrucciones}
            </p>
          )}
        </div>
      )}

      {errorAccion && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorAccion}
        </p>
      )}

      {puedeIniciar && (
        <button
          onClick={() => iniciarMutation.mutate()}
          disabled={iniciarMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-3.5 text-base font-semibold text-white shadow-sm active:bg-amber-600 disabled:opacity-60"
        >
          {iniciarMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          Iniciar trabajo
        </button>
      )}

      {enCurso && !orden.papeleta_id && (
        <button
          onClick={() => crearPapeletaMutation.mutate()}
          disabled={crearPapeletaMutation.isPending}
          className="w-full rounded-lg bg-[var(--color-navy)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Abrir papeleta
        </button>
      )}

      {orden.papeleta_id && papeletaQuery.isLoading && <Cargando filas={2} />}
      {papeletaQuery.isError && !papeleta && (
        <ErrorCarga error={papeletaQuery.error} onReintentar={() => papeletaQuery.refetch()} titulo="No se pudo cargar la papeleta" />
      )}

      {papeleta && (
        <>
          <Seccion
            titulo="Checklist"
            extra={
              <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">
                {hechos}/{totalItems}
              </span>
            }
          >
            {papeleta.total_items_pauta != null && (
              <p className="-mt-1 mb-2 text-xs text-[var(--color-text-muted)]">
                Este mes corresponden {totalItems} de {papeleta.total_items_pauta} ítems de la pauta.
              </p>
            )}
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${progreso}%` }} />
            </div>
            {totalItems === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">Ningún ítem de la pauta corresponde a este mes.</p>
            )}
            <div className="space-y-2">
              {papeleta.items.map((item) => (
                <button
                  key={item.id}
                  disabled={soloLectura}
                  onClick={() => marcarItemMutation.mutate({ itemId: item.id, completado: !item.completado })}
                  className={`flex w-full items-center gap-3 rounded border p-3 text-left transition-all disabled:cursor-default ${
                    item.completado ? 'border-green-100 bg-green-50' : 'border-[var(--color-border)] active:border-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-all ${
                      item.completado ? 'border-green-600 bg-green-600' : 'border-slate-300'
                    }`}
                  >
                    {item.completado && <Check size={11} className="text-white" />}
                  </span>
                  <span className={`text-sm ${item.completado ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
                    {item.descripcion}
                  </span>
                </button>
              ))}
            </div>
          </Seccion>

          <Seccion titulo="Informe">
            <div className="space-y-3">
              {campoTexto('falla_detectada', 'Falla detectada')}
              {campoTexto('trabajo_realizado', 'Trabajo realizado')}
              {campoTexto('observaciones', 'Observaciones')}
              <label className="flex items-center gap-2.5 py-1 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  disabled={soloLectura}
                  checked={papeleta.causada_por_terceros}
                  onChange={(e) => actualizarPapeletaMutation.mutate({ causada_por_terceros: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                Falla causada por terceros
              </label>
            </div>
          </Seccion>

          <Seccion
            titulo="Piezas reemplazadas"
            extra={<span className="font-mono-brand text-xs text-[var(--color-text-muted)]">{papeleta.piezas.length}</span>}
          >
            {papeleta.piezas.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {papeleta.piezas.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded bg-[var(--color-bg-subtle)] py-2 pr-1 pl-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {p.nombre}
                      {p.marca && <span className="text-[var(--color-text-muted)]"> — {p.marca}</span>}
                    </span>
                    <span className={`font-mono-brand text-[10px] font-medium ${p.es_original ? 'text-green-700' : 'text-amber-600'}`}>
                      {p.es_original ? 'Original' : 'Alternativa'}
                    </span>
                    {!soloLectura && (
                      <button
                        onClick={() => eliminarPiezaMutation.mutate(p.id)}
                        disabled={eliminarPiezaMutation.isPending && eliminarPiezaMutation.variables === p.id}
                        aria-label={`Quitar ${p.nombre}`}
                        className="rounded p-1.5 text-[var(--color-text-muted)] active:bg-red-50 active:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!soloLectura && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (nuevaPieza.nombre.trim()) agregarPiezaMutation.mutate()
                }}
                className="space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    placeholder="Pieza (ej. contactor)"
                    value={nuevaPieza.nombre}
                    onChange={(e) => setNuevaPieza((p) => ({ ...p, nombre: e.target.value }))}
                    className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2.5 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  />
                  <input
                    placeholder="Marca"
                    value={nuevaPieza.marca}
                    onChange={(e) => setNuevaPieza((p) => ({ ...p, marca: e.target.value }))}
                    className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2.5 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                    <input
                      type="checkbox"
                      checked={nuevaPieza.esOriginal}
                      onChange={(e) => setNuevaPieza((p) => ({ ...p, esOriginal: e.target.checked }))}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    Repuesto original
                  </label>
                  <button
                    type="submit"
                    disabled={!nuevaPieza.nombre.trim() || agregarPiezaMutation.isPending}
                    className="rounded bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Agregar
                  </button>
                </div>
              </form>
            )}
            {soloLectura && papeleta.piezas.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">Sin piezas reemplazadas.</p>
            )}
          </Seccion>

          <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <EvidenciasPapeleta papeleta={papeleta} soloLectura={soloLectura} />
          </section>

          {papeleta.estado === 'borrador' && (
            <button
              onClick={() => enviarPapeletaMutation.mutate()}
              disabled={enviarPapeletaMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] py-3.5 text-base font-semibold text-white active:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {enviarPapeletaMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />}
              Enviar papeleta
            </button>
          )}
          {papeleta.estado === 'enviada' && (
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-700">
              <CheckCircle2 size={15} /> Papeleta enviada
            </p>
          )}
        </>
      )}

      {puedeCompletar && (
        <button
          onClick={() => completarMutation.mutate()}
          disabled={completarMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3.5 text-base font-semibold text-white active:bg-green-700 disabled:opacity-60"
        >
          {completarMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          Completar orden
        </button>
      )}
      {orden.estado === 'completado' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-800">
          Orden completada
          {orden.fin_real &&
            ` · ${new Date(orden.fin_real).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`}
        </div>
      )}
      {orden.estado === 'cancelado' && (
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-3 text-center text-sm text-[var(--color-text-muted)]">
          Orden cancelada por el operador
        </div>
      )}
    </div>
  )
}
