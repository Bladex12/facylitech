import { mensajeError } from '../comun/errores'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  User,
  Users,
} from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type { CategoriaEquipo, Edificio, EstadoAscensor, OrdenTrabajo } from '../../../api/types'
import { CATEGORIAS, agruparPorSector, categoriaDe, filtrarEquipos } from '../../../domain/equipos'
import { ordenarListado } from '../../../domain/ordenamiento'
import { fechaIsoLocal, sumarDias } from '../../../domain/semana'
import { CATEGORIA_CFG, fmtFecha, tipoEdificioCfg } from '../comun/etiquetas'
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
import {
  AlertaCertificacion,
  Buscador,
  FiltrosEquipo,
  FilaEquipo,
  IconoEdificio,
  Migas,
  ResumenEstados,
} from './piezas'
import { ListaProximasOts } from './ProximasOts'

export function FichaEdificio() {
  const { id } = useParams<{ id: string }>()
  const j = useJerarquia()
  const [nuevaOt, setNuevaOt] = useState(false)
  const [ordenAbierta, setOrdenAbierta] = useState<OrdenTrabajo | null>(null)
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaEquipo | null>(null)
  const [estado, setEstado] = useState<EstadoAscensor | null>(null)

  const edificio = id ? j.edificioPorId.get(id) : undefined
  const admin = edificio ? j.adminPorId.get(edificio.administracion_id) : undefined
  const cliente = admin ? j.clientePorId.get(admin.cliente_id) : undefined
  const equipos = useMemo(() => (id ? (j.equiposPorEdificio.get(id) ?? []) : []), [j.equiposPorEdificio, id])
  const filtrados = filtrarEquipos(equipos, { texto, categoria, estado })
  const sectores = agruparPorSector(filtrados)

  const hoy = fechaIsoLocal(new Date())
  const ordenes = useOrdenes(
    { desde: sumarDias(hoy, -30), hasta: sumarDias(hoy, 45), edificio_id: id },
    !!id,
  )
  const pendientes = ordenarListado(
    (ordenes.data ?? []).filter(
      (o) => o.estado === 'programado' || o.estado === 'en_curso',
    ),
  )

  if (j.error) return <div className="p-8"><ErrorVista error={j.error} onReintentar={j.reintentar} /></div>
  if (j.isLoading) return <Cargando texto="Cargando edificio…" />
  if (!edificio)
    return (
      <div className="space-y-4 p-8">
        <Volver />
        <Vacio titulo="Edificio no encontrado" detalle="Puede haber sido eliminado o el enlace es incorrecto." />
      </div>
    )

  const tipoCfg = tipoEdificioCfg(edificio.tipo)

  return (
    <div className="space-y-5 p-8">
      <Migas
        items={[
          { label: 'Clientes', to: '/operador/ascensores' },
          ...(cliente ? [{ label: cliente.nombre, to: `/operador/ascensores?cliente=${cliente.id}` }] : []),
          ...(admin
            ? [{ label: admin.nombre, to: `/operador/ascensores?cliente=${admin.cliente_id}&admin=${admin.id}` }]
            : []),
          { label: edificio.nombre },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconoEdificio tipo={edificio.tipo} grande />
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text)]">{edificio.nombre}</h2>
            <p className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
              <MapPin size={13} /> {edificio.direccion}, {edificio.comuna} · {tipoCfg.label}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ResumenEstados equipos={equipos} />
              {CATEGORIAS.map((c) => {
                const n = equipos.filter((e) => categoriaDe(e) === c).length
                return n ? (
                  <span key={c} className="flex items-center gap-1 rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono-brand text-xs text-gray-700">
                    {CATEGORIA_CFG[c].icono} {n} {(n === 1 ? CATEGORIA_CFG[c].label : CATEGORIA_CFG[c].plural).toLowerCase()}
                  </span>
                ) : null
              })}
            </div>
          </div>
        </div>
        <button onClick={() => setNuevaOt(true)} className={CLASE_BOTON_PRIMARIO}>
          <Plus size={14} /> Nueva OT
        </button>
      </div>

      <AlertaCertificacion vencimiento={edificio.vencimiento_certificacion} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <TarjetaDatos edificio={edificio} />
        <TarjetaContactos edificio={edificio} admin={admin} />
        <TarjetaManas edificio={edificio} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[var(--color-text)]">
              Equipos <span className="font-mono-brand text-sm font-normal text-[var(--color-text-muted)]">({equipos.length})</span>
            </h3>
          </div>
          {equipos.length > 6 && (
            <Buscador valor={texto} onCambio={setTexto} placeholder="Filtrar por código, marca o sector…" />
          )}
          {equipos.length > 0 && (
            <FiltrosEquipo
              equipos={equipos}
              categoria={categoria}
              estado={estado}
              onCategoria={setCategoria}
              onEstado={setEstado}
            />
          )}
          {equipos.length === 0 ? (
            <Vacio titulo="Este edificio no tiene equipos registrados" />
          ) : sectores.length === 0 ? (
            <Vacio titulo="Ningún equipo coincide con los filtros" />
          ) : (
            sectores.map((s) => (
              <div key={s.sector} className={`${CLASE_TARJETA} overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-5 py-2.5">
                  <span className="font-semibold text-[var(--color-text)]">{s.sector}</span>
                  <span className="flex items-center gap-2">
                    <ResumenEstados equipos={s.categorias.flatMap((c) => c.equipos)} />
                    <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">
                      {s.total} equipo{s.total === 1 ? '' : 's'}
                    </span>
                  </span>
                </div>
                {s.categorias.map((c) => (
                  <div key={c.categoria}>
                    {s.categorias.length > 1 && (
                      <div className="flex items-center gap-1.5 px-5 pt-2.5 pb-1 font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
                        {CATEGORIA_CFG[c.categoria].icono} {CATEGORIA_CFG[c.categoria].plural} · {c.equipos.length}
                      </div>
                    )}
                    <div className="divide-y divide-[var(--color-border)]/60">
                      {c.equipos.map((e) => (
                        <FilaEquipo key={e.id} equipo={e} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>

        <aside className="space-y-3">
          <h3 className="text-lg font-bold text-[var(--color-text)]">Próximas visitas</h3>
          <div className={`${CLASE_TARJETA} overflow-hidden`}>
            <ListaProximasOts
              ordenes={pendientes}
              isLoading={ordenes.isLoading}
              error={ordenes.error}
              onAbrir={setOrdenAbierta}
              mostrarEquipo
              vacio="No hay OTs pendientes en los próximos 45 días."
            />
          </div>
          <Link
            to={`/operador/calendario?edificio=${edificio.id}`}
            className="block text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          >
            Ver en el calendario →
          </Link>
        </aside>
      </div>

      {nuevaOt && (
        <NuevaOrdenModal inicial={{ edificioId: edificio.id }} onCerrar={() => setNuevaOt(false)} />
      )}
      {ordenAbierta && (
        <OrdenPanel key={ordenAbierta.id} orden={ordenAbierta} onCerrar={() => setOrdenAbierta(null)} />
      )}
    </div>
  )
}

function Volver() {
  return (
    <Link
      to="/operador/ascensores"
      className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
    >
      <ArrowLeft size={13} /> Volver a Ascensores
    </Link>
  )
}

/** Mutación PATCH /edificios/{id} compartida por las tarjetas editables. */
function useActualizarEdificio(id: string, onOk: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: Partial<Edificio>) => endpoints.edificios.actualizar(id, datos),
    onSuccess: async (actualizado) => {
      qc.setQueryData<Edificio[]>(claves.edificios, (prev) =>
        prev?.map((e) => (e.id === id ? { ...e, ...actualizado } : e)),
      )
      await qc.invalidateQueries({ queryKey: claves.edificios })
      onOk()
    },
  })
}

function TarjetaEditable({
  titulo,
  editando,
  onEditar,
  children,
}: {
  titulo: string
  editando: boolean
  onEditar: () => void
  children: ReactNode
}) {
  return (
    <div className={`${CLASE_TARJETA} p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={CLASE_TITULO_TARJETA}>{titulo}</h3>
        {!editando && (
          <button
            onClick={onEditar}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]"
          >
            <Pencil size={12} /> Editar
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function BotonesEdicion({
  onCancelar,
  onGuardar,
  guardando,
  error,
}: {
  onCancelar: () => void
  onGuardar: () => void
  guardando: boolean
  error: unknown
}) {
  return (
    <div className="space-y-2 pt-1">
      {error ? <AvisoError texto={mensajeError(error)} /> : null}
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className={CLASE_BOTON_SECUNDARIO}>
          Cancelar
        </button>
        <button onClick={onGuardar} disabled={guardando} className={`${CLASE_BOTON_PRIMARIO} py-2`}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-right font-medium text-[var(--color-text)]">{children}</dd>
    </div>
  )
}

function useGuardadoOk() {
  const [ok, setOk] = useState(false)
  return {
    ok,
    marcar: () => {
      setOk(true)
      setTimeout(() => setOk(false), 2500)
    },
  }
}

function MarcaGuardado({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="mt-3 flex items-center gap-1 text-xs text-green-700">
      <CheckCircle2 size={13} /> Cambios guardados
    </div>
  )
}

function TarjetaDatos({ edificio }: { edificio: Edificio }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    direccion: edificio.direccion,
    vencimiento_certificacion: edificio.vencimiento_certificacion ?? '',
  })
  const guardado = useGuardadoOk()
  const mut = useActualizarEdificio(edificio.id, () => {
    setEditando(false)
    guardado.marcar()
  })
  return (
    <TarjetaEditable
      titulo="Datos del edificio"
      editando={editando}
      onEditar={() => {
        setForm({
          direccion: edificio.direccion,
          vencimiento_certificacion: edificio.vencimiento_certificacion ?? '',
        })
        setEditando(true)
      }}
    >
      {editando ? (
        <div className="space-y-3">
          <Campo label="Dirección">
            <input
              className={CLASE_INPUT}
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </Campo>
          <Campo label="Vencimiento certificación">
            <input
              type="date"
              className={CLASE_INPUT}
              value={form.vencimiento_certificacion}
              onChange={(e) => setForm({ ...form, vencimiento_certificacion: e.target.value })}
            />
          </Campo>
          <BotonesEdicion
            onCancelar={() => setEditando(false)}
            onGuardar={() =>
              mut.mutate({
                direccion: form.direccion.trim() || edificio.direccion,
                vencimiento_certificacion: form.vencimiento_certificacion || null,
              })
            }
            guardando={mut.isPending}
            error={mut.error}
          />
        </div>
      ) : (
        <>
          <dl className="space-y-3">
            <Dato label="Dirección">{edificio.direccion}</Dato>
            <Dato label="Comuna">{edificio.comuna}</Dato>
            <Dato label="Tipo">{tipoEdificioCfg(edificio.tipo).label}</Dato>
            <Dato label="Vence certificación">
              {edificio.vencimiento_certificacion ? fmtFecha(edificio.vencimiento_certificacion) : '—'}
            </Dato>
          </dl>
          <MarcaGuardado visible={guardado.ok} />
        </>
      )}
    </TarjetaEditable>
  )
}

function Contacto({
  titulo,
  icono,
  nombre,
  telefono,
  email,
  extra,
}: {
  titulo: string
  icono: ReactNode
  nombre: string | null
  telefono: string | null
  email: string | null
  extra?: string | null
}) {
  const vacio = !nombre && !telefono && !email
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
        {icono} {titulo}
      </div>
      {vacio ? (
        <p className="text-sm text-[var(--color-text-muted)]">Sin contacto registrado.</p>
      ) : (
        <div className="space-y-1 text-sm">
          {nombre && <div className="font-medium text-[var(--color-text)]">{nombre}</div>}
          {telefono && (
            <a href={`tel:${telefono}`} className="flex items-center gap-1.5 text-gray-700 hover:text-[var(--color-accent)]">
              <Phone size={12} /> {telefono}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-1.5 break-all text-gray-700 hover:text-[var(--color-accent)]">
              <Mail size={12} /> {email}
            </a>
          )}
          {extra && <p className="text-xs text-[var(--color-text-muted)]">{extra}</p>}
        </div>
      )}
    </div>
  )
}

function TarjetaContactos({
  edificio,
  admin,
}: {
  edificio: Edificio
  admin?: { nombre: string; contacto_nombre: string | null; contacto_telefono: string | null; contacto_email: string | null; contacto_alternativo: string | null }
}) {
  const [editando, setEditando] = useState(false)
  const inicial = () => ({
    contacto_nombre: edificio.contacto_nombre ?? '',
    contacto_telefono: edificio.contacto_telefono ?? '',
    contacto_email: edificio.contacto_email ?? '',
  })
  const [form, setForm] = useState(inicial)
  const guardado = useGuardadoOk()
  const mut = useActualizarEdificio(edificio.id, () => {
    setEditando(false)
    guardado.marcar()
  })
  return (
    <TarjetaEditable
      titulo="Contactos"
      editando={editando}
      onEditar={() => {
        setForm(inicial())
        setEditando(true)
      }}
    >
      <div className="space-y-4">
        <Contacto
          titulo={admin ? `Administración · ${admin.nombre}` : 'Administración'}
          icono={<User size={11} />}
          nombre={admin?.contacto_nombre ?? null}
          telefono={admin?.contacto_telefono ?? null}
          email={admin?.contacto_email ?? null}
          extra={admin?.contacto_alternativo}
        />
        <div className="border-t border-[var(--color-border)]/60 pt-4">
          {editando ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
                <Users size={11} /> Comunidad / conserjería
              </div>
              <Campo label="Nombre">
                <input className={CLASE_INPUT} value={form.contacto_nombre} onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value })} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Teléfono">
                  <input className={CLASE_INPUT} value={form.contacto_telefono} onChange={(e) => setForm({ ...form, contacto_telefono: e.target.value })} />
                </Campo>
                <Campo label="Email">
                  <input type="email" className={CLASE_INPUT} value={form.contacto_email} onChange={(e) => setForm({ ...form, contacto_email: e.target.value })} />
                </Campo>
              </div>
              <BotonesEdicion
                onCancelar={() => setEditando(false)}
                onGuardar={() =>
                  mut.mutate({
                    contacto_nombre: form.contacto_nombre.trim() || null,
                    contacto_telefono: form.contacto_telefono.trim() || null,
                    contacto_email: form.contacto_email.trim() || null,
                  })
                }
                guardando={mut.isPending}
                error={mut.error}
              />
            </div>
          ) : (
            <Contacto
              titulo="Comunidad / conserjería"
              icono={<Users size={11} />}
              nombre={edificio.contacto_nombre ?? null}
              telefono={edificio.contacto_telefono ?? null}
              email={edificio.contacto_email ?? null}
            />
          )}
        </div>
      </div>
      <MarcaGuardado visible={guardado.ok} />
    </TarjetaEditable>
  )
}

function TarjetaManas({ edificio }: { edificio: Edificio }) {
  const [editando, setEditando] = useState(false)
  const inicial = () => ({
    manas: edificio.manas ?? '',
    instrucciones_reinicio: edificio.instrucciones_reinicio ?? '',
  })
  const [form, setForm] = useState(inicial)
  const guardado = useGuardadoOk()
  const mut = useActualizarEdificio(edificio.id, () => {
    setEditando(false)
    guardado.marcar()
  })
  return (
    <TarjetaEditable
      titulo="Mañas y reinicio"
      editando={editando}
      onEditar={() => {
        setForm(inicial())
        setEditando(true)
      }}
    >
      {editando ? (
        <div className="space-y-3">
          <Campo label="Mañas del edificio" ayuda="Horarios, accesos, cuidados especiales.">
            <textarea rows={3} className={CLASE_INPUT} value={form.manas} onChange={(e) => setForm({ ...form, manas: e.target.value })} />
          </Campo>
          <Campo label="Instrucciones de reinicio">
            <textarea rows={3} className={CLASE_INPUT} value={form.instrucciones_reinicio} onChange={(e) => setForm({ ...form, instrucciones_reinicio: e.target.value })} />
          </Campo>
          <BotonesEdicion
            onCancelar={() => setEditando(false)}
            onGuardar={() =>
              mut.mutate({
                manas: form.manas.trim() || null,
                instrucciones_reinicio: form.instrucciones_reinicio.trim() || null,
              })
            }
            guardando={mut.isPending}
            error={mut.error}
          />
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <div className="mb-1 font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">Mañas</div>
            {edificio.manas ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">{edificio.manas}</p>
            ) : (
              <p className="text-[var(--color-text-muted)]">Sin mañas registradas.</p>
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
              <RotateCcw size={10} /> Instrucciones de reinicio
            </div>
            {edificio.instrucciones_reinicio ? (
              <p className="text-gray-700">{edificio.instrucciones_reinicio}</p>
            ) : (
              <p className="text-[var(--color-text-muted)]">Sin instrucciones registradas.</p>
            )}
          </div>
          <MarcaGuardado visible={guardado.ok} />
        </div>
      )}
    </TarjetaEditable>
  )
}
