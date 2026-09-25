import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, MapPin, MessageSquare, Wrench, Zap } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'

const NAV = [
  { to: '/tecnico/agenda', label: 'Agenda', Icon: ClipboardList },
  { to: '/tecnico/trabajos', label: 'Trabajos', Icon: Wrench },
  { to: '/tecnico/mapa', label: 'Mapa', Icon: MapPin },
  { to: '/tecnico/emergencias', label: 'Emergencias', Icon: Zap },
  { to: '/tecnico/mensajes', label: 'Mensajes', Icon: MessageSquare },
]

export function TecnicoLayout() {
  const { usuario, setUsuario } = useAuth()

  return (
    <div
      className="mx-auto flex h-screen max-w-md flex-col"
      style={{ background: 'var(--color-bg)' }}
    >
      <header
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: 'var(--color-navy)' }}
      >
        <div>
          <p className="text-sm font-semibold">Facylitech Técnico</p>
          <p className="text-xs text-slate-400">{usuario?.nombre}</p>
        </div>
        <button
          onClick={() => setUsuario(null)}
          className="text-xs text-slate-400 underline hover:text-slate-200"
        >
          Salir
        </button>
      </header>
      <main className="flex-1 overflow-auto pb-16">
        <Outlet />
      </main>
      <nav
        className="fixed bottom-0 mx-auto flex w-full max-w-md border-t bg-white"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                isActive ? 'text-[var(--color-accent)]' : 'text-slate-400'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
