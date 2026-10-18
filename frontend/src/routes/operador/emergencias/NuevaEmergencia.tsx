import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Zap } from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type { Emergencia, Especialidad } from '../../../api/types'
import { EMERGENCIA_COLOR_CLASS, EMERGENCIA_LABEL } from '../../../domain/emergencias'

const TIPOS = Object.keys(EMERGENCIA_LABEL) as Especialidad[]

const LABEL_CLS =
  'mb-1.5 block text-xs font-semibold tracking-widest text-[var(--color-text-muted)] uppercase'
const INPUT_CLS =
  'w-full rounded border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none disabled:bg-[var(--color-bg-subtle)]'

/** Registro rápido de una emergencia (RNF-01: no más pasos que tomar el aviso en papel). */
export function NuevaEmergencia({
  onCerrar,
  onCreada,
}: {
  onCerrar: () => void
  onCreada: (e: Emergencia) => void
}) {
  const queryClient = useQueryClient()
  const [tipo, setTipo] = useState<Especialidad | null>(null)
  const [edificioId, setEdificioId] = useState('')
  const [ascensorId, setAscensorId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [solicitante, setSolicitante] = useState('')

  const edificios = useQuery({
    queryKey: ['edificios', 'lista'],
    queryFn: () => endpoints.edificios.listar(),
  })
  const ascensores = useQuery({
    queryKey: ['ascensores', 'edificio', edificioId],
    queryFn: () => endpoints.ascensores.listar(edificioId),
    enabled: !!edificioId,
  })

  const crear = useMutation({
    mutationFn: () =>
      endpoints.emergencias.crear({
        tipo: tipo!,
        edificio_id: edificioId,
        ascensor_id: ascensorId || null,
        descripcion: descripcion.trim() || null,
        solicitante: solicitante.trim() || null,
      }),
    onSuccess: (e) => {
      queryClient.invalidateQueries({ queryKey: ['emergencias'] })
      queryClient.invalidateQueries({ queryKey: ['mapa'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onCreada(e)
    },
  })

  useEffect(() => {
    const alPresionar = (ev: KeyboardEvent) => ev.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onCerrar])

  const valido = tipo !== null && edificioId !== ''

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (valido && !crear.isPending) crear.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-[var(--color-navy)]/50 p-4"
      onMouseDown={(ev) => ev.target === ev.currentTarget && onCerrar()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-nueva-emergencia"
    >
      <form
        onSubmit={enviar}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h3 id="titulo-nueva-emergencia" className="flex items-center gap-2 text-lg font-bold text-[var(--color-text)]">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-red-600">
              <Zap size={14} className="text-white" />
            </span>
            Nueva emergencia
          </h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded p-1 hover:bg-[var(--color-bg-subtle)]">
            <X size={16} className="text-[var(--color-text-muted)]" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <span className={LABEL_CLS}>Tipo *</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIPOS.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTipo(t)}
                  aria-pressed={tipo === t}
                  className={`flex items-center gap-2 rounded border-2 px-2.5 py-2 text-left text-xs font-medium transition-all ${
                    tipo === t
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-text)]'
                      : 'border-[var(--color-border)] text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${EMERGENCIA_COLOR_CLASS[t]}`} />
                  {EMERGENCIA_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="em-edificio" className={LABEL_CLS}>
                Edificio *
              </label>
              <select
                id="em-edificio"
                value={edificioId}
                onChange={(e) => {
                  setEdificioId(e.target.value)
                  setAscensorId('')
                }}
                className={INPUT_CLS}
                disabled={edificios.isLoading}
              >
                <option value="">{edificios.isLoading ? 'Cargando…' : 'Selecciona…'}</option>
                {edificios.data?.items
                  .slice()
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} — {e.comuna}
                    </option>
                  ))}
              </select>
              {edificios.isError && (
                <p className="mt-1 text-[11px] text-red-600">No se pudieron cargar los edificios.</p>
              )}
            </div>
            <div>
              <label htmlFor="em-ascensor" className={LABEL_CLS}>
                Equipo <span className="font-normal normal-case tracking-normal">(opcional)</span>
              </label>
              <select
                id="em-ascensor"
                value={ascensorId}
                onChange={(e) => setAscensorId(e.target.value)}
                className={INPUT_CLS}
                disabled={!edificioId || ascensores.isLoading}
              >
                <option value="">
                  {!edificioId ? 'Primero el edificio' : ascensores.isLoading ? 'Cargando…' : 'Sin especificar'}
                </option>
                {ascensores.data?.items.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo}
                    {a.torre ? ` · Torre ${a.torre}` : ''}
                    {a.estado !== 'operacional' ? ` (${a.estado.replace('_', ' ')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="em-descripcion" className={LABEL_CLS}>
              Descripción
            </label>
            <textarea
              id="em-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Ej.: 2 personas atrapadas entre pisos 4 y 5, puerta no abre."
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          <div>
            <label htmlFor="em-solicitante" className={LABEL_CLS}>
              Solicitante
            </label>
            <input
              id="em-solicitante"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              placeholder="Quién avisa (conserjería, administración, teléfono…)"
              className={INPUT_CLS}
            />
          </div>

          {crear.isError && (
            <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">
              No se pudo registrar: {(crear.error as Error).message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-5 py-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded border border-[var(--color-border)] bg-white px-4 py-2 text-sm text-slate-700 hover:bg-[var(--color-bg-subtle)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valido || crear.isPending}
            className="flex items-center gap-1.5 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Zap size={13} /> {crear.isPending ? 'Registrando…' : 'Registrar y despachar'}
          </button>
        </div>
      </form>
    </div>
  )
}
