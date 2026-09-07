const DATUM = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const DATUM_KURZ = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })
const ZAHL = new Intl.NumberFormat('de-DE')

export function datum(iso: string): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? iso : DATUM.format(d)
}

export function datumKurz(iso: string): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? iso : DATUM_KURZ.format(d)
}

export function zahl(n: number): string {
  return ZAHL.format(Math.round(n))
}

/** „1 Aufenthalt“ / „3 Aufenthalte“ */
export function menge(n: number, einzahl: string, mehrzahl: string): string {
  return `${zahl(n)} ${n === 1 ? einzahl : mehrzahl}`
}

export function heuteIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Liest einen Wert aus einem Zahlenfeld. Browser lassen in `type="number"`
 * auch „e“, „+“ und Minuszeichen zu; daraus darf weder NaN noch ein negativer
 * Punktestand entstehen.
 */
export function zahlAusFeld(wert: string, mindestens = 0): number {
  const n = Number(wert)
  if (!Number.isFinite(n)) return mindestens
  return Math.max(mindestens, n)
}

