import { useEffect, useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import { useAuth } from './useAuth'
import { CampoPassword } from './CampoPassword'
import { describirErrorLogin } from './errores'
import { PantallaCarga } from './PantallaCarga'
import { destinoTrasLogin, formatoEspera } from './sesion'

export function Login() {
  const { usuario, cargando, motivoCierre, login } = useAuth()
  const location = useLocation()
  const idError = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  // Cuenta regresiva del bloqueo temporal (429 con Retry-After).
  useEffect(() => {
    if (bloqueadoHasta === null) return
    const t = window.setInterval(() => {
      const ya = Date.now()
      setAhora(ya)
      if (ya >= bloqueadoHasta) {
        setBloqueadoHasta(null)
        setError(null)
      }
    }, 1000)
    return () => window.clearInterval(t)
  }, [bloqueadoHasta])

  if (cargando) return <PantallaCarga />
  if (usuario) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from
    return <Navigate to={destinoTrasLogin(from, usuario.rol)} replace />
  }

  const segundosBloqueo = bloqueadoHasta !== null ? Math.max(0, Math.ceil((bloqueadoHasta - ahora) / 1000)) : 0
  const bloqueado = segundosBloqueo > 0
  const mensajeError = bloqueado
    ? `Demasiados intentos fallidos. Vuelve a intentarlo en ${formatoEspera(segundosBloqueo)}.`
    : error

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (enviando || bloqueado) return
    setEnviando(true)
    setError(null)
    try {
      await login(email, password)
      // Con la sesión creada este componente redirige solo (ver arriba).
    } catch (err) {
      const { texto, bloqueoSegundos } = describirErrorLogin(err)
      setError(texto)
      setPassword('')
      if (bloqueoSegundos) {
        setAhora(Date.now())
        setBloqueadoHasta(Date.now() + bloqueoSegundos * 1000)
      }
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-dvh bg-[var(--color-bg)]">
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:p-8">
        <div className="w-full max-w-md">
          <h1 className="mb-1 text-3xl font-bold text-[var(--color-text)]">Iniciar sesión</h1>
          <p className="mb-6 text-[var(--color-text-muted)]">Ingresa con tu correo y contraseña de Facylitech.</p>

          {motivoCierre === 'expirada' && !mensajeError && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
            >
              <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              Tu sesión expiró. Inicia sesión nuevamente para continuar.
            </div>
          )}

          <form onSubmit={enviar} className="space-y-4" aria-describedby={mensajeError ? idError : undefined}>
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-semibold tracking-widest text-[var(--color-text-muted)] uppercase"
              >
                Correo
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
                disabled={enviando}
                placeholder="nombre@facylitech.cl"
                aria-invalid={!!mensajeError || undefined}
                className="w-full rounded border border-[var(--color-border)] bg-white px-4 py-3 text-base text-[var(--color-text)] transition outline-none placeholder:text-slate-400 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 disabled:bg-[var(--color-bg-subtle)] aria-[invalid=true]:border-red-400"
              />
            </div>

            <CampoPassword
              label="Contraseña"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              disabled={enviando}
              invalido={!!mensajeError}
            />

            <div aria-live="polite" id={idError}>
              {mensajeError && (
                <p
                  className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  {mensajeError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={enviando || bloqueado}
              className="flex w-full items-center justify-center gap-2 rounded bg-[var(--color-accent)] py-3.5 font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? (
                <>
                  <Loader2 size={17} className="animate-spin" aria-hidden="true" /> Ingresando…
                </>
              ) : bloqueado ? (
                `Reintentar en ${formatoEspera(segundosBloqueo)}`
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
