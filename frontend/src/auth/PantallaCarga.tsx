import { Loader2 } from 'lucide-react'
import { LogoFacylitech } from '../components/LogoFacylitech'

/** Pantalla mientras se valida la sesión guardada: evita el parpadeo del login. */
export function PantallaCarga({ texto = 'Verificando sesión…' }: { texto?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-dvh flex-col items-center justify-center gap-4"
      style={{ background: 'var(--color-navy)' }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded bg-white">
        <LogoFacylitech className="h-7 w-auto" />
      </div>
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={15} className="animate-spin" /> {texto}
      </p>
    </div>
  )
}
