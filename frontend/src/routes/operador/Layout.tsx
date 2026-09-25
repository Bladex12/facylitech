import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Wifi, Zap } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { endpoints } from '../../api/endpoints'

const HOY = new Date()
const MES_ACTUAL = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, '0')}`

const NAV_GENERAL = [
  { to: '/operador/dashboard', label: 'Dashboard' },
  { to: '/operador/mapa', label: 'Mapa' },
  { to: '/operador/calendario', label: 'Calendario' },
]
const NAV_TRABAJOS = [
  { to: '/operador/agenda', label: 'Agenda' },
  { to: '/operador/ascensores', label: 'Ascensores' },
  { to: '/operador/emergencias', label: 'Emergencias' },
]
const NAV_EQUIPO = [
  { to: '/operador/tecnicos', label: 'Técnicos' },
  { to: '/operador/mensajes', label: 'Mensajes' },
]

function Seccion({ titulo, items }: { titulo: string; items: { to: string; label: string }[] }) {
  return (
    <div className="mb-4">
      <p className="mb-1 px-2 text-[9px] font-mono tracking-widest text-slate-600 uppercase">
        {titulo}
      </p>
      <nav>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mb-0.5 block rounded px-2.5 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function OperadorLayout() {
  const { usuario, setUsuario } = useAuth()
  const { data: calendario } = useQuery({
    queryKey: ['dashboard', 'calendario', MES_ACTUAL],
    queryFn: () => endpoints.dashboard.calendario(MES_ACTUAL),
    refetchInterval: 60_000,
  })

  const emergencias = calendario?.emergencias_abiertas ?? []

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <aside
        className="flex w-56 flex-shrink-0 flex-col overflow-y-auto py-3"
        style={{ background: 'var(--color-navy)' }}
      >
        <div className="mb-2 flex items-center gap-2.5 border-b border-white/[0.07] px-5 pb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--color-accent)]">
            <Building2 size={13} className="text-white" />
          </div>
          <span className="text-base font-bold tracking-wide text-white">Facylitech</span>
        </div>
        <div className="flex-1 px-3 py-3">
          <Seccion titulo="General" items={NAV_GENERAL} />
          <Seccion titulo="Trabajos" items={NAV_TRABAJOS} />
          <Seccion titulo="Equipo" items={NAV_EQUIPO} />
        </div>
        <div className="border-t border-white/[0.07] px-3 pt-3">
          <div className="mb-2 flex items-center gap-2.5 px-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[var(--color-accent)]/20 font-mono-brand text-xs font-bold text-[var(--color-accent)]">
              {usuario?.nombre
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-slate-200">{usuario?.nombre}</div>
              <div className="font-mono-brand text-[9px] text-slate-500">operador</div>
            </div>
          </div>
          <button
            onClick={() => setUsuario(null)}
            className="w-full rounded px-2.5 py-1.5 text-left text-xs text-slate-500 transition-all hover:bg-white/5 hover:text-slate-300"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-11 flex-shrink-0 items-center gap-4 border-b border-[var(--color-border)] bg-white px-6">
          <div className="flex-1" />
          <span className="flex items-center gap-1.5 rounded border border-green-200 bg-green-50 px-2.5 py-1 font-mono-brand text-xs text-green-700">
            <Wifi size={12} />
            Online
          </span>
          {emergencias.length > 0 && (
            <NavLink
              to="/operador/emergencias"
              className="flex animate-pulse items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
            >
              <Zap size={11} /> {emergencias.length} emergencia{emergencias.length === 1 ? '' : 's'}
            </NavLink>
          )}
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
