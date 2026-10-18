/* Piezas reutilizadas por el explorador y las fichas de edificio/equipo. */
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Search, ShieldCheck, X } from 'lucide-react'
import type { Ascensor, CategoriaEquipo, Edificio, EstadoAscensor } from '../../../api/types'
import { CATEGORIAS, categoriaDe, contarPor, estadoCertificacion } from '../../../domain/equipos'
import { fechaIsoLocal } from '../../../domain/semana'
import { CATEGORIA_CFG, ESTADOS_EQUIPO, ESTADO_EQUIPO, fmtFecha, tipoEdificioCfg } from '../comun/etiquetas'
import { Chip } from '../comun/ui'

export interface Miga {
  label: string
  to?: string
}

export function Migas({ items }: { items: Miga[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--color-text-muted)]">
      {items.map((m, i) => (
        <Fragment key={`${m.label}-${i}`}>
          {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
          {m.to && i < items.length - 1 ? (
            <Link to={m.to} className="transition-colors hover:text-[var(--color-text)]">
              {m.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? 'font-medium text-[var(--color-text)]' : ''}>
              {m.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

export function IconoEdificio({ tipo, grande }: { tipo: Edificio['tipo']; grande?: boolean }) {
  const cfg = tipoEdificioCfg(tipo)
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded ${cfg.clase} ${grande ? 'h-11 w-11' : 'h-9 w-9'}`}
    >
      {cfg.icono}
    </div>
  )
}

/** Badges "N críticos / N adv." del mockup (ElevatorBrowser). */
export function ResumenEstados({ equipos }: { equipos: Ascensor[] }) {
  const criticos = equipos.filter((e) => e.estado === 'critico').length
  const advertencias = equipos.filter((e) => e.estado === 'advertencia').length
  const sinSenal = equipos.filter((e) => e.estado === 'sin_senal').length
  return (
    <>
      {criticos > 0 && (
        <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono-brand text-xs text-red-600">
          {criticos} crítico{criticos > 1 ? 's' : ''}
        </span>
      )}
      {advertencias > 0 && (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono-brand text-xs text-amber-600">
          {advertencias} adv.
        </span>
      )}
      {sinSenal > 0 && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono-brand text-xs text-slate-500">
          {sinSenal} sin señal
        </span>
      )}
    </>
  )
}

export function BadgeCertificacion({ vencimiento }: { vencimiento: string | null }) {
  const { estado, dias } = estadoCertificacion(vencimiento, fechaIsoLocal(new Date()))
  if (estado === 'vencida')
    return (
      <span className="flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 font-mono-brand text-xs text-red-600">
        <AlertTriangle size={11} /> Cert. vencida
      </span>
    )
  if (estado === 'proxima')
    return (
      <span className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-mono-brand text-xs text-amber-700">
        <AlertTriangle size={11} /> Cert. vence en {dias} d
      </span>
    )
  return null
}

export function AlertaCertificacion({ vencimiento }: { vencimiento: string | null }) {
  const { estado, dias } = estadoCertificacion(vencimiento, fechaIsoLocal(new Date()))
  if (estado === 'sin_dato')
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-muted)]">
        <ShieldCheck size={16} /> Sin fecha de vencimiento de certificación registrada.
      </div>
    )
  if (estado === 'vigente') return null
  const vencida = estado === 'vencida'
  return (
    <div
      className={`flex items-center gap-3 rounded-lg p-4 text-sm ${
        vencida ? 'bg-red-600 text-white' : 'border border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      <AlertTriangle size={18} className="flex-shrink-0" />
      <div>
        <div className="font-bold">
          {vencida
            ? `Certificación vencida hace ${Math.abs(dias!)} día${Math.abs(dias!) === 1 ? '' : 's'}`
            : `Certificación vence en ${dias} día${dias === 1 ? '' : 's'}`}
        </div>
        <div className={vencida ? 'text-red-100' : 'text-amber-700'}>
          Vencimiento: {fmtFecha(vencimiento!)} — coordinar la recertificación con la administración.
        </div>
      </div>
    </div>
  )
}

/** Fila de equipo con la forma del mockup (ElevatorBrowser > elevators). */
export function FilaEquipo({ equipo, extra }: { equipo: Ascensor; extra?: ReactNode }) {
  const est = ESTADO_EQUIPO[equipo.estado]
  const cat = CATEGORIA_CFG[categoriaDe(equipo)]
  return (
    <Link
      to={`/operador/ascensores/equipos/${equipo.id}`}
      className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-[var(--color-bg-subtle)]"
    >
      <div className={`h-2 w-2 flex-shrink-0 rounded-full ${est.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-mono-brand text-sm font-semibold text-[var(--color-text)]">
            {equipo.codigo}
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            {cat.icono} {cat.label}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {[equipo.marca, equipo.modelo].filter(Boolean).join(' ') || 'Sin marca'}
            {equipo.pisos ? ` — ${equipo.pisos} pisos` : ''}
          </span>
          {extra}
        </div>
        <div className="font-mono-brand text-xs text-[var(--color-text-muted)]">
          Último mant.: {equipo.ultima_mantencion ? fmtFecha(equipo.ultima_mantencion) : '—'}
          {equipo.tasa_fallo != null && ` · Fallo: ${equipo.tasa_fallo}%`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-mono-brand text-xs ${est.color}`}>{est.label}</span>
        <ChevronRight size={13} className="text-[var(--color-text-muted)]" />
      </div>
    </Link>
  )
}

export function Buscador({
  valor,
  onCambio,
  placeholder,
}: {
  valor: string
  onCambio: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative min-w-64 flex-1">
      <Search
        size={14}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-text-muted)]"
      />
      <input
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-[var(--color-border)] bg-white py-2 pr-8 pl-9 text-sm outline-none focus:border-[var(--color-navy)]"
      />
      {valor && (
        <button
          onClick={() => onCambio('')}
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

/** Chips de categoría y estado con conteos sobre el universo visible. */
export function FiltrosEquipo({
  equipos,
  categoria,
  estado,
  onCategoria,
  onEstado,
}: {
  equipos: Ascensor[]
  categoria: CategoriaEquipo | null
  estado: EstadoAscensor | null
  onCategoria: (c: CategoriaEquipo | null) => void
  onEstado: (e: EstadoAscensor | null) => void
}) {
  const porCategoria = contarPor(equipos, categoriaDe)
  const porEstado = contarPor(equipos, (e) => e.estado)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip activo={!categoria} onClick={() => onCategoria(null)}>
        Todos ({equipos.length})
      </Chip>
      {CATEGORIAS.filter((c) => porCategoria[c]).map((c) => (
        <Chip key={c} activo={categoria === c} onClick={() => onCategoria(categoria === c ? null : c)}>
          {CATEGORIA_CFG[c].icono} {CATEGORIA_CFG[c].plural} ({porCategoria[c]})
        </Chip>
      ))}
      <span className="mx-1 h-5 w-px bg-[var(--color-border)]" />
      {ESTADOS_EQUIPO.filter((s) => porEstado[s]).map((s) => (
        <Chip key={s} activo={estado === s} onClick={() => onEstado(estado === s ? null : s)}>
          <span className={`h-2 w-2 rounded-full ${ESTADO_EQUIPO[s].dot}`} />
          {ESTADO_EQUIPO[s].label} ({porEstado[s]})
        </Chip>
      ))}
    </div>
  )
}
