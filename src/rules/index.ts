import roh from './regelwerk.json'
import type { KlassenId, Strecke } from '../core/types'

export interface Ziel {
  id: string
  name: string
  kuerzel: string
  points: number
  qualifyingPoints: number
}

export interface Klasse {
  id: KlassenId
  name: string
}

export interface Airline {
  code: string
  name: string
}

export interface BodenQuelle {
  id: string
  name: string
  einheit: string
  einheitPlural: string
  /** Nutzer trägt Points direkt ein statt Einheiten */
  freieEingabe?: boolean
  pointsProEinheit?: number
  qpProEinheit?: number
  /** null = kein bekanntes Jahreslimit */
  maxPointsProJahr: number | null
  /**
   * Eine Buchung kann mehrere Einheiten bündeln — etwa drei 5.000er-Pakete
   * Meilentausch in einer Gutschrift. Dann wird die Anzahl aus den Punkten
   * errechnet. Sonst gilt: eine Buchung, eine Einheit (ein Aufenthalt, eine
   * Kollektion), egal wie hoch die Gutschrift ausfiel.
   */
  einheitenAusPunkten?: boolean
  hinweis: string
}

export interface Termin {
  id: string
  titel: string
  datum: string
  hinweis: string
}

export interface Regelwerk {
  version: string
  stand: string
  hinweis: string
  quellen: { titel: string; url: string }[]
  ziele: Ziel[]
  klassen: Klasse[]
  flugPunkte: Record<KlassenId, Record<Strecke, number>>
  qualifyingAirlines: Airline[]
  weitereAirlines: Airline[]
  bodenQuellen: BodenQuelle[]
  termine: Termin[]
}

/** Das ausgelieferte Regelwerk. Nie direkt mutieren – Änderungen laufen über
 *  `mitOverrides`, damit die Basiswerte jederzeit wiederherstellbar bleiben. */
export const BASIS_REGELWERK = roh as unknown as Regelwerk

/**
 * Legt die Nutzer-Überschreibungen über das Basis-Regelwerk.
 * Unterstützt gezielt die Felder, die sich erfahrungsgemäß ändern:
 * Statusschwellen, Flugpunkte-Tabelle und Jahreslimits der Boden-Quellen.
 */
export function mitOverrides(
  basis: Regelwerk,
  overrides: Record<string, unknown> | undefined,
): Regelwerk {
  if (!overrides || Object.keys(overrides).length === 0) return basis

  const zieleOv = overrides.ziele as Record<string, Partial<Ziel>> | undefined
  const flugOv = overrides.flugPunkte as
    | Partial<Record<KlassenId, Partial<Record<Strecke, number>>>>
    | undefined
  const bodenOv = overrides.bodenQuellen as
    | Record<string, Partial<BodenQuelle>>
    | undefined
  const airlinesOv = overrides.qualifyingAirlines as string[] | undefined

  return {
    ...basis,
    ziele: basis.ziele.map((z) => ({ ...z, ...(zieleOv?.[z.id] ?? {}) })),
    flugPunkte: Object.fromEntries(
      (Object.keys(basis.flugPunkte) as KlassenId[]).map((k) => [
        k,
        { ...basis.flugPunkte[k], ...(flugOv?.[k] ?? {}) },
      ]),
    ) as Regelwerk['flugPunkte'],
    qualifyingAirlines: airlinesOv
      ? airlinesOv.map(
          (code) =>
            [...basis.qualifyingAirlines, ...basis.weitereAirlines].find(
              (a) => a.code === code,
            ) ?? { code, name: code },
        )
      : basis.qualifyingAirlines,
    bodenQuellen: basis.bodenQuellen.map((q) => ({
      ...q,
      ...(bodenOv?.[q.id] ?? {}),
    })),
  }
}

export function findeZiel(r: Regelwerk, id: string): Ziel {
  return r.ziele.find((z) => z.id === id) ?? r.ziele[0]!
}

export function findeBodenQuelle(r: Regelwerk, id: string): BodenQuelle | undefined {
  return r.bodenQuellen.find((q) => q.id === id)
}

/** Alle Airlines für Auswahllisten, qualifizierende zuerst. */
export function alleAirlines(r: Regelwerk): (Airline & { qualifying: boolean })[] {
  return [
    ...r.qualifyingAirlines.map((a) => ({ ...a, qualifying: true })),
    ...r.weitereAirlines.map((a) => ({ ...a, qualifying: false })),
  ]
}

export function istQualifyingAirline(r: Regelwerk, code: string): boolean {
  return r.qualifyingAirlines.some((a) => a.code === code.toUpperCase())
}
