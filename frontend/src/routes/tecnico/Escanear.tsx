import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  ClipboardList,
  History,
  Keyboard,
  ScanLine,
  X,
} from 'lucide-react'
import { ApiError } from '../../api/client'
import { endpoints } from '../../api/endpoints'
import type { Ascensor } from '../../api/types'
import { Cargando, ErrorCarga } from '../../components/EstadosCarga'
import { extraerCodigoQr } from '../../domain/qr'
import {
  CATEGORIA_LABEL,
  ESTADO_EQUIPO_CFG,
  TIPO_EQUIPO_LABEL,
  TIPO_ORDEN_LABEL,
} from './etiquetas'
import { useMisOrdenes } from './hooks'
import {
  abrirCamaraTrasera,
  crearDecodificador,
  estadoDesdeError,
  type EstadoCamara,
} from './lectorQr'

const INTERVALO_LECTURA_MS = 200

function VistaCamara({
  titulo,
  onCodigo,
  onCerrar,
}: {
  titulo: string
  onCodigo: (codigo: string) => void
  onCerrar: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const disponible =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext
  const [estado, setEstado] = useState<EstadoCamara>(disponible ? 'iniciando' : 'no_disponible')
  const [aviso, setAviso] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [errorManual, setErrorManual] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const onCodigoRef = useRef(onCodigo)
  useEffect(() => {
    onCodigoRef.current = onCodigo
  })

  useEffect(() => {
    if (!disponible) return
    let stream: MediaStream | null = null
    let activo = true
    let timer = 0

    ;(async () => {
      try {
        stream = await abrirCamaraTrasera()
        if (!activo) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setEstado('activa')
        const decodificar = await crearDecodificador()
        const ciclo = async () => {
          if (!activo) return
          try {
            const texto = await decodificar(video)
            if (texto) {
              const codigo = extraerCodigoQr(texto)
              if (codigo) {
                navigator.vibrate?.(80)
                activo = false
                onCodigoRef.current(codigo)
                return
              }
              setAviso('Este QR no es de un equipo Facylitech')
            }
          } catch {
            // frame sin datos: se ignora
          }
          timer = window.setTimeout(ciclo, INTERVALO_LECTURA_MS)
        }
        ciclo()
      } catch (e) {
        const estadoError = await estadoDesdeError(e)
        if (activo) setEstado(estadoError)
      }
    })()

    return () => {
      activo = false
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [disponible, intento])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 2500)
    return () => window.clearTimeout(t)
  }, [aviso])

  function enviarManual(e: FormEvent) {
    e.preventDefault()
    const codigo = extraerCodigoQr(manual)
    if (!codigo) {
      setErrorManual('Código no válido. Ejemplo: FCY-B01-01A')
      return
    }
    onCodigo(codigo)
  }

  const MENSAJES: Partial<Record<EstadoCamara, { titulo: string; texto: string }>> = {
    denegada: {
      titulo: 'Permiso de cámara denegado',
      texto: 'Permite el acceso a la cámara para este sitio en los ajustes del navegador, o ingresa el código impreso bajo el QR.',
    },
    no_disponible: {
      titulo: 'Cámara no disponible',
      texto: 'Este navegador no permite usar la cámara aquí. Ingresa el código impreso bajo el QR.',
    },
    sin_camara: {
      titulo: 'No se encontró una cámara',
      texto: 'Ingresa el código impreso bajo el QR.',
    },
    error: {
      titulo: 'No se pudo abrir la cámara',
      texto: 'Puede que otra app la esté usando. Reintenta o ingresa el código a mano.',
    },
  }
  const problema = MENSAJES[estado]

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-[var(--color-navy)] text-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onCerrar} aria-label="Cerrar lector" className="-ml-1 rounded p-1.5 active:bg-white/10">
          <X size={20} />
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="text-[11px] text-slate-400">Apunta al QR pegado en la sala de máquinas o cabina</p>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${estado === 'activa' ? '' : 'invisible'}`}
        />
        {estado === 'activa' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-60 w-60 rounded-2xl shadow-[0_0_0_9999px_rgba(13,27,42,0.55)]">
              {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
                <span key={c} className={`absolute h-10 w-10 border-[var(--color-accent)] ${c}`} />
              ))}
              <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-[var(--color-accent)]/80" />
            </div>
          </div>
        )}
        {estado === 'iniciando' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-300">
            <Camera size={28} className="animate-pulse" />
            Abriendo cámara…
          </div>
        )}
        {problema && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <CameraOff size={34} className="mb-3 text-slate-400" />
            <p className="font-semibold">{problema.titulo}</p>
            <p className="mt-1 text-sm text-slate-300">{problema.texto}</p>
            {(estado === 'denegada' || estado === 'error') && (
              <button
                onClick={() => {
                  setEstado('iniciando')
                  setIntento((n) => n + 1)
                }}
                className="mt-4 rounded border border-white/30 px-4 py-2 text-sm font-medium active:bg-white/10"
              >
                Reintentar cámara
              </button>
            )}
          </div>
        )}
        {aviso && (
          <div className="absolute inset-x-6 bottom-4 rounded bg-amber-500 px-3 py-2 text-center text-sm font-medium text-white">
            {aviso}
          </div>
        )}
      </div>

      <form onSubmit={enviarManual} className="space-y-2 bg-[var(--color-navy)] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
          <Keyboard size={12} /> Ingresar código a mano
        </label>
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => {
              setManual(e.target.value)
              setErrorManual(null)
            }}
            placeholder="FCY-B01-01A"
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded border border-white/15 bg-white/10 px-3 py-2.5 font-mono-brand text-sm uppercase placeholder:text-slate-500 focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manual.trim()}
            className="rounded bg-[var(--color-accent)] px-4 text-sm font-semibold active:bg-[var(--color-accent-hover)] disabled:opacity-40"
          >
            Buscar
          </button>
        </div>
        {errorManual && <p className="text-xs text-amber-300">{errorManual}</p>}
      </form>
    </div>
  )
}

function FichaEquipo({ ascensor }: { ascensor: Ascensor }) {
  const bitacora = useQuery({
    queryKey: ['bitacora', ascensor.id],
    queryFn: () => endpoints.ascensores.bitacora(ascensor.id),
  })
  const estado = ESTADO_EQUIPO_CFG[ascensor.estado]
  const datos: [string, string][] = [
    ['Marca / modelo', [ascensor.marca, ascensor.modelo].filter(Boolean).join(' ') || '—'],
    ['Tipo', TIPO_EQUIPO_LABEL[ascensor.tipo_equipo]],
    ['Pisos', ascensor.pisos != null ? String(ascensor.pisos) : '—'],
    ['Instalación', ascensor.anio_instalacion != null ? String(ascensor.anio_instalacion) : '—'],
    ['Torre / N°', [ascensor.torre, ascensor.numero].filter(Boolean).join(' · ') || '—'],
    [
      'Última mantención',
      ascensor.ultima_mantencion
        ? new Date(ascensor.ultima_mantencion + 'T00:00:00').toLocaleDateString('es-CL', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '—',
    ],
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
              {CATEGORIA_LABEL[ascensor.categoria ?? 'ascensor']} · {ascensor.codigo_qr}
            </div>
            <div className="font-mono-brand text-2xl font-bold text-[var(--color-accent)]">{ascensor.codigo}</div>
            <div className="text-sm font-medium text-[var(--color-text)]">{ascensor.edificio?.nombre}</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {ascensor.edificio?.direccion}
              {ascensor.edificio?.comuna && `, ${ascensor.edificio.comuna}`}
            </div>
          </div>
          <span className={`flex flex-shrink-0 items-center gap-1.5 font-mono-brand text-xs ${estado.color}`}>
            <span className={`h-2 w-2 rounded-full ${estado.dot}`} />
            {estado.label}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-[var(--color-bg-subtle)] pt-3">
          {datos.map(([l, v]) => (
            <div key={l}>
              <dt className="text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">{l}</dt>
              <dd className="font-mono-brand text-xs font-medium text-[var(--color-text)]">{v}</dd>
            </div>
          ))}
        </dl>
        {ascensor.manas && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span className="font-semibold">Mañas del equipo: </span>
            {ascensor.manas}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white p-3 text-xs text-[var(--color-text-muted)]">
        No tienes órdenes abiertas para este equipo. Si debes intervenirlo, avísale al operador desde
        Mensajes.
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
          <History size={12} /> Bitácora reciente
        </h2>
        {bitacora.isLoading && <Cargando filas={2} />}
        {bitacora.isError && <ErrorCarga error={bitacora.error} onReintentar={() => bitacora.refetch()} />}
        {bitacora.data && bitacora.data.length === 0 && (
          <p className="rounded-lg border border-[var(--color-border)] bg-white p-4 text-center text-sm text-[var(--color-text-muted)]">
            Sin intervenciones registradas.
          </p>
        )}
        <div className="space-y-2">
          {bitacora.data?.slice(0, 4).map((b) => (
            <div key={b.orden_codigo} className="rounded-lg border border-[var(--color-border)] bg-white p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono-brand text-xs font-semibold text-[var(--color-accent)]">{b.orden_codigo}</span>
                <span className="font-mono-brand text-[10px] text-[var(--color-text-muted)]">
                  {new Date(b.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="text-sm font-medium text-[var(--color-text)]">
                {TIPO_ORDEN_LABEL[b.tipo]}
                {b.tecnico_nombre && <span className="font-normal text-[var(--color-text-muted)]"> · {b.tecnico_nombre}</span>}
              </div>
              {(b.trabajo_realizado || b.falla_detectada || b.descripcion) && (
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {b.trabajo_realizado ?? b.falla_detectada ?? b.descripcion}
                </p>
              )}
              {b.piezas.length > 0 && (
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  Piezas: {b.piezas.map((p) => p.nombre).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Resultado({
  codigo,
  verificarId,
  ordenVerificar,
  onOtraVez,
}: {
  codigo: string
  verificarId: string | null
  ordenVerificar: string | null
  onOtraVez: () => void
}) {
  const navigate = useNavigate()
  const misOrdenes = useMisOrdenes()
  const consulta = useQuery({
    queryKey: ['ascensor', 'qr', codigo],
    queryFn: () => endpoints.ascensores.porQr(codigo),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  })
  const asc = consulta.data
  const otAbierta =
    asc && !verificarId
      ? misOrdenes.data?.items.find(
          (o) => o.ascensor.id === asc.id && (o.estado === 'en_curso' || o.estado === 'programado'),
        )
      : undefined

  useEffect(() => {
    if (otAbierta) navigate(`/tecnico/ordenes/${otAbierta.id}`, { replace: true })
  }, [otAbierta, navigate])

  const pie = (
    <button
      onClick={onOtraVez}
      className="flex w-full items-center justify-center gap-2 rounded border border-[var(--color-border)] bg-white py-3 text-sm font-semibold text-[var(--color-text)] active:bg-[var(--color-bg)]"
    >
      <ScanLine size={16} /> Escanear otro código
    </button>
  )

  if (consulta.isLoading || (asc && !verificarId && misOrdenes.isLoading) || otAbierta)
    return <Cargando filas={2} texto={`Buscando ${codigo}…`} />

  if (consulta.isError) {
    const noExiste = consulta.error instanceof ApiError && consulta.error.status === 404
    return (
      <div className="space-y-4">
        {noExiste ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
            <AlertTriangle size={28} className="mx-auto mb-2 text-amber-500" />
            <p className="font-semibold text-amber-900">Código no registrado</p>
            <p className="mt-1 text-sm text-amber-800">
              <span className="font-mono-brand">{codigo}</span> no corresponde a ningún equipo. Revisa la
              etiqueta o avisa al operador.
            </p>
          </div>
        ) : (
          <ErrorCarga error={consulta.error} onReintentar={() => consulta.refetch()} />
        )}
        {pie}
      </div>
    )
  }

  if (!asc) return null

  if (verificarId) {
    const coincide = asc.id === verificarId
    return (
      <div className="space-y-4">
        <div
          className={`rounded-lg border p-5 text-center ${coincide ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}
        >
          {coincide ? (
            <CheckCircle2 size={40} className="mx-auto mb-2 text-green-600" />
          ) : (
            <AlertTriangle size={40} className="mx-auto mb-2 text-amber-500" />
          )}
          <p className={`text-lg font-bold ${coincide ? 'text-green-800' : 'text-amber-900'}`}>
            {coincide ? 'Equipo verificado' : 'No es el equipo de la orden'}
          </p>
          <p className={`mt-1 text-sm ${coincide ? 'text-green-800' : 'text-amber-800'}`}>
            {coincide
              ? `${asc.codigo} · ${asc.edificio?.nombre ?? ''} coincide con la orden.`
              : `Este QR es de ${asc.codigo} (${asc.edificio?.nombre ?? 'otro edificio'}).`}
          </p>
        </div>
        {ordenVerificar && (
          <Link
            to={`/tecnico/ordenes/${ordenVerificar}`}
            replace
            className="flex w-full items-center justify-center gap-2 rounded bg-[var(--color-navy)] py-3 text-sm font-semibold text-white"
          >
            <ClipboardList size={16} /> Volver a la orden
          </Link>
        )}
        {!coincide && pie}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <FichaEquipo ascensor={asc} />
      {pie}
    </div>
  )
}

export function Escanear() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const verificarId = params.get('verificar')
  const ordenVerificar = params.get('orden')
  const [codigo, setCodigo] = useState<string | null>(params.get('codigo'))

  const cerrar = () => {
    if (ordenVerificar) navigate(`/tecnico/ordenes/${ordenVerificar}`, { replace: true })
    else if (window.history.length > 1) navigate(-1)
    else navigate('/tecnico/agenda')
  }

  if (!codigo)
    return (
      <VistaCamara
        titulo={verificarId ? 'Verificar equipo' : 'Escanear equipo'}
        onCodigo={setCodigo}
        onCerrar={cerrar}
      />
    )

  return (
    <div className="space-y-4 p-4">
      <button
        onClick={cerrar}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
      >
        <ArrowLeft size={13} /> Volver
      </button>
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {verificarId ? 'Verificación de equipo' : 'Equipo escaneado'}
        </h1>
        <p className="font-mono-brand text-sm text-[var(--color-text-muted)]">{codigo}</p>
      </div>
      <Resultado
        codigo={codigo}
        verificarId={verificarId}
        ordenVerificar={ordenVerificar}
        onOtraVez={() => setCodigo(null)}
      />
    </div>
  )
}
