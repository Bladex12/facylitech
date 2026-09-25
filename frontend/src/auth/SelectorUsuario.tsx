import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, ArrowLeft, Check } from 'lucide-react'
import { endpoints } from '../api/endpoints'
import { useAuth } from './AuthContext'
import type { Usuario } from '../api/types'

const ROL_LABEL: Record<'operador' | 'tecnico', { label: string; sub: string }> = {
  operador: { label: 'Operador', sub: 'Gestión de agenda, asignaciones y reportes' },
  tecnico: { label: 'Técnico', sub: 'Mis trabajos asignados y atención de emergencias' },
}

export function SelectorUsuario({ rolEsperado }: { rolEsperado: 'operador' | 'tecnico' }) {
  const { setUsuario } = useAuth()
  const [seleccionado, setSeleccionado] = useState<Usuario | null>(null)
  const [paso, setPaso] = useState<'elegir' | 'confirmar'>('elegir')

  const { data, isLoading, error } = useQuery({
    queryKey: ['usuarios', rolEsperado],
    queryFn: () => endpoints.usuarios.listar(rolEsperado),
  })

  const info = ROL_LABEL[rolEsperado]

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-navy)' }}>
      <div className="relative hidden w-5/12 flex-col justify-between overflow-hidden p-16 lg:flex">
        <div className="pointer-events-none absolute inset-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute rounded border border-white/5"
              style={{ inset: `${i * 40}px` }}
            />
          ))}
        </div>
        <div className="relative z-10">
          <div className="mb-20 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--color-accent)]">
              <Building2 size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-wide text-white">Facylitech</span>
          </div>
          <h1 className="mb-5 text-5xl leading-[1.15] font-bold text-white">
            Gestión integral
            <br />
            de mantenimiento
            <br />
            <span className="text-[var(--color-accent)]">de ascensores</span>
          </h1>
          <p className="max-w-xs leading-relaxed text-slate-400">
            Plataforma para operadores y técnicos. Papeleta digital, calendario con semáforos y
            emergencias por geolocalización.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { n: '12', l: 'Ascensores' },
            { n: '6', l: 'Edificios' },
            { n: '20', l: 'Usuarios' },
          ].map((s) => (
            <div key={s.l} className="rounded border border-white/10 p-4">
              <div className="text-2xl font-bold text-[var(--color-accent)]">{s.n}</div>
              <div className="mt-0.5 text-[10px] tracking-widest text-slate-500 uppercase">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[var(--color-bg)] p-8">
        <div className="w-full max-w-md">
          {paso === 'elegir' ? (
            <>
              <h2 className="mb-1 text-3xl font-bold text-[var(--color-text)]">Iniciar sesión</h2>
              <p className="mb-1 text-[var(--color-text-muted)]">
                Acceso {info.label.toLowerCase()} — {info.sub}
              </p>
              <p className="mb-8 text-xs text-[var(--color-text-muted)]">
                Selector de usuario de desarrollo — elige una cuenta del seed.
              </p>

              {isLoading && (
                <p className="text-sm text-[var(--color-text-muted)]">Cargando usuarios…</p>
              )}
              {error && (
                <p className="text-sm text-red-600">
                  No se pudo conectar a la API. ¿Está el backend corriendo?
                </p>
              )}

              <div className="mb-8 space-y-3">
                {data?.items.map((usuario) => (
                  <button
                    key={usuario.id}
                    onClick={() => setSeleccionado(usuario)}
                    className={`w-full rounded border-2 bg-white p-4 text-left transition-all ${
                      seleccionado?.id === usuario.id
                        ? 'border-[var(--color-accent)] shadow-sm'
                        : 'border-[var(--color-border)] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div
                          className={`mb-0.5 text-[10px] font-semibold tracking-widest uppercase ${
                            seleccionado?.id === usuario.id
                              ? 'text-[var(--color-accent)]'
                              : 'text-[var(--color-text-muted)]'
                          }`}
                        >
                          {info.label}
                        </div>
                        <div className="font-semibold text-[var(--color-text)]">
                          {usuario.nombre}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {usuario.zona ?? usuario.email}
                        </div>
                      </div>
                      <div
                        className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          seleccionado?.id === usuario.id
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                            : 'border-slate-300'
                        }`}
                      >
                        {seleccionado?.id === usuario.id && (
                          <Check size={10} className="text-white" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => seleccionado && setPaso('confirmar')}
                disabled={!seleccionado}
                className="w-full rounded bg-[var(--color-navy)] py-3.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Continuar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setPaso('elegir')}
                className="mb-8 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <ArrowLeft size={13} /> Volver
              </button>
              <h2 className="mb-1 text-3xl font-bold text-[var(--color-text)]">Bienvenido/a</h2>
              <p className="mb-2 text-[var(--color-text-muted)]">{seleccionado?.nombre}</p>
              <p className="mb-8 font-mono-brand text-sm text-[var(--color-text-muted)]">
                {seleccionado?.email}
              </p>
              <div className="mb-8 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    defaultValue="••••••••"
                    disabled
                    className="w-full rounded border border-[var(--color-border)] bg-white px-4 py-3 focus:border-[var(--color-accent)] focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                    Entorno de desarrollo: sin autenticación real todavía.
                  </p>
                </div>
              </div>
              <button
                onClick={() => seleccionado && setUsuario(seleccionado)}
                className="w-full rounded bg-[var(--color-accent)] py-3.5 font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
