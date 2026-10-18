import { useEffect, useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Building2, CalendarCheck, ClipboardCheck, Info, Loader2, Zap } from 'lucide-react'
import { useAuth } from './AuthContext'
import { CampoPassword } from './CampoPassword'
import { describirErrorLogin } from './errores'
import { PantallaCarga } from './PantallaCarga'
import { destinoTrasLogin, formatoEspera } from './sesion'

/** Cuentas del seed (docs/contrato-auth.md). Solo rellenan el formulario; nunca inician sesión solas. */
const CUENTAS_DEMO = [
  { etiqueta: 'Operador', email: 'operador@facylitech.cl' },
  { etiqueta: 'Melvin', email: 'melvin.zuniga@facylitech.cl' },
  { etiqueta: 'Jorge', email: 'jorge.candia@facylitech.cl' },
  { etiqueta: 'Juan', email: 'juan.cubillos@facylitech.cl' },
]
const PASSWORD_DEMO = 'facylitech2026'
const MOSTRAR_CUENTAS_DEMO = import.meta.env.VITE_MOSTRAR_CUENTAS_DEMO === 'true'

const FUNCIONES = [
  { Icono: ClipboardCheck, titulo: 'Papeleta digital', texto: 'Checklist, piezas y fotos desde el celular.' },
  { Icono: CalendarCheck, titulo: 'Calendario con semáforos', texto: 'Vencidos, en curso y programados a la vista.' },
  { Icono: Zap, titulo: 'Emergencias por cercanía', texto: 'El operador aprueba a quién despachar.' },
]

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

  function rellenar(correo: string) {
    setEmail(correo)
    setPassword(PASSWORD_DEMO)
    setError(null)
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row" style={{ background: 'var(--color-navy)' }}>
      {/* Panel de marca: completo en escritorio, franja compacta en celular */}
      <div className="relative hidden w-5/12 flex-col justify-between overflow-hidden p-16 lg:flex">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="absolute rounded border border-white/5" style={{ inset: `${i * 40}px` }} />
          ))}
        </div>
        <div className="relative z-10">
          <div className="mb-20 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--color-accent)]">
              <Building2 size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-wide text-white">Facylitech</span>
          </div>
          <p className="mb-5 text-5xl leading-[1.15] font-bold text-white">
            Gestión integral
            <br />
            de mantenimiento
            <br />
            <span className="text-[var(--color-accent)]">de ascensores</span>
          </p>
          <p className="max-w-xs leading-relaxed text-slate-400">
            Plataforma para operadores y técnicos. Papeleta digital, calendario con semáforos y
            emergencias por geolocalización.
          </p>
        </div>
        <ul className="relative z-10 grid grid-cols-3 gap-3">
          {FUNCIONES.map(({ Icono, titulo, texto }) => (
            <li key={titulo} className="rounded border border-white/10 p-4">
              <Icono size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
              <div className="mt-2 text-sm font-semibold text-white">{titulo}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{texto}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--color-accent)]">
          <Building2 size={18} className="text-white" />
        </div>
        <div>
          <div className="text-lg leading-tight font-bold tracking-wide text-white">Facylitech</div>
          <div className="text-xs text-slate-400">Mantenimiento de ascensores</div>
        </div>
      </div>

      {/* Panel de acceso */}
      <main className="flex flex-1 items-start justify-center rounded-t-2xl bg-[var(--color-bg)] px-5 pt-8 pb-10 sm:items-center sm:p-8 lg:rounded-none">
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

          {MOSTRAR_CUENTAS_DEMO && (
            <div className="mt-8 rounded border border-dashed border-[var(--color-border)] p-4">
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
                Cuentas de demostración
              </p>
              <div className="flex flex-wrap gap-2">
                {CUENTAS_DEMO.map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => rellenar(c.email)}
                    disabled={enviando}
                    title={c.email}
                    className="rounded border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
                  >
                    {c.etiqueta}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Solo rellenan el formulario; luego presiona Entrar.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
