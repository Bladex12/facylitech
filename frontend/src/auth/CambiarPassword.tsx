import { useId, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { endpoints } from '../api/endpoints'
import { CampoPassword } from './CampoPassword'
import { describirErrorPassword } from './errores'
import { HojaModal } from './HojaModal'
import { MIN_PASSWORD, validarPasswordNueva } from './sesion'

/**
 * Cambio de la propia contraseña (`POST /auth/cambiar-password`). Reutilizable
 * en ambos layouts: hoja inferior en celular, modal centrado en escritorio.
 */
export function CambiarPassword({ onCerrar }: { onCerrar: () => void }) {
  const idError = useId()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

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
      await endpoints.auth.cambiarPassword(actual, nueva)
      setListo(true)
    } catch (err) {
      // 400 del backend: "La contraseña actual no es correcta", igual a la actual, etc.
      setError(describirErrorPassword(err))
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <HojaModal titulo="Contraseña actualizada" onCerrar={onCerrar}>
        <div className="flex flex-col items-center gap-3 py-2 text-center" role="status">
          <CheckCircle2 size={36} className="text-green-600" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-muted)]">
            Tu contraseña se cambió correctamente. Úsala la próxima vez que inicies sesión.
          </p>
          <button
            type="button"
            onClick={onCerrar}
            autoFocus
            className="mt-2 w-full rounded bg-[var(--color-navy)] py-3 font-semibold text-white hover:opacity-90"
          >
            Listo
          </button>
        </div>
      </HojaModal>
    )
  }

  return (
    <HojaModal titulo="Cambiar contraseña" subtitulo="Debe tener al menos 8 caracteres." onCerrar={onCerrar} bloqueado={enviando}>
      <form onSubmit={enviar} className="space-y-4" aria-describedby={error ? idError : undefined}>
        <CampoPassword
          label="Contraseña actual"
          value={actual}
          onChange={setActual}
          autoComplete="current-password"
          disabled={enviando}
        />
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
            className="rounded border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[var(--color-bg-subtle)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="flex items-center justify-center gap-2 rounded bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {enviando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </HojaModal>
  )
}
