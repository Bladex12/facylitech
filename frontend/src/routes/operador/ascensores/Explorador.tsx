import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Mail, Phone, User } from 'lucide-react'
import type {
  Administracion,
  Ascensor,
  CategoriaEquipo,
  Cliente,
  Edificio,
  EstadoAscensor,
} from '../../../api/types'
import { categoriaDe, compararNatural, filtrarEquipos } from '../../../domain/equipos'
import { TIPO_CLIENTE_LABEL, tipoEdificioCfg } from '../comun/etiquetas'
import { useJerarquia } from '../comun/consultas'
import { CLASE_TARJETA, Cargando, ErrorVista, Vacio } from '../comun/ui'
import {
  BadgeCertificacion,
  Buscador,
  FiltrosEquipo,
  FilaEquipo,
  IconoEdificio,
  Migas,
  ResumenEstados,
  type Miga,
} from './piezas'

export function Explorador() {
  const [params, setParams] = useSearchParams()
  const clienteId = params.get('cliente')
  const adminId = params.get('admin')
  const texto = params.get('q') ?? ''
  const categoria = (params.get('cat') as CategoriaEquipo | null) || null
  const estado = (params.get('estado') as EstadoAscensor | null) || null

  const j = useJerarquia()

  function setParam(clave: string, valor: string | null) {
    const p = new URLSearchParams(params)
    if (valor) p.set(clave, valor)
    else p.delete(clave)
    setParams(p, { replace: clave === 'q' })
  }

  const cliente = clienteId ? j.clientePorId.get(clienteId) : undefined
  const admin = adminId ? j.adminPorId.get(adminId) : undefined

  // Universo visible según el nivel del drill-down.
  const edificiosVisibles = j.edificios.filter((e) => {
    if (adminId) return e.administracion_id === adminId
    if (clienteId) return j.adminPorId.get(e.administracion_id)?.cliente_id === clienteId
    return true
  })
  const idsVisibles = new Set(edificiosVisibles.map((e) => e.id))
  const equiposVisibles = j.equipos.filter((e) => idsVisibles.has(e.edificio_id))

  const filtrando = !!(texto.trim() || categoria || estado)
  const nombreEdificio = (id: string) => j.edificioPorId.get(id)?.nombre ?? ''
  const resultados = filtrando
    ? filtrarEquipos(equiposVisibles, { texto, categoria, estado }, nombreEdificio)
    : []
  const edificiosCoincidentes =
    texto.trim().length > 1
      ? edificiosVisibles.filter((e) =>
          `${e.nombre} ${e.direccion} ${e.comuna}`.toLowerCase().includes(texto.trim().toLowerCase()),
        )
      : []

  const migas: Miga[] = [{ label: 'Clientes', to: '/operador/ascensores' }]
  if (cliente) migas.push({ label: cliente.nombre, to: `/operador/ascensores?cliente=${cliente.id}` })
  if (admin) migas.push({ label: admin.nombre })

  const equiposDe = (edificios: Edificio[]) =>
    edificios.flatMap((e) => j.equiposPorEdificio.get(e.id) ?? [])
  const edificiosDeAdmin = (a: Administracion) =>
    j.edificios
      .filter((e) => e.administracion_id === a.id)
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
  const adminsDeCliente = (c: Cliente) =>
    j.administraciones
      .filter((a) => a.cliente_id === c.id)
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))

  return (
    <div className="space-y-5 p-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Ascensores</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Jerarquía: Cliente → Administración → Edificio → Equipo → Bitácora
        </p>
      </div>

      <Resumen equipos={j.equipos} edificios={j.edificios.length} clientes={j.clientes.length} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Buscador
            valor={texto}
            onCambio={(v) => setParam('q', v || null)}
            placeholder="Buscar equipo por código, QR, marca, sector o edificio…"
          />
        </div>
        <FiltrosEquipo
          equipos={equiposVisibles}
          categoria={categoria}
          estado={estado}
          onCategoria={(c) => setParam('cat', c)}
          onEstado={(e) => setParam('estado', e)}
        />
      </div>

      <Migas items={migas} />

      {j.error ? (
        <ErrorVista error={j.error} onReintentar={j.reintentar} />
      ) : j.isLoading ? (
        <Cargando texto="Cargando clientes y equipos…" />
      ) : filtrando ? (
        <Resultados
          equipos={resultados}
          edificios={edificiosCoincidentes}
          edificioPorId={j.edificioPorId}
          equiposPorEdificio={j.equiposPorEdificio}
        />
      ) : admin ? (
        <SeccionAdministracion
          admin={admin}
          edificios={edificiosDeAdmin(admin)}
          equiposPorEdificio={j.equiposPorEdificio}
        />
      ) : cliente ? (
        <div className="space-y-5">
          {adminsDeCliente(cliente).length === 0 && (
            <Vacio titulo="Este cliente no tiene administraciones registradas" />
          )}
          {adminsDeCliente(cliente).map((a) => (
            <SeccionAdministracion
              key={a.id}
              admin={a}
              edificios={edificiosDeAdmin(a)}
              equiposPorEdificio={j.equiposPorEdificio}
              enlace
            />
          ))}
        </div>
      ) : j.clientes.length === 0 ? (
        <Vacio titulo="Aún no hay clientes" detalle="Carga los datos de la empresa con el seed." />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {[...j.clientes]
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
            .map((c) => {
              const admins = adminsDeCliente(c)
              const edificios = admins.flatMap(edificiosDeAdmin)
              const equipos = equiposDe(edificios)
              return (
                <div key={c.id} className={`${CLASE_TARJETA} overflow-hidden`}>
                  <Link
                    to={`/operador/ascensores?cliente=${c.id}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-bg-subtle)]"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[var(--color-navy)] font-mono-brand text-xs font-bold text-white">
                      {c.nombre
                        .split(' ')
                        .filter((p) => p.length > 2)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-[var(--color-text)]">{c.nombre}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {TIPO_CLIENTE_LABEL[c.tipo] ?? c.tipo} · {admins.length} administraci
                        {admins.length === 1 ? 'ón' : 'ones'} · {edificios.length} edificio
                        {edificios.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <ResumenEstados equipos={equipos} />
                      <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">
                        {equipos.length} eq.
                      </span>
                      <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
                    </div>
                  </Link>
                  {edificios.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-[var(--color-bg-subtle)] px-4 py-2.5">
                      {edificios.map((e) => (
                        <Link
                          key={e.id}
                          to={`/operador/ascensores/edificios/${e.id}`}
                          className="flex items-center gap-1.5 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-gray-700 transition-colors hover:border-[var(--color-navy)] hover:text-[var(--color-text)]"
                        >
                          <span className={`rounded p-0.5 ${tipoEdificioCfg(e.tipo).clase}`}>
                            {tipoEdificioCfg(e.tipo).icono}
                          </span>
                          {e.nombre}
                          <span className="font-mono-brand text-[var(--color-text-muted)]">
                            {j.equiposPorEdificio.get(e.id)?.length ?? 0}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

function Resumen({
  equipos,
  edificios,
  clientes,
}: {
  equipos: Ascensor[]
  edificios: number
  clientes: number
}) {
  const criticos = equipos.filter((e) => e.estado === 'critico').length
  const porCat = (c: CategoriaEquipo) => equipos.filter((e) => categoriaDe(e) === c).length
  const stats = [
    { label: 'Equipos', valor: equipos.length, sub: `${edificios} edificios · ${clientes} clientes`, color: 'text-[var(--color-navy)]' },
    { label: 'Ascensores', valor: porCat('ascensor'), sub: 'Equipos de pasajeros', color: 'text-[var(--color-navy)]' },
    {
      label: 'Montacargas / montaplatos',
      valor: porCat('montacarga') + porCat('montaplatos'),
      sub: `${porCat('montacarga')} montacargas · ${porCat('montaplatos')} montaplatos`,
      color: 'text-[var(--color-navy)]',
    },
    { label: 'Equipos críticos', valor: criticos, sub: 'Requieren atención', color: criticos ? 'text-red-600' : 'text-green-700' },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`${CLASE_TARJETA} p-4`}>
          <div className={`mb-0.5 text-2xl font-bold ${s.color}`}>{s.valor}</div>
          <div className="text-sm font-semibold text-[var(--color-text)]">{s.label}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{s.sub}</div>
        </div>
      ))}
    </div>
  )
}

function SeccionAdministracion({
  admin,
  edificios,
  equiposPorEdificio,
  enlace,
}: {
  admin: Administracion
  edificios: Edificio[]
  equiposPorEdificio: Map<string, Ascensor[]>
  enlace?: boolean
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
            Administración
          </h3>
          {enlace ? (
            <Link
              to={`/operador/ascensores?cliente=${admin.cliente_id}&admin=${admin.id}`}
              className="text-base font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]"
            >
              {admin.nombre}
            </Link>
          ) : (
            <div className="text-base font-semibold text-[var(--color-text)]">{admin.nombre}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
          {admin.contacto_nombre && (
            <span className="flex items-center gap-1">
              <User size={12} /> {admin.contacto_nombre}
            </span>
          )}
          {admin.contacto_telefono && (
            <a href={`tel:${admin.contacto_telefono}`} className="flex items-center gap-1 hover:text-[var(--color-text)]">
              <Phone size={12} /> {admin.contacto_telefono}
            </a>
          )}
          {admin.contacto_email && (
            <a href={`mailto:${admin.contacto_email}`} className="flex items-center gap-1 hover:text-[var(--color-text)]">
              <Mail size={12} /> {admin.contacto_email}
            </a>
          )}
        </div>
      </div>
      {edificios.length === 0 ? (
        <Vacio titulo="Sin edificios en esta administración" />
      ) : (
        <div className="space-y-2">
          {edificios.map((e) => (
            <FilaEdificio key={e.id} edificio={e} equipos={equiposPorEdificio.get(e.id) ?? []} />
          ))}
        </div>
      )}
    </section>
  )
}

function FilaEdificio({ edificio, equipos }: { edificio: Edificio; equipos: Ascensor[] }) {
  const sectores = new Set(equipos.map((e) => e.torre).filter(Boolean)).size
  return (
    <Link
      to={`/operador/ascensores/edificios/${edificio.id}`}
      className={`${CLASE_TARJETA} flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-[var(--color-bg-subtle)]`}
    >
      <IconoEdificio tipo={edificio.tipo} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[var(--color-text)]">{edificio.nombre}</div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {edificio.direccion}, {edificio.comuna} · {tipoEdificioCfg(edificio.tipo).label}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <BadgeCertificacion vencimiento={edificio.vencimiento_certificacion} />
        <ResumenEstados equipos={equipos} />
        {sectores > 1 && (
          <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">{sectores} sectores</span>
        )}
        <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">{equipos.length} eq.</span>
        <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
      </div>
    </Link>
  )
}

function Resultados({
  equipos,
  edificios,
  edificioPorId,
  equiposPorEdificio,
}: {
  equipos: Ascensor[]
  edificios: Edificio[]
  edificioPorId: Map<string, Edificio>
  equiposPorEdificio: Map<string, Ascensor[]>
}) {
  const porEdificio = new Map<string, Ascensor[]>()
  for (const e of equipos) {
    const lista = porEdificio.get(e.edificio_id)
    if (lista) lista.push(e)
    else porEdificio.set(e.edificio_id, [e])
  }
  const grupos = [...porEdificio.entries()].sort(([a], [b]) =>
    (edificioPorId.get(a)?.nombre ?? '').localeCompare(edificioPorId.get(b)?.nombre ?? '', 'es'),
  )

  if (equipos.length === 0 && edificios.length === 0) {
    return (
      <Vacio
        titulo="Sin resultados"
        detalle="Prueba con otro código, el nombre del edificio o quita los filtros de categoría y estado."
      />
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        {equipos.length} equipo{equipos.length === 1 ? '' : 's'} en {grupos.length} edificio
        {grupos.length === 1 ? '' : 's'}
      </p>
      {edificios.length > 0 && (
        <div className="space-y-2">
          {edificios.map((e) => (
            <FilaEdificio key={e.id} edificio={e} equipos={equiposPorEdificio.get(e.id) ?? []} />
          ))}
        </div>
      )}
      {grupos.map(([edificioId, lista]) => {
        const edificio = edificioPorId.get(edificioId)
        return (
          <div key={edificioId} className={`${CLASE_TARJETA} overflow-hidden`}>
            <Link
              to={`/operador/ascensores/edificios/${edificioId}`}
              className="flex items-center gap-3 border-b border-[var(--color-bg-subtle)] bg-[var(--color-bg-subtle)] px-5 py-2.5 hover:text-[var(--color-accent)]"
            >
              {edificio && <IconoEdificio tipo={edificio.tipo} />}
              <span className="font-semibold">{edificio?.nombre ?? 'Edificio'}</span>
              <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">
                {lista.length} coincidencia{lista.length === 1 ? '' : 's'}
              </span>
            </Link>
            <div className="divide-y divide-[var(--color-bg-subtle)]">
              {lista
                .sort((a, b) => compararNatural(a.codigo, b.codigo))
                .map((e) => (
                  <FilaEquipo
                    key={e.id}
                    equipo={e}
                    extra={
                      e.torre && (
                        <span className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]">
                          {e.torre}
                        </span>
                      )
                    }
                  />
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
