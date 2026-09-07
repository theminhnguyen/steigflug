/** Datentypen der App. Bewusst schlank gehalten: alles, was sich rechnen lässt,
 *  wird gerechnet und nicht gespeichert. */

export type KlassenId = 'economy' | 'premium' | 'business' | 'first'
export type Strecke = 'kontinental' | 'interkontinental'

/** Ein Flugsegment. Ein Hin- und Rückflug sind zwei Segmente. */
export interface Flug {
  id: string
  /** ISO-Datum, yyyy-mm-dd */
  datum: string
  /** IATA-Code, z. B. FRA */
  von: string
  nach: string
  /** IATA-Airline-Code, z. B. LH */
  airline: string
  klasse: KlassenId
  strecke: Strecke
  /** true, wenn der Nutzer die Strecke selbst gesetzt hat (überschreibt die Automatik) */
  streckeManuell: boolean
  /** geplant = zählt in der Prognose, aber nicht im Ist-Stand */
  geplant: boolean
  /** Tatsächlich gutgeschriebene Werte, falls sie von der Berechnung abweichen */
  korrekturPoints: number | null
  korrekturQp: number | null
  notiz: string
}

/** Punkte, die nicht aus einem Flug stammen: Marriott, Kreditkarte, Uptrip, … */
export interface BodenEintrag {
  id: string
  datum: string
  /** verweist auf bodenQuellen[].id im Regelwerk */
  quelle: string
  /** Anzahl Einheiten (Aufenthalte, Pakete, …) bzw. bei freier Eingabe die Points */
  anzahl: number
  /** nur bei freier Eingabe genutzt */
  freieQp: number
  geplant: boolean
  notiz: string
}

export interface AppDaten {
  /** Schema-Version für spätere Migrationen */
  schema: number
  /** Kalenderjahr, auf das qualifiziert wird */
  zieljahr: number
  /** verweist auf ziele[].id im Regelwerk */
  zielStatus: string
  fluege: Flug[]
  boden: BodenEintrag[]
  /** Nutzer-Überschreibungen des Regelwerks, teilweise Struktur */
  regelwerkOverrides: Record<string, unknown>
}

/** Ergebnis einer Punkteberechnung für einen einzelnen Eintrag */
export interface Punkte {
  points: number
  qp: number
}

export const NULL_PUNKTE: Punkte = { points: 0, qp: 0 }
