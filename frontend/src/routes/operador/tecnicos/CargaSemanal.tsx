import { DIAS_SEMANA } from '../../../domain/fechas'

/** Mini barras de carga lunes-domingo; el día de hoy en el color de acento. */
export function CargaSemanal({
  porDia,
  hoy,
  compacto = false,
}: {
  porDia: number[] | null
  hoy: Date
  compacto?: boolean
}) {
  const indiceHoy = (hoy.getDay() + 6) % 7
  const max = Math.max(1, ...(porDia ?? [0]))
  const alto = compacto ? 28 : 64
  return (
    <div className={`flex items-end ${compacto ? 'gap-1' : 'gap-2'}`} aria-label="Carga de la semana">
      {DIAS_SEMANA.map((dia, i) => {
        const n = porDia?.[i] ?? 0
        const h = porDia ? Math.max(n > 0 ? 4 : 2, (n / max) * alto) : 2
        return (
          <div key={dia} className="flex flex-col items-center gap-0.5" title={`${dia}: ${n} trabajo${n === 1 ? '' : 's'}`}>
            {!compacto && <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{n || ''}</span>}
            <div className="flex items-end" style={{ height: alto }}>
              <div
                className={`rounded-sm ${compacto ? 'w-2' : 'w-6'} ${
                  i === indiceHoy ? 'bg-[var(--color-accent)]' : n > 0 ? 'bg-[var(--color-navy)]/70' : 'bg-[var(--color-border)]'
                }`}
                style={{ height: h }}
              />
            </div>
            <span
              className={`font-mono ${compacto ? 'text-[8px]' : 'text-[10px]'} ${
                i === indiceHoy ? 'font-semibold text-[var(--color-accent)]' : 'text-slate-400'
              }`}
            >
              {compacto ? dia[0] : dia}
            </span>
          </div>
        )
      })}
    </div>
  )
}
