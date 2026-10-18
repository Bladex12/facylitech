import { mensajeError } from './errores'
import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Info, Plus, Sparkles } from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type {
  OrdenTrabajo,
  PrioridadOrdenTrabajo,
  TipoOrdenTrabajo,
} from '../../../api/types'
import { agruparPorSector, categoriaDe, compararNatural, sugerirPauta } from '../../../domain/equipos'
import {
  HORA_DEFECTO,
  combinarFechaHora,
  esDomingo,
  fechaIsoLocal,
} from '../../../domain/semana'
import {
  CATEGORIA_CFG,
  ESTADO_EQUIPO,
  PRIORIDADES,
  PRIORIDAD_CFG,
  TIPO_OT_LABEL,
} from './etiquetas'
import {
  invalidarOrdenes,
  useEdificios,
  useEquipos,
  useOrdenes,
  usePautas,
  useTecnicos,
} from './consultas'
import {
  AvisoError,
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  Campo,
  Modal
} from './ui'

export interface ValoresInicialesOrden {
  fecha?: string
  hora?: string
  edificioId?: string
  ascensorId?: string
  tecnicoId?: string | null
  tipo?: TipoOrdenTrabajo
}

const TIPOS: TipoOrdenTrabajo[] = ['mantencion', 'inspeccion', 'reparacion', 'primera_visita', 'emergencia']

