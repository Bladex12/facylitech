export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const DIAS_LARGOS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]

export function formatoMesAnio(anio: number, mes: number): string {
  return `${MESES[mes - 1]} ${anio}`
}

export function formatoDiaLargo(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  return `${DIAS_LARGOS[fecha.getDay()]}, ${dia} de ${MESES[mes - 1]}`
}

/** Genera la grilla de un mes (semanas lun-dom) incluyendo días de relleno de
 * meses adyacentes, como arreglo de fechas ISO (YYYY-MM-DD) o null si el
 * relleno no debe mostrar número. */
export function grillaMes(anio: number, mes: number): (string | null)[][] {
  const primerDia = new Date(anio, mes - 1, 1)
  // getDay(): 0=domingo..6=sábado -> convertir a índice lunes=0..domingo=6
  const offsetInicio = (primerDia.getDay() + 6) % 7
  const diasEnMes = new Date(anio, mes, 0).getDate()

  const celdas: (string | null)[] = []
  for (let i = 0; i < offsetInicio; i++) celdas.push(null)
  for (let dia = 1; dia <= diasEnMes; dia++) {
    celdas.push(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
  }
  while (celdas.length % 7 !== 0) celdas.push(null)

  const semanas: (string | null)[][] = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))
  return semanas
}

export function sumarMeses(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const total = anio * 12 + (mes - 1) + delta
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 }
}
