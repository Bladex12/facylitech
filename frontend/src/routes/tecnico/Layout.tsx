import { Link, NavLink, Outlet } from 'react-router-dom'
import { Building2, ClipboardList, LogOut, MapPin, MessageSquare, ScanLine, Wrench, WifiOff, Zap } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
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

export function TecnicoLayout() {
  const { usuario, setUsuario } = useAuth()
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
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[var(--color-accent)]/20 font-mono-brand text-xs font-bold text-[var(--color-accent)]">
          {iniciales || <Building2 size={14} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-semibold">{usuario?.nombre}</p>
          <p className="truncate font-mono-brand text-[10px] text-slate-400">
            {usuario?.zona ?? 'Técnico'}
          </p>
        </div>
        <Link
          to="/tecnico/escanear"
          aria-label="Escanear QR del equipo"
          className="flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white active:bg-[var(--color-accent-hover)]"
        >
          <ScanLine size={15} /> Escanear
        </Link>
        <button
          onClick={() => setUsuario(null)}
          aria-label="Cerrar sesión"
          className="-mr-1 rounded p-2 text-slate-400 active:bg-white/10"
        >
          <LogOut size={16} />
        </button>
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
    </div>
  )
}