export function NuevaOrdenModal({
  inicial = {},
  onCerrar,
  onCreada,
}: {
  inicial?: ValoresInicialesOrden
  onCerrar: () => void
  onCreada?: (orden: OrdenTrabajo) => void
}) {
  const qc = useQueryClient()
  const edificios = useEdificios()
  const equipos = useEquipos()
  const tecnicos = useTecnicos()
  const pautas = usePautas()

  const equipoInicial = equipos.data?.find((e) => e.id === inicial.ascensorId)
  const [tipo, setTipo] = useState<TipoOrdenTrabajo>(inicial.tipo ?? 'mantencion')
  const [prioridad, setPrioridad] = useState<PrioridadOrdenTrabajo>('media')
  const [edificioId, setEdificioId] = useState(inicial.edificioId ?? equipoInicial?.edificio_id ?? '')
  const [ascensorId, setAscensorId] = useState(inicial.ascensorId ?? '')
  const [tecnicoId, setTecnicoId] = useState(inicial.tecnicoId ?? '')
  const [pautaElegida, setPautaElegida] = useState<string | null>(null)
  const [fecha, setFecha] = useState(inicial.fecha ?? fechaIsoLocal(new Date()))
  const [hora, setHora] = useState(inicial.hora ?? HORA_DEFECTO.manana)
  const [descripcion, setDescripcion] = useState('')
  const [intentado, setIntentado] = useState(false)

  // Si el equipo inicial llega después (catálogo cargando), completar el edificio.
  const edificioEfectivo = edificioId || equipoInicial?.edificio_id || ''

  const edificiosOrdenados = useMemo(
    () => [...(edificios.data ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [edificios.data],
  )
  const edificio = edificios.data?.find((e) => e.id === edificioEfectivo) ?? null
  const equiposEdificio = useMemo(
    () => (equipos.data ?? []).filter((e) => e.edificio_id === edificioEfectivo),
    [equipos.data, edificioEfectivo],
  )
  const sectores = useMemo(() => agruparPorSector(equiposEdificio), [equiposEdificio])
  const equipo = equiposEdificio.find((e) => e.id === ascensorId) ?? null

  const sugerida = sugerirPauta(pautas.data ?? [], tipo, equipo)
  // `null` = el operador no ha tocado el selector: se usa la sugerida.
  const pautaId = pautaElegida ?? sugerida?.id ?? ''

  const ocupacion = useOrdenes(
    { desde: fecha, hasta: fecha, tecnico_id: tecnicoId || undefined },
    !!tecnicoId && !!fecha,
  )
  const otsDelTecnico = (ocupacion.data ?? []).filter((o) => o.estado !== 'cancelado')

  const errores = {
    edificio: !edificioEfectivo ? 'Elige un edificio.' : null,
    equipo: !ascensorId ? 'Elige el equipo a intervenir.' : null,
    fecha: !fecha ? 'Indica la fecha.' : null,
    hora: !hora ? 'Indica la hora.' : null,
  }
  const valido = Object.values(errores).every((e) => !e)
  const hoy = fechaIsoLocal(new Date())

  const crear = useMutation({
    mutationFn: () =>
      endpoints.ordenes.crear({
        tipo,
        prioridad,
        ascensor_id: ascensorId,
        tecnico_id: tecnicoId || null,
        pauta_id: pautaId || null,
        fecha_programada: combinarFechaHora(fecha, hora),
        descripcion: descripcion.trim() || null,
      }),
    onSuccess: async (orden) => {
      await invalidarOrdenes(qc)
      onCreada?.(orden)
      onCerrar()
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    setIntentado(true)
    if (valido && !crear.isPending) crear.mutate()
  }

  const mostrar = (campo: keyof typeof errores) => (intentado ? errores[campo] : null)

  return (
    <Modal
      titulo="Nueva orden de trabajo"
      subtitulo="Se crea en estado Programado; el técnico la ve en su agenda."
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" onClick={onCerrar} className={CLASE_BOTON_SECUNDARIO}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-nueva-ot"
            disabled={crear.isPending}
            className={CLASE_BOTON_PRIMARIO}
          >
            <Plus size={14} /> {crear.isPending ? 'Creando…' : 'Crear orden'}
          </button>
        </>
      }
    >
      <form id="form-nueva-ot" onSubmit={enviar} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo">
            <select
              className={CLASE_INPUT}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoOrdenTrabajo)}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_OT_LABEL[t]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Prioridad" grupo>
            <div className="grid grid-cols-4 gap-1">
              {PRIORIDADES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrioridad(p)}
                  className={`rounded border px-1 py-2 font-mono-brand text-xs font-semibold transition-all ${
                    prioridad === p
                      ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                      : `border-[var(--color-border)] bg-white ${PRIORIDAD_CFG[p].color} hover:border-slate-400`
                  }`}
                >
                  {PRIORIDAD_CFG[p].label}
                </button>
              ))}
            </div>
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Edificio" error={mostrar('edificio')}>
            <select
              className={CLASE_INPUT}
              value={edificioEfectivo}
              onChange={(e) => {
                setEdificioId(e.target.value)
                setAscensorId('')
              }}
              disabled={edificios.isLoading}
            >
              <option value="">{edificios.isLoading ? 'Cargando…' : 'Selecciona edificio'}</option>
              {edificiosOrdenados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} — {e.comuna}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Equipo"
            error={mostrar('equipo')}
            ayuda={
              edificioEfectivo
                ? `${equiposEdificio.length} equipos en ${sectores.length} sector${sectores.length === 1 ? '' : 'es'}`
                : undefined
            }
          >
            <select
              className={CLASE_INPUT}
              value={ascensorId}
              onChange={(e) => setAscensorId(e.target.value)}
              disabled={!edificioEfectivo}
            >
              <option value="">{edificioEfectivo ? 'Selecciona equipo' : 'Primero el edificio'}</option>
              {sectores.map((s) => (
                <optgroup key={s.sector} label={`${s.sector} (${s.total})`}>
                  {s.categorias
                    .flatMap((c) => c.equipos)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.codigo} · {CATEGORIA_CFG[categoriaDe(e)].label}
                        {e.marca ? ` · ${e.marca}` : ''}
                        {e.estado !== 'operacional' ? ` · ${ESTADO_EQUIPO[e.estado].label}` : ''}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Campo>
        </div>

        {edificio?.manas && (
          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Info size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              <b>Mañas del edificio:</b> {edificio.manas}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Campo
            label="Técnico (opcional)"
            ayuda={
              tecnicoId && !ocupacion.isLoading
                ? otsDelTecnico.length === 0
                  ? 'Sin otras OTs ese día.'
                  : `Ya tiene ${otsDelTecnico.length} OT${otsDelTecnico.length === 1 ? '' : 's'} ese día (${[
                      ...new Set(otsDelTecnico.map((o) => o.ascensor.edificio.nombre)),
                    ].join(', ')}).`
                : 'Puedes asignarlo después desde el calendario.'
            }
          >
            <select
              className={CLASE_INPUT}
              value={tecnicoId}
              onChange={(e) => setTecnicoId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {(tecnicos.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                  {t.zona ? ` — ${t.zona}` : ''}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            label="Pauta (checklist)"
            ayuda={
              sugerida && pautaId === sugerida.id ? (
                <span className="flex items-center gap-1 text-[var(--color-accent)]">
                  <Sparkles size={11} /> Sugerida para{' '}
                  {equipo ? CATEGORIA_CFG[categoriaDe(equipo)].label.toLowerCase() : 'el equipo'}
                </span>
              ) : !equipo ? (
                'Se sugiere al elegir el equipo.'
              ) : undefined
            }
          >
            <select
              className={CLASE_INPUT}
              value={pautaId}
              onChange={(e) => setPautaElegida(e.target.value)}
            >
              <option value="">Sin pauta</option>
              {[...(pautas.data ?? [])]
                .sort((a, b) => compararNatural(a.nombre, b.nombre))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
          </Campo>
        </div>

        <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-4">
          <Campo label="Fecha" error={mostrar('fecha')}>
            <input
              type="date"
              className={CLASE_INPUT}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Campo>
          <Campo label="Hora" error={mostrar('hora')}>
            <input
              type="time"
              className={CLASE_INPUT}
              value={hora}
              step={900}
              onChange={(e) => setHora(e.target.value)}
            />
          </Campo>
          <Campo label="Bloque" grupo>
            <div className="flex gap-1">
              {(['manana', 'tarde'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHora(HORA_DEFECTO[m])}
                  className={`rounded border px-3 py-2 text-xs transition-all ${
                    hora === HORA_DEFECTO[m]
                      ? 'border-[var(--color-navy)] bg-[var(--color-navy)] text-white'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-slate-400'
                  }`}
                >
                  {m === 'manana' ? 'Mañana' : 'Tarde'}
                </button>
              ))}
            </div>
          </Campo>
        </div>

        {fecha && (esDomingo(fecha) || fecha < hoy || equipo?.estado === 'critico') && (
          <div className="space-y-1">
            {esDomingo(fecha) && <Advertencia texto="La fecha cae en domingo." />}
            {fecha < hoy && (
              <Advertencia texto="La fecha ya pasó: la orden quedará como Vencida hasta completarse." />
            )}
            {equipo?.estado === 'critico' && (
              <Advertencia texto={`${equipo.codigo} está en estado Crítico: considera prioridad Alta o Crítica.`} />
            )}
          </div>
        )}

        <Campo label="Descripción">
          <textarea
            rows={3}
            className={CLASE_INPUT}
            value={descripcion}
            placeholder="Qué hay que hacer, accesos, contacto en sitio…"
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Campo>

        {crear.error && <AvisoError texto={mensajeError(crear.error)} />}
      </form>
    </Modal>
  )
}

function Advertencia({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-amber-700">
      <AlertTriangle size={12} /> {texto}
    </div>
  )
}
