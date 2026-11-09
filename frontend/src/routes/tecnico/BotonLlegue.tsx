import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Loader2, MapPin, MapPinOff } from 'lucide-react'
import { reportarUbicacion, type ResultadoUbicacion } from './hooks'

const MENSAJE: Record<ResultadoUbicacion, string> = {
  enviada: 'Llegada informada a la central',
  sin_gps: 'No se pudo leer el GPS. Activa la ubicación e inténtalo de nuevo.',
  error: 'Sin conexión: no se pudo informar la llegada. Reintenta con señal.',
}

/**
 * Tracking GPS por eventos de botones (Gantt 26-oct a 1-nov): el técnico avisa
 * que llegó al edificio y la central ve su posición actualizada en el mapa.
 * Es opcional: Iniciar y Completar también reportan la ubicación (RNF-01, no
 * agrega pasos obligatorios).
 */
export function BotonLlegue({ usuarioId }: { usuarioId: string }) {
  const [ultimo, setUltimo] = useState<{ resultado: ResultadoUbicacion; hora: Date } | null>(null)
  const llegue = useMutation({
    mutationFn: () => reportarUbicacion(usuarioId),
    onSuccess: (resultado) => setUltimo({ resultado, hora: new Date() }),
  })

  const ok = ultimo?.resultado === 'enviada'
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => llegue.mutate()}
        disabled={llegue.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-navy)] bg-white py-3 text-sm font-semibold text-[var(--color-navy)] active:bg-[var(--color-bg)] disabled:opacity-60"
      >
        {llegue.isPending ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
        {ok ? 'Actualizar mi ubicación' : 'Llegué al edificio'}
      </button>
      {ultimo && (
        <p
          role="status"
          className={`flex items-center justify-center gap-1.5 text-xs ${ok ? 'text-green-700' : 'text-amber-700'}`}
        >
          {ok ? <CheckCircle2 size={12} /> : <MapPinOff size={12} />}
          {MENSAJE[ultimo.resultado]}
          {ok &&
            ` · ${ultimo.hora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`}
        </p>
      )}
    </div>
  )
}
