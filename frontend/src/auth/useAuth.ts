import { createContext, useContext } from 'react'
import type { Usuario } from '../api/types'

/** Por qué no hay sesión: lo usa /login para avisar y los guards para recordar la ruta. */
export type MotivoCierre = 'voluntario' | 'expirada' | null

export interface AuthContextValue {
  usuario: Usuario | null
  /** true mientras se valida la sesión guardada con `GET /auth/me` (evita parpadear /login). */
  cargando: boolean
  motivoCierre: MotivoCierre
  login: (email: string, password: string) => Promise<Usuario>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
