import { mensajeError } from '../comun/errores'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Pencil, Plus } from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type { Ascensor, EstadoAscensor, OrdenTrabajo } from '../../../api/types'
import { categoriaDe } from '../../../domain/equipos'
import { ordenarListado } from '../../../domain/ordenamiento'
import { fechaIsoLocal, sumarDias } from '../../../domain/semana'
import {
  CATEGORIA_CFG,
  ESTADOS_EQUIPO,
  ESTADO_EQUIPO,
  TIPO_EQUIPO_LABEL,
  TIPO_OT_CLASS,
  TIPO_OT_LABEL,
  fmtFecha,
} from '../comun/etiquetas'
import { claves, useJerarquia, useOrdenes } from '../comun/consultas'
import { NuevaOrdenModal } from '../comun/NuevaOrdenModal'
import { OrdenPanel } from '../comun/OrdenPanel'
import {
  AvisoError,
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  CLASE_TARJETA,
  CLASE_TITULO_TARJETA,
  Campo,
  Cargando,
  ErrorVista,
  Vacio
} from '../comun/ui'
import { EtiquetaQr } from './EtiquetaQr'
import { Migas } from './piezas'
import { ListaProximasOts } from './ProximasOts'

type Pestana = 'resumen' | 'bitacora' | 'qr'

