import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  ClipboardList,
  MessageSquare,
  RotateCw,
  Search,
  Send,
  X,
} from 'lucide-react'
import { endpoints } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import type { Conversacion, Mensaje, OrdenTrabajo } from '../../api/types'
import { diaLocal, etiquetaDia, formatoHora, formatoMarcaChat } from '../../domain/tiempo'
import { useAhora } from '../../lib/red'
import { Cargando, ErrorCarga, Vacio } from '../EstadosCarga'
import {
  INTERVALO_HILO_MS,
  claveConversaciones,
  claveHilo,
  useConversaciones,
} from './useMensajes'

type Modo = 'movil' | 'escritorio'

interface Pendiente {
  idLocal: string
  texto: string
  orden_trabajo_id: string | null
  estado: 'enviando' | 'error'
}

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({
  nombre,
  rol,
  chico,
  sobreOscuro,
}: {
  nombre: string
  rol: string
  chico?: boolean
  sobreOscuro?: boolean
}) {
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded font-mono-brand font-bold ${
        chico ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs'
      } ${
        sobreOscuro
          ? 'bg-white/10 text-white ring-1 ring-white/20'
          : rol === 'operador'
          ? 'bg-[var(--color-navy)] text-white'
          : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
      }`}
    >
      {iniciales(nombre)}
    </div>
  )
}

const ROL_CHIP: Record<string, string> = {
  operador: 'bg-blue-50 text-blue-700',
  tecnico: 'bg-amber-50 text-amber-700',
}

/** Chip con la OT referenciada; busca el código en caché/servidor. */
function ChipOrden({
  ordenId,
  enlace,
  claro,
}: {
  ordenId: string
  enlace: string | null
  claro?: boolean
}) {
  const { data } = useQuery({
    queryKey: ['orden', ordenId],
    queryFn: () => endpoints.ordenes.obtener(ordenId),
    staleTime: 5 * 60_000,
  })
  const contenido = (
    <span
      className={`mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium ${
        claro ? 'bg-white/10 text-white' : 'bg-white text-[var(--color-text)] ring-1 ring-[var(--color-border)]'
      }`}
    >
      <ClipboardList size={11} className="flex-shrink-0 text-[var(--color-accent)]" />
      <span className="font-mono-brand">{data?.codigo ?? 'Orden de trabajo'}</span>
      {data && (
        <span className="truncate opacity-70">
          · {data.ascensor.codigo} · {data.ascensor.edificio.nombre}
        </span>
      )}
    </span>
  )
  return enlace ? <Link to={enlace}>{contenido}</Link> : contenido
}

function ItemConversacion({
  c,
  activo,
  ahora,
  onClick,
}: {
  c: Conversacion
  activo: boolean
  ahora: Date
  onClick: () => void
}) {
  const ultimo = c.ultimo_mensaje
  const deMi = ultimo && ultimo.remitente.id !== c.contraparte.id
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-[var(--color-bg-subtle)] px-4 py-3 text-left transition-colors ${
        activo ? 'bg-[var(--color-bg)]' : 'bg-white hover:bg-[var(--color-bg-subtle)] active:bg-[var(--color-bg)]'
      }`}
    >
      <Avatar nombre={c.contraparte.nombre} rol={c.contraparte.rol} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${c.no_leidos > 0 ? 'font-semibold text-[var(--color-text)]' : 'font-medium text-[var(--color-text)]'}`}
          >
            {c.contraparte.nombre}
          </span>
          {ultimo && (
            <span
              className={`flex-shrink-0 font-mono-brand text-[10px] ${c.no_leidos > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
            >
              {formatoMarcaChat(ultimo.created_at, ahora)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className={`min-w-0 flex-1 truncate text-xs ${c.no_leidos > 0 ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {ultimo ? (
              <>
                {deMi && 'Tú: '}
                {ultimo.texto}
              </>
            ) : (
              <span className="italic">Sin mensajes — inicia la conversación</span>
            )}
          </span>
          {c.no_leidos > 0 ? (
            <span className="flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white">
              {c.no_leidos}
            </span>
          ) : (
            <span
              className={`flex-shrink-0 rounded px-1.5 py-0.5 font-mono-brand text-[9px] capitalize ${ROL_CHIP[c.contraparte.rol]}`}
            >
              {c.contraparte.rol === 'tecnico' ? 'técnico' : 'operador'}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function Hilo({
  modo,
  conversacion,
  ordenInicial,
  onVolver,
  rutaOrden,
}: {
  modo: Modo
  conversacion: Conversacion
  ordenInicial: string | null
  onVolver: () => void
  rutaOrden?: (id: string) => string | null
}) {
  const { usuario } = useAuth()
  const yo = usuario!.id
  const contraparte = conversacion.contraparte
  const queryClient = useQueryClient()
  const ahora = useAhora(60_000)
  const [texto, setTexto] = useState('')
  const [ordenRef, setOrdenRef] = useState<string | null>(ordenInicial)
  const [mostrarSelector, setMostrarSelector] = useState(false)
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const finRef = useRef<HTMLDivElement>(null)
  const ultimoMarcado = useRef<string | null>(null)

  const hilo = useQuery({
    queryKey: claveHilo(yo, contraparte.id),
    queryFn: () => endpoints.mensajes.hilo(yo, contraparte.id),
    refetchInterval: INTERVALO_HILO_MS,
  })
  const mensajes = useMemo(() => hilo.data ?? [], [hilo.data])

  // OTs para referenciar: las del técnico de la conversación (yo, o la contraparte si soy operador).
  const tecnicoId = usuario!.rol === 'tecnico' ? yo : contraparte.rol === 'tecnico' ? contraparte.id : null
  const ordenesTecnico = useQuery({
    queryKey: ['ordenes', 'tecnico', tecnicoId],
    queryFn: () => endpoints.ordenes.listar({ tecnico_id: tecnicoId!, limit: 100 }),
    enabled: !!tecnicoId && mostrarSelector,
    staleTime: 30_000,
  })
  const opcionesOrden: OrdenTrabajo[] = useMemo(() => {
    const items = ordenesTecnico.data?.items ?? []
    const abiertas = items.filter((o) => o.estado === 'programado' || o.estado === 'en_curso')
    const recientes = items
      .filter((o) => o.estado === 'completado')
      .sort((a, b) => b.fecha_programada.localeCompare(a.fecha_programada))
      .slice(0, 5)
    return [
      ...abiertas.sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada)),
      ...recientes,
    ]
  }, [ordenesTecnico.data])

  const marcarLeidos = useMutation({
    mutationFn: () => endpoints.mensajes.marcarLeidos(yo, contraparte.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claveConversaciones(yo) }),
  })

  // Marcar leídos al abrir y cada vez que llega algo nuevo sin leer.
  useEffect(() => {
    const sinLeer = mensajes.filter((m) => m.destinatario.id === yo && !m.leido_at)
    const ultimo = sinLeer[sinLeer.length - 1]
    if (ultimo && ultimoMarcado.current !== ultimo.id) {
      ultimoMarcado.current = ultimo.id
      marcarLeidos.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes, yo])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length, pendientes.length])

  const enviar = useMutation({
    mutationFn: (p: Pendiente) =>
      endpoints.mensajes.enviar({
        remitente_id: yo,
        destinatario_id: contraparte.id,
        texto: p.texto,
        orden_trabajo_id: p.orden_trabajo_id,
      }),
    onSuccess: (msg, p) => {
      queryClient.setQueryData<Mensaje[]>(claveHilo(yo, contraparte.id), (prev) =>
        prev && !prev.some((m) => m.id === msg.id) ? [...prev, msg] : prev,
      )
      setPendientes((prev) => prev.filter((x) => x.idLocal !== p.idLocal))
      queryClient.invalidateQueries({ queryKey: claveConversaciones(yo) })
    },
    onError: (_e, p) =>
      setPendientes((prev) =>
        prev.map((x) => (x.idLocal === p.idLocal ? { ...x, estado: 'error' } : x)),
      ),
  })

  function despachar() {
    const limpio = texto.trim()
    if (!limpio) return
    const p: Pendiente = {
      idLocal: crypto.randomUUID(),
      texto: limpio,
      orden_trabajo_id: ordenRef,
      estado: 'enviando',
    }
    setPendientes((prev) => [...prev, p])
    setTexto('')
    setOrdenRef(null)
    setMostrarSelector(false)
    enviar.mutate(p)
  }

  function reintentar(p: Pendiente) {
    setPendientes((prev) =>
      prev.map((x) => (x.idLocal === p.idLocal ? { ...x, estado: 'enviando' } : x)),
    )
    enviar.mutate({ ...p, estado: 'enviando' })
  }

  // Separadores por día.
  const bloques: { dia: string; mensajes: Mensaje[] }[] = []
  for (const m of mensajes) {
    const dia = diaLocal(m.created_at)
    const actual = bloques[bloques.length - 1]
    if (actual && actual.dia === dia) actual.mensajes.push(m)
    else bloques.push({ dia, mensajes: [m] })
  }

  const contenedor =
    modo === 'movil'
      ? 'fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-white'
      : 'flex min-w-0 flex-1 flex-col'

  return (
    <div className={contenedor}>
      <div
        className={`flex flex-shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-4 ${
          modo === 'movil' ? 'bg-[var(--color-navy)] py-2.5 text-white' : 'py-3.5'
        }`}
      >
        {modo === 'movil' && (
          <button onClick={onVolver} aria-label="Volver" className="-ml-1 rounded p-1.5 active:bg-white/10">
            <ArrowLeft size={18} />
          </button>
        )}
        <Avatar nombre={contraparte.nombre} rol={contraparte.rol} chico sobreOscuro={modo === 'movil'} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-semibold ${modo === 'movil' ? '' : 'text-[var(--color-text)]'}`}>
            {contraparte.nombre}
          </div>
          <div
            className={`font-mono-brand text-[10px] ${modo === 'movil' ? 'text-slate-400' : 'text-[var(--color-text-muted)]'}`}
          >
            {contraparte.rol === 'tecnico' ? 'Técnico' : 'Operador'} · actualiza cada 5 s
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--color-bg-subtle)] px-4 py-4">
        {hilo.isLoading && <Cargando filas={2} />}
        {hilo.isError && !hilo.data && (
          <ErrorCarga error={hilo.error} onReintentar={() => hilo.refetch()} />
        )}
        {hilo.data && mensajes.length === 0 && pendientes.length === 0 && (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            <MessageSquare size={28} className="mx-auto mb-2 text-slate-300" />
            Escribe el primer mensaje a {contraparte.nombre.split(' ')[0]}.
          </div>
        )}
        {bloques.map((b) => (
          <div key={b.dia} className="space-y-2">
            <div className="flex justify-center">
              <span className="rounded bg-white px-2 py-0.5 font-mono-brand text-[10px] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]">
                {etiquetaDia(b.dia, ahora)}
              </span>
            </div>
            {b.mensajes.map((m) => {
              const mio = m.remitente.id === yo
              return (
                <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      mio
                        ? 'rounded-br-sm bg-[var(--color-navy)] text-white'
                        : 'rounded-bl-sm bg-white text-[var(--color-text)] ring-1 ring-[var(--color-border)]'
                    }`}
                  >
                    {m.orden_trabajo_id && (
                      <div>
                        <ChipOrden
                          ordenId={m.orden_trabajo_id}
                          enlace={rutaOrden?.(m.orden_trabajo_id) ?? null}
                          claro={mio}
                        />
                      </div>
                    )}
                    <p className="break-words whitespace-pre-wrap">{m.texto}</p>
                    <div
                      className={`mt-0.5 flex items-center justify-end gap-1 font-mono-brand text-[10px] ${mio ? 'text-slate-400' : 'text-[var(--color-text-muted)]'}`}
                    >
                      {formatoHora(m.created_at)}
                      {mio &&
                        (m.leido_at ? (
                          <CheckCheck size={12} className="text-[var(--color-accent)]" aria-label="Leído" />
                        ) : (
                          <Check size={12} aria-label="Enviado" />
                        ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {pendientes.map((p) => (
          <div key={p.idLocal} className="flex justify-end">
            <div
              className={`max-w-[80%] rounded-lg rounded-br-sm px-3 py-2 text-sm text-white ${
                p.estado === 'error' ? 'bg-red-700' : 'bg-[var(--color-navy)] opacity-70'
              }`}
            >
              {p.orden_trabajo_id && (
                <div>
                  <ChipOrden ordenId={p.orden_trabajo_id} enlace={null} claro />
                </div>
              )}
              <p className="break-words whitespace-pre-wrap">{p.texto}</p>
              <div className="mt-1 flex items-center justify-end gap-2 text-[10px]">
                {p.estado === 'enviando' ? (
                  <span className="font-mono-brand text-slate-300">Enviando…</span>
                ) : (
                  <>
                    <span className="flex items-center gap-1">
                      <AlertCircle size={11} /> No enviado
                    </span>
                    <button
                      onClick={() => reintentar(p)}
                      className="flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 font-semibold"
                    >
                      <RotateCw size={10} /> Reintentar
                    </button>
                    <button
                      onClick={() => setPendientes((prev) => prev.filter((x) => x.idLocal !== p.idLocal))}
                      aria-label="Descartar"
                      className="rounded bg-white/20 p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      {mostrarSelector && tecnicoId && (
        <div className="max-h-56 flex-shrink-0 overflow-y-auto border-t border-[var(--color-border)] bg-white">
          <div className="sticky top-0 flex items-center justify-between bg-white px-4 py-2">
            <span className="text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
              Referenciar una orden
            </span>
            <button onClick={() => setMostrarSelector(false)} aria-label="Cerrar" className="p-1 text-[var(--color-text-muted)]">
              <X size={14} />
            </button>
          </div>
          {ordenesTecnico.isLoading && (
            <p className="px-4 pb-3 text-xs text-[var(--color-text-muted)]">Cargando órdenes…</p>
          )}
          {ordenesTecnico.data && opcionesOrden.length === 0 && (
            <p className="px-4 pb-3 text-xs text-[var(--color-text-muted)]">No hay órdenes para referenciar.</p>
          )}
          {opcionesOrden.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setOrdenRef(o.id)
                setMostrarSelector(false)
              }}
              className="flex w-full items-center gap-3 border-t border-[var(--color-bg-subtle)] px-4 py-2.5 text-left active:bg-[var(--color-bg)]"
            >
              <span className="font-mono-brand text-xs font-semibold text-[var(--color-accent)]">{o.codigo}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text)]">
                {o.ascensor.codigo} · {o.ascensor.edificio.nombre}
              </span>
              <span className="font-mono-brand text-[10px] text-[var(--color-text-muted)]">
                {new Date(o.fecha_programada).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-shrink-0 border-t border-[var(--color-border)] bg-white px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {ordenRef && (
          <div className="mb-2 flex items-center gap-2">
            <ChipOrden ordenId={ordenRef} enlace={null} />
            <button onClick={() => setOrdenRef(null)} aria-label="Quitar referencia" className="mb-1.5 p-1 text-[var(--color-text-muted)]">
              <X size={13} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {tecnicoId && (
            <button
              onClick={() => setMostrarSelector((v) => !v)}
              aria-label="Referenciar una orden de trabajo"
              title="Referenciar una orden de trabajo"
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                mostrarSelector || ordenRef
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
            >
              <ClipboardList size={16} />
            </button>
          )}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && modo === 'escritorio') {
                e.preventDefault()
                despachar()
              }
            }}
            rows={1}
            placeholder="Escribe un mensaje…"
            className="max-h-28 min-h-10 flex-1 resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm [field-sizing:content] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            onClick={despachar}
            disabled={!texto.trim()}
            aria-label="Enviar"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-[var(--color-accent)] text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Mensajería simple (REST + polling, sin WebSockets) compartida por operador y técnico.
 * - `movil`: lista → hilo a pantalla completa (técnico, PWA).
 * - `escritorio`: dos columnas (operador).
 * El hilo abierto vive en `?con=<usuarioId>`; `?orden=<otId>` precarga una referencia a una OT.
 */
export function Mensajeria({
  modo,
  rutaOrden,
}: {
  modo: Modo
  rutaOrden?: (ordenId: string) => string | null
}) {
  const { usuario } = useAuth()
  const [params, setParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const ahora = useAhora(60_000)
  const conversaciones = useConversaciones(usuario?.id)

  const seleccionadoId = params.get('con')
  const ordenInicial = params.get('orden')
  const lista = conversaciones.data ?? []
  const seleccionada = lista.find((c) => c.contraparte.id === seleccionadoId) ?? null

  const filtradas = lista.filter((c) =>
    c.contraparte.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()),
  )
  const totalNoLeidos = lista.reduce((t, c) => t + c.no_leidos, 0)

  function abrir(id: string) {
    const nuevos = new URLSearchParams(params)
    nuevos.set('con', id)
    setParams(nuevos, { replace: modo === 'escritorio' })
  }
  function cerrar() {
    const nuevos = new URLSearchParams(params)
    nuevos.delete('con')
    nuevos.delete('orden')
    setParams(nuevos)
  }

  // En el celular el técnico suele tener 1-2 contrapartes: la búsqueda solo aparece si sirve.
  const conBusqueda = modo === 'escritorio' || lista.length > 5
  const panelLista = (
    <>
      {conBusqueda && (
      <div className="flex-shrink-0 border-b border-[var(--color-border)] p-3">
        <div className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2">
          <Search size={14} className="text-[var(--color-text-muted)]" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar persona…"
            className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>
      </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {conversaciones.isLoading && (
          <div className="p-4">
            <Cargando filas={3} />
          </div>
        )}
        {conversaciones.isError && !conversaciones.data && (
          <div className="p-4">
            <ErrorCarga error={conversaciones.error} onReintentar={() => conversaciones.refetch()} />
          </div>
        )}
        {conversaciones.data && filtradas.length === 0 && (
          <div className="p-4">
            <Vacio
              icono={<MessageSquare size={28} />}
              titulo={busqueda ? 'Sin resultados' : 'Sin conversaciones'}
              texto={busqueda ? `Nadie coincide con “${busqueda}”.` : 'Aún no hay con quién conversar.'}
            />
          </div>
        )}
        {filtradas.map((c) => (
          <ItemConversacion
            key={c.contraparte.id}
            c={c}
            activo={c.contraparte.id === seleccionadoId}
            ahora={ahora}
            onClick={() => abrir(c.contraparte.id)}
          />
        ))}
      </div>
    </>
  )

  if (modo === 'movil') {
    return (
      <div className="flex min-h-full flex-col">
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Mensajes</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {totalNoLeidos > 0
              ? `${totalNoLeidos} sin leer`
              : 'Comunicación con la central de operaciones'}
          </p>
        </div>
        <div className="flex flex-1 flex-col border-t border-[var(--color-border)] bg-white">{panelLista}</div>
        {seleccionada && usuario && (
          <Hilo
            key={seleccionada.contraparte.id}
            modo="movil"
            conversacion={seleccionada}
            ordenInicial={ordenInicial}
            onVolver={cerrar}
            rutaOrden={rutaOrden}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 p-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Mensajes</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Comunicación interna con el equipo técnico
          {totalNoLeidos > 0 && ` · ${totalNoLeidos} sin leer`}
        </p>
      </div>
      <div className="flex min-h-[460px] flex-1 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
        <div className="flex w-80 flex-shrink-0 flex-col border-r border-[var(--color-border)]">{panelLista}</div>
        {seleccionada && usuario ? (
          <Hilo
            key={seleccionada.contraparte.id}
            modo="escritorio"
            conversacion={seleccionada}
            ordenInicial={ordenInicial}
            onVolver={cerrar}
            rutaOrden={rutaOrden}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
            <MessageSquare size={32} className="text-slate-300" />
            Selecciona una conversación
          </div>
        )}
      </div>
    </div>
  )
}
