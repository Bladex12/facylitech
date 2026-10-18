import { useId, useState, type Ref } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** Campo de contraseña con botón mostrar/ocultar. Compartido por login, cambio y restablecimiento. */
export function CampoPassword({
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  disabled,
  describedBy,
  invalido,
  inputRef,
  ayuda,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  autoComplete: 'current-password' | 'new-password'
  autoFocus?: boolean
  disabled?: boolean
  describedBy?: string
  invalido?: boolean
  inputRef?: Ref<HTMLInputElement>
  ayuda?: string
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const idAyuda = `${id}-ayuda`
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold tracking-widest text-[var(--color-text-muted)] uppercase"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={invalido || undefined}
          aria-describedby={
            [describedBy, ayuda ? idAyuda : null].filter(Boolean).join(' ') || undefined
          }
          className="w-full rounded border border-[var(--color-border)] bg-white py-3 pr-12 pl-4 text-base text-[var(--color-text)] transition outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 disabled:bg-[var(--color-bg-subtle)] aria-[invalid=true]:border-red-400"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-xs text-[var(--color-text-muted)]">
          {ayuda}
        </p>
      )}
    </div>
  )
}
