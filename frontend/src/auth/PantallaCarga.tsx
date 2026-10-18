import { Building2, Loader2 } from 'lucide-react'

/** Pantalla mientras se valida la sesión guardada: evita el parpadeo del login. */
export function PantallaCarga({ texto = 'Verificando sesión…' }: { texto?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-dvh flex-col items-center justify-center gap-4"
      style={{ background: 'var(--color-navy)' }}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded bg-[var(--color-accent)]">
        <Building2 size={22} className="text-white" />
      </div>
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={15} className="animate-spin" /> {texto}
      </p>
    </div>
  )
}
