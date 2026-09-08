import type { Luecke } from './calc'
import { heuteIso } from './format'

/**
 * Zeitliches rund um das Zieljahr.
 *
 * Der Status hängt an einem Kalenderjahr — die App zeigte bisher nur Zustände,
 * keine Uhr. Genau das macht aus einer Zahl aber erst eine Handlung.
 */

const TAG = 86_400_000

function alsZeit(iso: string): number {
  const t = Date.parse(`${iso}T12:00:00Z`)
  return Number.isNaN(t) ? Number.NaN : t
}

export interface Jahresfrist {
  /** Verbleibende Tage bis zum 31.12. des Zieljahres; 0, wenn vorbei */
  tageUebrig: number
  /** Das Zieljahr hat noch nicht begonnen */
  nochNichtBegonnen: boolean
  /** Der 31.12. ist vorüber */
  abgelaufen: boolean
  /** Anteil des Jahres, der schon herum ist, 0 bis 1 */
  verbraucht: number
}

export function jahresfrist(zieljahr: number, heute: string = heuteIso()): Jahresfrist {
  const jetzt = alsZeit(heute)
  const start = Date.UTC(zieljahr, 0, 1, 12)
  const ende = Date.UTC(zieljahr, 11, 31, 12)
  if (Number.isNaN(jetzt)) {
    return { tageUebrig: 0, nochNichtBegonnen: false, abgelaufen: false, verbraucht: 0 }
  }
  const gesamt = (ende - start) / TAG + 1
  const uebrig = Math.max(0, Math.round((ende - jetzt) / TAG) + 1)
  return {
    tageUebrig: jetzt < start ? Math.round(gesamt) : uebrig,
    nochNichtBegonnen: jetzt < start,
    abgelaufen: jetzt > ende,
    verbraucht: Math.min(1, Math.max(0, (jetzt - start) / (ende - start))),
  }
}

export interface Termin {
  id: string
  titel: string
  datum: string
  hinweis: string
}

export interface OffenerTermin extends Termin {
  tageUebrig: number
  /** Weniger als sechs Wochen — das drängt */
  draengt: boolean
}

/** Termine, die noch bevorstehen, der nächste zuerst. */
export function offeneTermine(termine: Termin[], heute: string = heuteIso()): OffenerTermin[] {
  const jetzt = alsZeit(heute)
  if (Number.isNaN(jetzt)) return []
  return termine
    .map((t) => ({ ...t, zeit: alsZeit(t.datum) }))
    .filter((t) => !Number.isNaN(t.zeit) && t.zeit >= jetzt)
    .sort((a, b) => a.zeit - b.zeit)
    .map(({ zeit, ...t }) => {
      const tageUebrig = Math.max(0, Math.round((zeit - jetzt) / TAG))
      return { ...t, tageUebrig, draengt: tageUebrig <= 42 }
    })
}

export interface JahresStand {
  jahr: number
  luecke: Luecke
}

/**
 * Findet ein Jahr, in dem das Ziel näher liegt als im gerade gewählten.
 *
 * Der eigentliche Anlass: Wer auf ein künftiges Jahr plant, übersieht leicht,
 * dass das laufende Jahr längst weiter ist. Vergangene Jahre bleiben außen vor —
 * dort lässt sich nichts mehr erreichen.
 */
export function naeheresJahr(
  staende: JahresStand[],
  gewaehlt: number,
  heute: string = heuteIso(),
): JahresStand | null {
  const jetztJahr = Number(heute.slice(0, 4))
  const rest = (l: Luecke) => l.points + l.qp
  const aktuell = staende.find((s) => s.jahr === gewaehlt)
  if (!aktuell || aktuell.luecke.erreicht) return null

  const besser = staende
    .filter((s) => s.jahr !== gewaehlt && s.jahr >= jetztJahr)
    .filter((s) => rest(s.luecke) < rest(aktuell.luecke))
    .sort((a, b) => rest(a.luecke) - rest(b.luecke))[0]

  return besser ?? null
}
