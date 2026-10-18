import { iniciales } from '../../domain/cercania'

/** Cuadro azul marino con iniciales (avatar de técnico del mockup). */
export function Avatar({
  nombre,
  tamano = 'md',
  className = '',
}: {
  nombre: string | null | undefined
  tamano?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const cls = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  }[tamano]
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded bg-[var(--color-navy)] font-mono-brand font-bold text-white ${cls} ${className}`}
    >
      {iniciales(nombre)}
    </div>
  )
}
