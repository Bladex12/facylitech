import { mensajeError } from './errores'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Info,
  User,
} from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type {
  OrdenTrabajo,
  OrdenTrabajoActualizar,
  PrioridadOrdenTrabajo,
} from '../../../api/types'
import {
  HORA_DEFECTO,
  combinarFechaHora,
  diaDeTimestamp,
  esDomingo,
  horaDeTimestamp,
} from '../../../domain/semana'
import { PRIORIDADES, PRIORIDAD_CFG, TIPO_OT_LABEL, fmtFechaHora } from './etiquetas'
import { invalidarOrdenes, useTecnicos } from './consultas'
import {
  AvisoError,
  BadgeSemaforo,
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  Campo,
  Drawer
} from './ui'

/** Panel lateral con el detalle de una OT y sus acciones de operador:
 * reasignar técnico, reprogramar, cambiar prioridad y cancelar. */
export function OrdenPanel({
  orden: ordenInicial,
  onCerrar,
  onVolver,
}: {
  orden: OrdenTrabajo
  onCerrar: () => void
  /** Si viene de un bloque de la agenda, vuelve a la lista del bloque. */
  onVolver?: () => void
}) {
  const qc = useQueryClient()
  const tecnicos = useTecnicos()
  const [orden, setOrden] = useState(ordenInicial)
  const [tecnicoId, setTecnicoId] = useState(orden.tecnico?.id ?? '')
  const [fecha, setFecha] = useState(diaDeTimestamp(orden.fecha_programada))
  const [hora, setHora] = useState(horaDeTimestamp(orden.fecha_programada))
  const [prioridad, setPrioridad] = useState<PrioridadOrdenTrabajo>(orden.prioridad)
  const [descripcion, setDescripcion] = useState(orden.descripcion ?? '')
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const editable = orden.estado === 'programado' || orden.estado === 'en_curso'
  const cancelada = orden.estado === 'cancelado'

  const cambios: OrdenTrabajoActualizar = {}
  if (tecnicoId !== (orden.tecnico?.id ?? '')) cambios.tecnico_id = tecnicoId || null
  const nuevaFecha = fecha && hora ? combinarFechaHora(fecha, hora) : null
  if (
    nuevaFecha &&
    (fecha !== diaDeTimestamp(orden.fecha_programada) ||
      hora !== horaDeTimestamp(orden.fecha_programada))
  )
    cambios.fecha_programada = nuevaFecha
  if (prioridad !== orden.prioridad) cambios.prioridad = prioridad
  if (descripcion.trim() !== (orden.descripcion ?? '').trim())
    cambios.descripcion = descripcion.trim() || null
  const hayCambios = Object.keys(cambios).length > 0

  const aplicar = async (actualizada: OrdenTrabajo) => {
    setOrden(actualizada)
    setTecnicoId(actualizada.tecnico?.id ?? '')
    setFecha(diaDeTimestamp(actualizada.fecha_programada))
    setHora(horaDeTimestamp(actualizada.fecha_programada))
    setPrioridad(actualizada.prioridad)
    setDescripcion(actualizada.descripcion ?? '')
    await invalidarOrdenes(qc)
  }

  const guardar = useMutation({
    mutationFn: () => endpoints.ordenes.actualizar(orden.id, cambios),
    onSuccess: async (actualizada) => {
      await aplicar(actualizada)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    },
  })

  const cancelar = useMutation({
    mutationFn: () => endpoints.ordenes.cancelar(orden.id),
    onSuccess: async (actualizada) => {
      setConfirmandoCancelar(false)
      await aplicar(actualizada)
    },
  })

  const edificio = orden.ascensor.edificio

  return (
    <Drawer
      onCerrar={onCerrar}
      titulo={
        <div className="flex items-center gap-2">
          {onVolver && (
            <button
              onClick={onVolver}
              aria-label="Volver al bloque"
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
            >
              <ArrowLeft size={15} />
            </button>
          )}
          <span className="font-mono-brand text-[var(--color-accent)]">{orden.codigo}</span>
          <BadgeSemaforo semaforo={orden.semaforo} cancelado={cancelada} />
        </div>
      }
      subtitulo={`${TIPO_OT_LABEL[orden.tipo]} · prioridad ${PRIORIDAD_CFG[orden.prioridad].label.toLowerCase()}`}
    >
      <div className="space-y-5 px-5 py-4">
        <div className="space-y-2.5 text-sm">
          <Fila icono={<Building2 size={14} />}>
            <Link
              to={`/operador/ascensores/equipos/${orden.ascensor.id}`}
              className="group flex items-center gap-1 font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]"
            >
              <span className="font-mono-brand">{orden.ascensor.codigo}</span>
              {orden.ascensor.torre && (
                <span className="text-[var(--color-text-muted)]">· {orden.ascensor.torre}</span>
              )}
              <ChevronRight size={12} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
            </Link>
            <div className="text-xs text-[var(--color-text-muted)]">
              {edificio.nombre} · {edificio.direccion}, {edificio.comuna}
            </div>
          </Fila>
          <Fila icono={<User size={14} />}>
            {orden.tecnico ? (
              <span className="text-[var(--color-text)]">{orden.tecnico.nombre}</span>
            ) : (
              <span className="font-medium text-amber-700">Sin técnico asignado</span>
            )}
          </Fila>
          <Fila icono={<CalendarClock size={14} />}>
            <span className="text-[var(--color-text)] capitalize">
              {fmtFechaHora(orden.fecha_programada)}
            </span>
            {(orden.inicio_real || orden.fin_real) && (
              <div className="font-mono-brand text-xs text-[var(--color-text-muted)]">
                {orden.inicio_real && `Inicio ${horaDeTimestamp(orden.inicio_real)}`}
                {orden.fin_real && ` · Fin ${horaDeTimestamp(orden.fin_real)}`}
              </div>
            )}
          </Fila>
          {orden.papeleta_estado && (
            <Fila icono={<ClipboardList size={14} />}>
              <span className="text-[var(--color-text)]">
                Papeleta {orden.papeleta_estado === 'enviada' ? 'enviada' : 'en borrador'}
              </span>
            </Fila>
          )}
          {orden.descripcion && !editable && (
            <p className="rounded bg-[var(--color-bg-subtle)] p-3 text-sm text-gray-700">
              {orden.descripcion}
            </p>
          )}
          {(edificio.manas || orden.ascensor.manas) && (
            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>{[orden.ascensor.manas, edificio.manas].filter(Boolean).join(' · ')}</span>
            </div>
          )}
        </div>

        {editable ? (
          <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <h4 className="font-mono-brand text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase">
              Editar orden
            </h4>
            <Campo label="Técnico asignado">
              <select
                className={CLASE_INPUT}
                value={tecnicoId}
                onChange={(e) => setTecnicoId(e.target.value)}
              >
                <option value="">Sin asignar</option>
                {(tecnicos.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                    {t.estado_disponibilidad === 'en_terreno' ? ' (en terreno)' : ''}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha" error={fecha && esDomingo(fecha) ? 'Cae en domingo.' : null}>
                <input
                  type="date"
                  className={CLASE_INPUT}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Campo>
              <Campo label="Hora">
                <input
                  type="time"
                  step={900}
                  className={CLASE_INPUT}
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </Campo>
            </div>
            <div className="flex gap-1">
              {(['manana', 'tarde'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHora(HORA_DEFECTO[m])}
                  className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:border-slate-400"
                >
                  {m === 'manana' ? 'Mañana 09:00' : 'Tarde 14:00'}
                </button>
              ))}
            </div>
            <Campo label="Prioridad" grupo>
              <div className="grid grid-cols-4 gap-1">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridad(p)}
                    className={`rounded border px-1 py-1.5 font-mono-brand text-xs font-semibold transition-all ${
                      prioridad === p
                        ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                        : `border-[var(--color-border)] ${PRIORIDAD_CFG[p].color} hover:border-slate-400`
                    }`}
                  >
                    {PRIORIDAD_CFG[p].label}
                  </button>
                ))}
              </div>
            </Campo>
            <Campo label="Descripción">
              <textarea
                rows={3}
                className={CLASE_INPUT}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </Campo>
            {guardar.error && <AvisoError texto={mensajeError(guardar.error)} />}
            <div className="flex items-center gap-2">
              <button
                onClick={() => guardar.mutate()}
                disabled={!hayCambios || guardar.isPending || !fecha || !hora}
                className={`${CLASE_BOTON_PRIMARIO} flex-1`}
              >
                {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {guardado && (
                <span className="flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 size={13} /> Guardado
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            {cancelada
              ? 'Orden cancelada: ya no aparece en la agenda del técnico.'
              : 'Orden completada: queda registrada en la bitácora del equipo y no se puede editar.'}
          </div>
        )}

        {editable && (
          <div className="border-t border-[var(--color-border)] pt-4">
            {!confirmandoCancelar ? (
              <button
                onClick={() => setConfirmandoCancelar(true)}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
              >
                <Ban size={14} /> Cancelar orden
              </button>
            ) : (
              <div className="space-y-3 rounded border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">
                  ¿Cancelar <b className="font-mono-brand">{orden.codigo}</b>? El técnico dejará de
                  verla en su agenda. Esta acción no se puede deshacer.
                </p>
                {orden.estado === 'en_curso' && (
                  <p className="text-xs text-red-700">Atención: el técnico ya la inició.</p>
                )}
                {cancelar.error && <AvisoError texto={mensajeError(cancelar.error)} />}
                <div className="flex gap-2">
                  <button
                    onClick={() => cancelar.mutate()}
                    disabled={cancelar.isPending}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelar.isPending ? 'Cancelando…' : 'Sí, cancelar'}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmandoCancelar(false)
                      cancelar.reset()
                    }}
                    className={CLASE_BOTON_SECUNDARIO}
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}

function Fila({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-[var(--color-text-muted)]">{icono}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
