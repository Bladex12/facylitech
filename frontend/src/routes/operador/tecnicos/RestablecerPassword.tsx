import { useId, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Dices, Loader2, ShieldAlert } from 'lucide-react'
import { endpoints } from '../../../api/endpoints'
import type { Usuario } from '../../../api/types'
import { CampoPassword } from '../../../auth/CampoPassword'
import { describirErrorPassword } from '../../../auth/errores'
import { HojaModal } from '../../../auth/HojaModal'
import { generarPassword, MIN_PASSWORD, validarPasswordNueva } from '../../../auth/sesion'

type Paso = 'confirmar' | 'formulario' | 'listo'

/**
 * El operador define una contraseña nueva para un técnico (`PUT /usuarios/{id}/password`).
 * No hay recuperación por correo: este es el camino cuando alguien la olvida.
 */
export function RestablecerPassword({ tecnico, onCerrar }: { tecnico: Usuario; onCerrar: () => void }) {
  const idError = useId()
  const [paso, setPaso] = useState<Paso>('confirmar')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [entregada, setEntregada] = useState('')
  const [copiada, setCopiada] = useState(false)

  function generar() {
    const p = generarPassword()
    setNueva(p)
    setConfirmacion(p)
    setError(null)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    const invalida = validarPasswordNueva(nueva, confirmacion)
    if (invalida) {
      setError(invalida)
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await endpoints.usuarios.restablecerPassword(tecnico.id, nueva)
      setEntregada(nueva)
      setNueva('')
      setConfirmacion('')
      setPaso('listo')
    } catch (err) {
      setError(describirErrorPassword(err))
    } finally {
      setEnviando(false)
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(entregada)
      setCopiada(true)
    } catch {
      setCopiada(false)
    }
  }

  if (paso === 'confirmar') {
    return (
      <HojaModal titulo="Restablecer contraseña" onCerrar={onCerrar}>
        <div className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p>
            Vas a definir una contraseña nueva para <strong>{tecnico.nombre}</strong>. La contraseña
            actual dejará de funcionar y tendrás que entregarle la nueva en persona o por un canal
            seguro.
          </p>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[var(--color-bg-subtle)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setPaso('formulario')}
            className="rounded bg-[var(--color-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Continuar
          </button>
        </div>
      </HojaModal>
    )
  }

  if (paso === 'listo') {
    return (
      <HojaModal titulo="Contraseña restablecida" onCerrar={onCerrar}>
        <div className="space-y-4" role="status">
          <div className="flex items-start gap-3 text-sm text-[var(--color-text-muted)]">
            <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-green-600" aria-hidden="true" />
            <p>
              Ya puede iniciar sesión <strong className="text-[var(--color-text)]">{tecnico.nombre}</strong> con
              la contraseña nueva. Guárdala ahora: no se vuelve a mostrar.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2.5">
            <code className="flex-1 font-mono-brand text-base tracking-wide break-all select-all">{entregada}</code>
            <button
              type="button"
              onClick={copiar}
              className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-white/60"
            >
              <Copy size={13} aria-hidden="true" /> {copiada ? 'Copiada' : 'Copiar'}
            </button>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            autoFocus
            className="w-full rounded bg-[var(--color-navy)] py-3 font-semibold text-white hover:opacity-90"
          >
            Listo
          </button>
        </div>
      </HojaModal>
    )
  }

  return (
    <HojaModal
      titulo="Nueva contraseña"
      subtitulo={tecnico.nombre}
      onCerrar={onCerrar}
      bloqueado={enviando}
    >
      <form onSubmit={enviar} className="space-y-4" aria-describedby={error ? idError : undefined}>
        <CampoPassword
          label="Contraseña nueva"
          value={nueva}
          onChange={setNueva}
          autoComplete="new-password"
          disabled={enviando}
          ayuda={`Mínimo ${MIN_PASSWORD} caracteres.`}
        />
        <CampoPassword
          label="Confirmar contraseña nueva"
          value={confirmacion}
          onChange={setConfirmacion}
          autoComplete="new-password"
          disabled={enviando}
        />
        <button
          type="button"
          onClick={generar}
          disabled={enviando}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
        >
          <Dices size={15} aria-hidden="true" /> Generar una contraseña
        </button>

        <div aria-live="polite" id={idError}>
          {error && (
            <p className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            className="rounded border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[var(--color-bg-subtle)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="flex items-center justify-center gap-2 rounded bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {enviando ? 'Guardando…' : 'Restablecer contraseña'}
          </button>
        </div>
      </form>
    </HojaModal>
  )
}