export function FichaEquipo() {
  const { id } = useParams<{ id: string }>()
  const j = useJerarquia()
  const [tab, setTab] = useState<Pestana>('resumen')
  const [nuevaOt, setNuevaOt] = useState(false)
  const [ordenAbierta, setOrdenAbierta] = useState<OrdenTrabajo | null>(null)

  const equipo = j.equipos.find((e) => e.id === id)
  const edificio = equipo ? j.edificioPorId.get(equipo.edificio_id) : undefined
  const admin = edificio ? j.adminPorId.get(edificio.administracion_id) : undefined
  const cliente = admin ? j.clientePorId.get(admin.cliente_id) : undefined

  const bitacora = useQuery({
    queryKey: ['bitacora', id],
    queryFn: () => endpoints.ascensores.bitacora(id!),
    enabled: !!id,
  })
  const hoy = fechaIsoLocal(new Date())
  const ordenes = useOrdenes(
    { desde: sumarDias(hoy, -60), hasta: sumarDias(hoy, 120), edificio_id: equipo?.edificio_id },
    !!equipo,
  )
  const proximas = ordenarListado(
    (ordenes.data ?? []).filter(
      (o) => o.ascensor.id === id && (o.estado === 'programado' || o.estado === 'en_curso'),
    ),
  )

  if (j.error) return <div className="p-8"><ErrorVista error={j.error} onReintentar={j.reintentar} /></div>
  if (j.isLoading) return <Cargando texto="Cargando equipo…" />
  if (!equipo)
    return (
      <div className="space-y-4 p-8">
        <Link to="/operador/ascensores" className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft size={13} /> Volver a Ascensores
        </Link>
        <Vacio titulo="Equipo no encontrado" />
      </div>
    )

  const est = ESTADO_EQUIPO[equipo.estado]
  const cat = CATEGORIA_CFG[categoriaDe(equipo)]
  const entradas = bitacora.data ?? []
  const piezasMixtas = entradas.some((l) => l.piezas.some((p) => !p.es_original))

  return (
    <div className="space-y-5 p-8">
      <Migas
        items={[
          { label: 'Clientes', to: '/operador/ascensores' },
          ...(cliente ? [{ label: cliente.nombre, to: `/operador/ascensores?cliente=${cliente.id}` }] : []),
          ...(edificio ? [{ label: edificio.nombre, to: `/operador/ascensores/edificios/${edificio.id}` }] : []),
          { label: equipo.codigo },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <span className="font-mono-brand text-lg font-bold text-[var(--color-accent)]">{equipo.codigo}</span>
            <div className={`flex items-center gap-1.5 rounded px-2 py-0.5 font-mono-brand text-xs ${est.color} ${est.bg}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${est.dot}`} />
              {est.label}
            </div>
            <span className="flex items-center gap-1 rounded bg-[var(--color-bg-subtle)] px-2 py-0.5 font-mono-brand text-xs text-gray-700">
              {cat.icono} {cat.label}
            </span>
            {piezasMixtas && (
              <span className="rounded bg-purple-50 px-2 py-0.5 font-mono-brand text-xs text-purple-700">Piezas mixtas</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            {edificio?.nombre ?? 'Edificio'} — {[equipo.marca, equipo.modelo].filter(Boolean).join(' ') || cat.label}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {[
              edificio?.direccion,
              equipo.torre,
              equipo.anio_instalacion && `Instalado ${equipo.anio_instalacion}`,
              equipo.pisos && `${equipo.pisos} pisos`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button onClick={() => setNuevaOt(true)} className={CLASE_BOTON_PRIMARIO}>
          <Plus size={14} /> Nueva OT para este equipo
        </button>
      </div>

      <div className="flex gap-2">
        {(['resumen', 'bitacora', 'qr'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-4 py-2 text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-[var(--color-navy)] text-white'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-slate-300'
            }`}
          >
            {t === 'resumen' ? 'Resumen' : t === 'bitacora' ? `Bitácora${bitacora.data ? ` (${entradas.length})` : ''}` : 'QR / ID'}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <FichaTecnica key={equipo.id} equipo={equipo} piezasMixtas={piezasMixtas} />
          </div>
          <div className="space-y-5">
            <TarjetaEstado key={`estado-${equipo.id}`} equipo={equipo} />
            <div className={`${CLASE_TARJETA} overflow-hidden`}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className={CLASE_TITULO_TARJETA}>Próximas OTs</h3>
                <button
                  onClick={() => setNuevaOt(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                >
                  <Plus size={12} /> Nueva OT
                </button>
              </div>
              <div className="border-t border-[var(--color-border)]/60">
                <ListaProximasOts
                  ordenes={proximas}
                  isLoading={ordenes.isLoading}
                  error={ordenes.error}
                  onAbrir={setOrdenAbierta}
                  vacio="Sin OTs pendientes para este equipo."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'bitacora' &&
        (bitacora.isLoading ? (
          <Cargando texto="Cargando bitácora…" />
        ) : bitacora.error ? (
          <ErrorVista error={bitacora.error} onReintentar={() => bitacora.refetch()} />
        ) : entradas.length === 0 ? (
          <Vacio titulo="Sin registros en bitácora" detalle="Las OTs completadas de este equipo aparecerán aquí con su papeleta y piezas." />
        ) : (
          <div className="space-y-3">
            {entradas.map((entrada) => (
              <div key={entrada.orden_codigo} className={`${CLASE_TARJETA} p-5`}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">{fmtFecha(entrada.fecha)}</span>
                  <span className={`rounded px-2 py-0.5 font-mono-brand text-xs ${TIPO_OT_CLASS[entrada.tipo]}`}>
                    {TIPO_OT_LABEL[entrada.tipo]}
                  </span>
                  <span className="font-mono-brand text-xs text-[var(--color-accent)]">{entrada.orden_codigo}</span>
                </div>
                {entrada.descripcion && <div className="text-sm text-gray-700">{entrada.descripcion}</div>}
                {(entrada.falla_detectada || entrada.trabajo_realizado) && (
                  <dl className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                    {entrada.falla_detectada && (
                      <div>
                        <dt className="font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">Falla detectada</dt>
                        <dd className="text-gray-700">{entrada.falla_detectada}</dd>
                      </div>
                    )}
                    {entrada.trabajo_realizado && (
                      <div>
                        <dt className="font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">Trabajo realizado</dt>
                        <dd className="text-gray-700">{entrada.trabajo_realizado}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">Técnico: {entrada.tecnico_nombre ?? '—'}</div>
                {entrada.piezas.length > 0 && (
                  <div className="mt-3 border-t border-[var(--color-border)]/60 pt-3">
                    <div className="mb-2 font-mono-brand text-xs tracking-widest text-[var(--color-text-muted)] uppercase">Piezas reemplazadas</div>
                    <div className="space-y-1.5">
                      {entrada.piezas.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">{p.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-brand text-[var(--color-text-muted)]">{p.marca ?? '—'}</span>
                            <span className={`rounded px-1.5 py-0.5 ${p.es_original ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'}`}>
                              {p.es_original ? 'Original' : '3° parte'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

      {tab === 'qr' && <EtiquetaQr equipo={equipo} edificio={edificio} />}

      {nuevaOt && (
        <NuevaOrdenModal
          inicial={{ edificioId: equipo.edificio_id, ascensorId: equipo.id }}
          onCerrar={() => setNuevaOt(false)}
        />
      )}
      {ordenAbierta && (
        <OrdenPanel key={ordenAbierta.id} orden={ordenAbierta} onCerrar={() => setOrdenAbierta(null)} />
      )}
    </div>
  )
}

function useActualizarEquipo(id: string, onOk: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: Partial<Ascensor>) => endpoints.ascensores.actualizar(id, datos),
    onSuccess: async (actualizado) => {
      qc.setQueryData<Ascensor[]>(claves.equipos, (prev) =>
        prev?.map((e) => (e.id === id ? { ...e, ...actualizado } : e)),
      )
      await qc.invalidateQueries({ queryKey: claves.equipos })
      onOk()
    },
  })
}

function Dato({ label, children, destacado }: { label: string; children: ReactNode; destacado?: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className={`text-right font-medium ${destacado ?? 'text-[var(--color-text)]'}`}>{children}</dd>
    </div>
  )
}

function Ok({ visible }: { visible: boolean }) {
  return visible ? (
    <span className="flex items-center gap-1 text-xs text-green-700">
      <CheckCircle2 size={13} /> Guardado
    </span>
  ) : null
}

function FichaTecnica({ equipo, piezasMixtas }: { equipo: Ascensor; piezasMixtas: boolean }) {
  const [editando, setEditando] = useState(false)
  const [ok, setOk] = useState(false)
  const inicial = () => ({
    marca: equipo.marca ?? '',
    modelo: equipo.modelo ?? '',
    anio_instalacion: equipo.anio_instalacion?.toString() ?? '',
    pisos: equipo.pisos?.toString() ?? '',
    torre: equipo.torre ?? '',
    numero: equipo.numero ?? '',
    manas: equipo.manas ?? '',
  })
  const [form, setForm] = useState(inicial)
  const mut = useActualizarEquipo(equipo.id, () => {
    setEditando(false)
    setOk(true)
    setTimeout(() => setOk(false), 2500)
  })
  const anioActual = new Date().getFullYear()
  const anio = form.anio_instalacion ? Number(form.anio_instalacion) : null
  const pisos = form.pisos ? Number(form.pisos) : null
  const errorAnio = anio !== null && (!Number.isInteger(anio) || anio < 1900 || anio > anioActual) ? `Entre 1900 y ${anioActual}.` : null
  const errorPisos = pisos !== null && (!Number.isInteger(pisos) || pisos < 1 || pisos > 200) ? 'Número de pisos inválido.' : null

  const t = (v: string) => v.trim() || null

  return (
    <div className={`${CLASE_TARJETA} p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={CLASE_TITULO_TARJETA}>Ficha técnica</h3>
        {!editando ? (
          <div className="flex items-center gap-2">
            <Ok visible={ok} />
            <button
              onClick={() => {
                setForm(inicial())
                setEditando(true)
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]"
            >
              <Pencil size={12} /> Editar
            </button>
          </div>
        ) : null}
      </div>
      {editando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Marca">
              <input className={CLASE_INPUT} value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            </Campo>
            <Campo label="Modelo">
              <input className={CLASE_INPUT} value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
            </Campo>
            <Campo label="Año instalación" error={errorAnio}>
              <input type="number" className={CLASE_INPUT} value={form.anio_instalacion} onChange={(e) => setForm({ ...form, anio_instalacion: e.target.value })} />
            </Campo>
            <Campo label="Pisos" error={errorPisos}>
              <input type="number" className={CLASE_INPUT} value={form.pisos} onChange={(e) => setForm({ ...form, pisos: e.target.value })} />
            </Campo>
            <Campo label="Sector (torre / bloque)">
              <input className={CLASE_INPUT} value={form.torre} onChange={(e) => setForm({ ...form, torre: e.target.value })} />
            </Campo>
            <Campo label="N° de equipo">
              <input className={CLASE_INPUT} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Mañas del equipo" ayuda="Lo que el técnico debe saber antes de intervenirlo.">
            <textarea rows={3} className={CLASE_INPUT} value={form.manas} onChange={(e) => setForm({ ...form, manas: e.target.value })} />
          </Campo>
          {mut.error ? <AvisoError texto={mensajeError(mut.error)} /> : null}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditando(false)} className={CLASE_BOTON_SECUNDARIO}>Cancelar</button>
            <button
              disabled={mut.isPending || !!errorAnio || !!errorPisos}
              onClick={() =>
                mut.mutate({
                  marca: t(form.marca),
                  modelo: t(form.modelo),
                  anio_instalacion: anio,
                  pisos,
                  torre: t(form.torre),
                  numero: t(form.numero),
                  manas: t(form.manas),
                })
              }
              className={`${CLASE_BOTON_PRIMARIO} py-2`}
            >
              {mut.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="space-y-3">
            <Dato label="Marca / Modelo">{[equipo.marca, equipo.modelo].filter(Boolean).join(' ') || '—'}</Dato>
            <Dato label="Categoría">{CATEGORIA_CFG[categoriaDe(equipo)].label}</Dato>
            <Dato label="Tipo de equipo">{TIPO_EQUIPO_LABEL[equipo.tipo_equipo] ?? equipo.tipo_equipo}</Dato>
            <Dato label="Sector">{equipo.torre ?? '—'}{equipo.numero ? ` · N° ${equipo.numero}` : ''}</Dato>
            <Dato label="Año instalación">{equipo.anio_instalacion ?? '—'}</Dato>
            <Dato label="Pisos">{equipo.pisos ?? '—'}</Dato>
            <Dato label="Último mantenimiento">{equipo.ultima_mantencion ? fmtFecha(equipo.ultima_mantencion) : '—'}</Dato>
            <Dato label="Tasa fallo actual" destacado={equipo.tasa_fallo != null && equipo.tasa_fallo > 15 ? 'text-red-600' : undefined}>
              {equipo.tasa_fallo != null ? `${equipo.tasa_fallo}%` : '—'}
            </Dato>
            <Dato label="Componentes" destacado={piezasMixtas ? 'text-amber-700' : undefined}>
              {piezasMixtas ? 'Mixtos (OEM + 3ros)' : 'Originales'}
            </Dato>
            <Dato label="Código QR"><span className="font-mono-brand">{equipo.codigo_qr}</span></Dato>
          </dl>
          <div className="mt-4 border-t border-[var(--color-border)]/60 pt-3">
            <div className="mb-1 font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">Mañas del equipo</div>
            {equipo.manas ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{equipo.manas}</p>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">Sin mañas registradas.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaEstado({ equipo }: { equipo: Ascensor }) {
  const [ok, setOk] = useState(false)
  const [pendiente, setPendiente] = useState<EstadoAscensor | null>(null)
  const mut = useActualizarEquipo(equipo.id, () => {
    setPendiente(null)
    setOk(true)
    setTimeout(() => setOk(false), 2500)
  })
  return (
    <div className={`${CLASE_TARJETA} p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={CLASE_TITULO_TARJETA}>Estado del equipo</h3>
        <Ok visible={ok} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ESTADOS_EQUIPO.map((s) => {
          const cfg = ESTADO_EQUIPO[s]
          const activo = (pendiente ?? equipo.estado) === s
          return (
            <button
              key={s}
              disabled={mut.isPending}
              onClick={() => {
                if (s === equipo.estado) return
                setPendiente(s)
                mut.mutate({ estado: s })
              }}
              className={`flex items-center justify-center gap-1.5 rounded border px-1.5 py-2 font-mono-brand text-xs whitespace-nowrap transition-all ${
                activo
                  ? `border-current ${cfg.color} ${cfg.bg} font-semibold`
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-slate-400'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${cfg.dot}`} /> {cfg.label}
            </button>
          )
        })}
      </div>
      {mut.error ? (
        <div className="mt-3">
          <AvisoError texto={mensajeError(mut.error)} />
        </div>
      ) : null}
      {mut.error && pendiente ? null : null}
    </div>
  )
}
