import { Link } from 'react-router-dom'
import { ChevronRight, Zap } from 'lucide-react'
import { formatoCuentaRegresiva, segundosRestantes } from '../../domain/tiempo'
import { useAhora } from '../../lib/red'
import { ESPECIALIDAD_LABEL } from './etiquetas'
import { useAsignacionesPendientes } from './hooks'

/** Aviso rojo en la Agenda cuando el operador me asignó una emergencia pendiente. */
export function BannerEmergencia() {
  const { data } = useAsignacionesPendientes()
  const ahora = useAhora(1000)
  const pendientes = data ?? []
  if (pendientes.length === 0) return null
  const primera = pendientes[0]
  const restantes = segundosRestantes(primera.expira_at, ahora)

  return (
    <Link
      to="/tecnico/emergencias"
      className="flex items-center gap-3 rounded-lg bg-red-600 p-3.5 text-white shadow-md shadow-red-600/25 active:bg-red-700"
    >
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-white/15">
        <span className="absolute inset-0 animate-ping rounded bg-white/20" />
        <Zap size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono-brand text-[10px] tracking-widest uppercase opacity-80">
          {pendientes.length > 1
            ? `${pendientes.length} emergencias pendientes`
            : 'Emergencia asignada'}
        </div>
        <div className="truncate font-semibold">
          {ESPECIALIDAD_LABEL[primera.emergencia.tipo]} · {primera.emergencia.edificio.nombre}
        </div>
        <div className="text-xs opacity-90">
          {restantes != null && restantes > 0
            ? `Responde en ${formatoCuentaRegresiva(restantes)}`
            : 'Responde ahora'}
        </div>
      </div>
      <ChevronRight size={18} className="flex-shrink-0" />
    </Link>
  )
}
