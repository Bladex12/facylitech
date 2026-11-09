import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import type { ReplicacionCronograma } from '../../../api/types'
import { formatoMesAnio } from '../../../domain/fechas'
import { parsearMes, resumirPorDia } from '../../../domain/replicacion'
import { formatoDiaCorto } from '../../../domain/semana'

/** Vista previa (ámbar, con confirmar) o resultado (verde) de "Replicar a {mes}". */
export function PanelReplicacion({
  resultado,
  error,
  confirmando,
  onConfirmar,
  onCerrar,
  onVerDestino,
}: {
  resultado: ReplicacionCronograma | null
  error: string | null
  confirmando: boolean
  onConfirmar: () => void
  onCerrar: () => void
  onVerDestino: () => void
}) {
  const cerrarBtn = (
    <button onClick={onCerrar} aria-label="Cerrar" className="text-current opacity-60 hover:opacity-100">
      <X size={14} />
    </button>
  )
  if (error && !resultado)
    return (
      <div
        role="alert"
        className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        <span>No se pudo replicar el cronograma: {error}</span>
        {cerrarBtn}
      </div>
    )
  if (!resultado) return null

  const { anio, mes } = parsearMes(resultado.mes_destino)
  const nombreDestino = formatoMesAnio(anio, mes)
  const yaProgramadas = resultado.omitidas.filter((o) => o.motivo === 'ya_programada').length
  const duplicadas = resultado.omitidas.length - yaProgramadas

  if (!resultado.simulacion)
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
      >
        <span className="flex items-center gap-2">
          <CheckCircle2 size={15} />
          {resultado.total_crear > 0
            ? `Replicación completada: ${resultado.total_crear} mantenciones programadas en ${nombreDestino}.`
            : `No había mantenciones nuevas que crear en ${nombreDestino}.`}
        </span>
        <span className="flex items-center gap-3">
          <button onClick={onVerDestino} className="text-xs font-semibold underline">
            Ver {nombreDestino}
          </button>
          {cerrarBtn}
        </span>
      </div>
    )

  const dias = resumirPorDia(resultado.crear)
  const sinTecnico = dias.reduce((n, d) => n + d.sinTecnico, 0)
  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold">
          {resultado.total_crear > 0
            ? `Se programarán ${resultado.total_crear} mantenciones en ${nombreDestino}`
            : `No hay mantenciones nuevas para replicar a ${nombreDestino}`}
        </div>
        {cerrarBtn}
      </div>
      <p className="text-xs text-amber-800">
        Cada mantención se programa 4 semanas después (5 si con 4 cae en el mismo mes): mismo día de la semana, misma
        hora y mismo técnico.
      </p>

      {dias.length > 0 && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {dias.map((d) => {
            const c = formatoDiaCorto(d.dia)
            return (
              <li key={d.dia} className="font-mono-brand text-xs">
                <span className="font-semibold capitalize">
                  {c.dia} {c.numero}
                </span>{' '}
                · {d.cantidad} equipo{d.cantidad > 1 ? 's' : ''} · {d.edificios.join(', ')}
              </li>
            )
          })}
        </ul>
      )}

      {(yaProgramadas > 0 || duplicadas > 0 || sinTecnico > 0) && (
        <div className="space-y-0.5 text-xs">
          {yaProgramadas > 0 && (
            <div>
              {yaProgramadas} equipo{yaProgramadas > 1 ? 's' : ''} ya tiene{yaProgramadas > 1 ? 'n' : ''} mantención en{' '}
              {nombreDestino}: se omite{yaProgramadas > 1 ? 'n' : ''}.
            </div>
          )}
          {duplicadas > 0 && (
            <div>
              {duplicadas} mantención{duplicadas > 1 ? 'es' : ''} repetida{duplicadas > 1 ? 's' : ''} del mismo equipo
              en el mes actual: se replica solo la primera.
            </div>
          )}
          {sinTecnico > 0 && (
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={12} /> {sinTecnico} quedará{sinTecnico > 1 ? 'n' : ''} sin técnico (técnico
              inactivo): asígnalas después.
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {resultado.total_crear > 0 && (
          <button
            onClick={onConfirmar}
            disabled={confirmando}
            className="flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {confirmando && <Loader2 size={12} className="animate-spin" />}
            Confirmar replicación
          </button>
        )}
        <button
          onClick={onCerrar}
          className="rounded border border-amber-300 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
        >
          {resultado.total_crear > 0 ? 'Cancelar' : 'Cerrar'}
        </button>
      </div>
    </div>
  )
}
