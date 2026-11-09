import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2 } from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type { ReplicacionCronograma } from '../../../api/types'
import { sumarMeses } from '../../../domain/fechas'
import { parsearMes } from '../../../domain/replicacion'
import { mensajeError } from '../comun/errores'
import { PanelReplicacion } from './PanelReplicacion'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Botón "Replicar a {mes}" del mockup: copia las mantenciones del mes visible al
 * mes siguiente (4 semanas después, mismo día de la semana y hora; ver
 * backend/app/domain/replicacion.py). Primero muestra una vista previa y solo
 * crea las OTs cuando el operador confirma.
 *
 * Devuelve el botón (va en la cabecera, junto al navegador de mes) y el panel
 * de vista previa/resultado (va debajo de la cabecera) por separado.
 */
export function useReplicarCronograma(
  anio: number,
  mes: number,
  onVerDestino: (anio: number, mes: number) => void,
): { boton: ReactNode; panel: ReactNode } {
  const queryClient = useQueryClient()
  const [resultado, setResultado] = useState<ReplicacionCronograma | null>(null)
  const mesOrigen = `${anio}-${String(mes).padStart(2, '0')}`
  const destino = sumarMeses(anio, mes, 1)

  const replicar = useMutation({
    mutationFn: (simular: boolean) => endpoints.ordenes.replicar(mesOrigen, simular),
    onSuccess: (r) => {
      setResultado(r)
      if (!r.simulacion) queryClient.invalidateQueries({ queryKey: ['ordenes'] })
    },
  })

  // El panel es del mes en que se abrió: si el operador navega a otro mes, se descarta.
  const vigente = resultado && resultado.mes_origen === mesOrigen ? resultado : null
  const cerrar = () => {
    setResultado(null)
    replicar.reset()
  }

  const boton = (
    <button
      onClick={() => replicar.mutate(true)}
      disabled={replicar.isPending}
      className="flex items-center gap-1.5 rounded bg-[var(--color-navy)] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {replicar.isPending && replicar.variables ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
      Replicar a {MESES_CORTOS[destino.mes - 1]}
    </button>
  )
  const panel =
    vigente || replicar.isError ? (
      <PanelReplicacion
        resultado={vigente}
        error={replicar.isError ? mensajeError(replicar.error) : null}
        confirmando={replicar.isPending && replicar.variables === false}
        onConfirmar={() => replicar.mutate(false)}
        onCerrar={cerrar}
        onVerDestino={() => {
          const d = parsearMes(vigente!.mes_destino)
          cerrar()
          onVerDestino(d.anio, d.mes)
        }}
      />
    ) : null
  return { boton, panel }
}
