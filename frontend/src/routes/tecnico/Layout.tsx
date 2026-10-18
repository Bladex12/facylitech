import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  ClipboardList,
  KeyRound,
  LogOut,
  MapPin,
  MessageSquare,
  ScanLine,
  Wrench,
  WifiOff,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { CambiarPassword } from '../../auth/CambiarPassword'
import { useNoLeidos } from '../../components/mensajes/useMensajes'
import { useEnLinea } from '../../lib/red'
import { useAsignacionesPendientes } from './hooks'

function Badge({ n, tono }: { n: number; tono: 'rojo' | 'naranjo' }) {
  if (n <= 0) return null
  return (
    <span
      className={`absolute -top-1.5 left-1/2 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-white ${
        tono === 'rojo' ? 'animate-pulse bg-red-600' : 'bg-[var(--color-accent)]'
      }`}
    >
      {n > 9 ? '9+' : n}
    </span>
  )
}

/** Identidad del técnico en la cabecera; al tocarla se abre el menú de cuenta (sin pasos extra en el trabajo). */
function MenuUsuario({
  iniciales,
  nombre,
  detalle,
  email,
  onCambiarPassword,
  onCerrarSesion,
}: {
  iniciales: string
  nombre: string
  detalle: string
  email: string
  onCambiarPassword: () => void
  onCerrarSesion: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  return (
    <div ref={raiz} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Menú de cuenta"
        className="-ml-1 flex w-full min-w-0 items-center gap-3 rounded p-1 text-left active:bg-white/10"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[var(--color-accent)]/20 font-mono-brand text-xs font-bold text-[var(--color-accent)]">
          {iniciales || <Building2 size={14} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight font-semibold">{nombre}</span>
          <span className="block truncate font-mono-brand text-[10px] text-slate-400">{detalle}</span>
        </span>
        <ChevronDown size={14} className="flex-shrink-0 text-slate-400" aria-hidden="true" />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-2 w-64 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-xl"
        >
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="truncate text-sm font-semibold">{nombre}</p>
            <p className="truncate text-xs text-[var(--color-text-muted)]">{email}</p>
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setAbierto(false)
              onCambiarPassword()
            }}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm active:bg-[var(--color-bg-subtle)]"
          >
            <KeyRound size={16} className="text-[var(--color-text-muted)]" aria-hidden="true" /> Cambiar contraseña
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setAbierto(false)
              onCerrarSesion()
            }}
            className="flex w-full items-center gap-2.5 border-t border-[var(--color-border)] px-4 py-3 text-left text-sm text-red-700 active:bg-red-50"
          >
            <LogOut size={16} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function TecnicoLayout() {
  const { usuario, logout } = useAuth()
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const enLinea = useEnLinea()
  const { data: pendientes } = useAsignacionesPendientes()
  const noLeidos = useNoLeidos(usuario?.id)
  const nEmergencias = pendientes?.length ?? 0

  const nav = [
    { to: '/tecnico/agenda', label: 'Agenda', Icon: ClipboardList, badge: 0 },
    { to: '/tecnico/trabajos', label: 'Trabajos', Icon: Wrench, badge: 0 },
    { to: '/tecnico/mapa', label: 'Mapa', Icon: MapPin, badge: 0 },
    { to: '/tecnico/emergencias', label: 'Emergencias', Icon: Zap, badge: nEmergencias },
    { to: '/tecnico/mensajes', label: 'Mensajes', Icon: MessageSquare, badge: noLeidos },
  ]

  const iniciales = (usuario?.nombre ?? '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--color-bg)] shadow-xl">
      <header className="flex flex-shrink-0 items-center gap-3 bg-[var(--color-navy)] px-4 py-2.5 text-white">
        <MenuUsuario
          iniciales={iniciales}
          nombre={usuario?.nombre ?? ''}
          detalle={usuario?.zona ?? 'Técnico'}
          email={usuario?.email ?? ''}
          onCambiarPassword={() => setCambiandoPassword(true)}
          onCerrarSesion={logout}
        />
        <Link
          to="/tecnico/escanear"
          aria-label="Escanear QR del equipo"
          className="flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white active:bg-[var(--color-accent-hover)]"
        >
          <ScanLine size={15} /> Escanear
        </Link>
      </header>

      {!enLinea && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <WifiOff size={13} className="flex-shrink-0" />
          Sin conexión — ves los últimos datos cargados. Lo que guardes ahora no se enviará hasta recuperar la señal.
        </div>
      )}

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>

      <nav className="flex flex-shrink-0 border-t border-[var(--color-border)] bg-white pb-[env(safe-area-inset-bottom)]">
        {nav.map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium ${
                isActive ? 'text-[var(--color-accent)]' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-b bg-[var(--color-accent)]" />
                )}
                <span className="relative">
                  <Icon size={19} />
                  <Badge n={badge} tono={to.endsWith('emergencias') ? 'rojo' : 'naranjo'} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {cambiandoPassword && <CambiarPassword onCerrar={() => setCambiandoPassword(false)} />}
    </div>
  )
}
