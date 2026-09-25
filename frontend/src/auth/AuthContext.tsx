import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Usuario } from '../api/types'

/**
 * Capa de auth de desarrollo: selector de usuario/rol del seed, sin JWT.
 * Diseñada para reemplazarse por autenticación real más adelante sin tocar
 * el resto de la app (ver docs/decisiones.md).
 */
interface AuthContextValue {
  usuario: Usuario | null
  setUsuario: (usuario: Usuario | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const STORAGE_KEY = 'facylitech.usuario'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuarioState] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Usuario) : null
  })

  useEffect(() => {
    if (usuario) localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario))
    else localStorage.removeItem(STORAGE_KEY)
  }, [usuario])

  return (
    <AuthContext.Provider value={{ usuario, setUsuario: setUsuarioState }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
