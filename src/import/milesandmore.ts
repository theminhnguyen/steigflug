import type { Flug, KlassenId } from '../core/types'
import { schaetzeStrecke } from '../data/airports'
import { neueId } from '../store/store'

/**
 * Einlesen der Flughistorie aus Miles & More.
 *
 * Quelle ist der Endpunkt, den das Konto selbst benutzt:
 * api.travelid.lufthansa.com/flightstats/v3/me/segmentList
 * Angemeldet im Browser aufrufen, Antwort als Datei sichern, hier einlesen.
 *
 * Der Endpunkt ist nicht dokumentiert und kann sich ohne Ankündigung ändern.
 * Deshalb ist hier alles nachsichtig gelesen: Fehlt ein Feld oder passt ein
 * Wert nicht, wird die Zeile übersprungen statt den ganzen Import zu kippen.
 */

/** Miles & More füllt Textfelder mit Leerzeichen auf ("LH   ", "320  "). */
function text(wert: unknown): string {
  return typeof wert === 'string' && wert.trim() ? wert.trim() : ''
}

function zahlOderNull(wert: unknown): number | null {
  if (wert === null || wert === undefined || wert === '') return null
  const n = Number(wert)
  return Number.isFinite(n) ? n : null
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/

/**
 * CompartmentClass ist die Buchungsklasse (ein Buchstabe), nicht die Kabine.
 * Die Zuordnung folgt den üblichen Konventionen der Lufthansa Group und ist
 * eine begründete Annäherung — bei fremden Airlines kann sie danebenliegen.
 * Deshalb bleibt die erkannte Klasse im Vorschaufenster sichtbar und ist
 * hinterher pro Flug änderbar.
 */
const KLASSE_AUS_BUCHUNGSKLASSE: Record<string, KlassenId> = {
  F: 'first', A: 'first',
  C: 'business', J: 'business', D: 'business', Z: 'business', P: 'business',
  W: 'premium', E: 'premium', G: 'premium', N: 'premium',
  M: 'economy', Y: 'economy', B: 'economy', H: 'economy', K: 'economy',
  L: 'economy', Q: 'economy', T: 'economy', V: 'economy', S: 'economy',
  O: 'economy', U: 'economy', X: 'economy', R: 'economy', I: 'economy',
}

export interface RohSegment {
  DepartureDate?: unknown
  OriginAirportCode?: unknown
  DestinationAirportCode?: unknown
  AirlineDesignatorCode?: unknown
  FlightNumber?: unknown
  CompartmentClass?: unknown
  PnrrecordLocator?: unknown
  StatusMiles?: unknown
  StatusPoints?: unknown
  GupPoints?: unknown
  HonPoints?: unknown
  AwardMiles?: unknown
}

export interface GelesenerFlug {
  flug: Flug
  /** Die Punktefelder so, wie sie in der Datei standen — für die Vorschau. */
  roh: {
    statusPoints: number | null
    gupPoints: number | null
    honPoints: number | null
    statusMiles: number | null
    awardMiles: number | null
  }
  buchungsklasse: string
  flugnummer: string
}

export interface Leseergebnis {
  fluege: GelesenerFlug[]
  uebersprungen: number
  /** Welche Punktefelder überhaupt Werte enthielten — deckt die Zuordnung auf. */
  belegteFelder: string[]
}

/** Holt die Segmentliste aus der Datei, egal ob verpackt oder als blankes Feld. */
function segmenteAus(roh: unknown): unknown[] {
  if (Array.isArray(roh)) return roh
  if (!roh || typeof roh !== 'object') return []
  const d = roh as Record<string, unknown>
  for (const schluessel of ['SegmentListResponses', 'segmentListResponses', 'segments', 'data']) {
    const wert = d[schluessel]
    if (Array.isArray(wert)) return wert
  }
  return []
}

export function istMilesAndMoreDatei(roh: unknown): boolean {
  return segmenteAus(roh).length > 0
}

export function leseSegmente(roh: unknown, qualifyingAusGup = true): Leseergebnis {
  const rohSegmente = segmenteAus(roh)
  const fluege: GelesenerFlug[] = []
  const belegt = new Set<string>()
  let uebersprungen = 0

  for (const eintrag of rohSegmente) {
    if (!eintrag || typeof eintrag !== 'object') {
      uebersprungen++
      continue
    }
    const s = eintrag as RohSegment

    const datum = text(s.DepartureDate).slice(0, 10)
    const von = text(s.OriginAirportCode).toUpperCase()
    const nach = text(s.DestinationAirportCode).toUpperCase()
    const airline = text(s.AirlineDesignatorCode).toUpperCase()

    if (!DATUM.test(datum) || von.length !== 3 || nach.length !== 3 || !airline) {
      uebersprungen++
      continue
    }

    const punkte = {
      statusPoints: zahlOderNull(s.StatusPoints),
      gupPoints: zahlOderNull(s.GupPoints),
      honPoints: zahlOderNull(s.HonPoints),
      statusMiles: zahlOderNull(s.StatusMiles),
      awardMiles: zahlOderNull(s.AwardMiles),
    }
    for (const [name, wert] of Object.entries(punkte)) {
      if (wert !== null && wert !== 0) belegt.add(name)
    }

    const buchungsklasse = text(s.CompartmentClass).toUpperCase().slice(0, 1)
    const vorschlag = schaetzeStrecke(von, nach)
    const nummer = zahlOderNull(s.FlightNumber)
    const pnr = text(s.PnrrecordLocator)
    const flugnummer = nummer !== null ? `${airline}${nummer}` : airline

    fluege.push({
      buchungsklasse,
      flugnummer,
      roh: punkte,
      flug: {
        id: neueId(),
        datum,
        von,
        nach,
        airline,
        klasse: KLASSE_AUS_BUCHUNGSKLASSE[buchungsklasse] ?? 'economy',
        strecke: vorschlag.strecke,
        // Aus der Datei stammende Strecken gelten als gesetzt, damit die
        // Automatik sie nicht später überschreibt.
        streckeManuell: !vorschlag.sicher,
        geplant: false,
        // Die tatsächlich gutgeschriebenen Punkte schlagen jede Berechnung.
        korrekturPoints: punkte.statusPoints,
        korrekturQp: qualifyingAusGup ? punkte.gupPoints : null,
        notiz: [flugnummer, pnr && `Buchung ${pnr}`, 'aus Miles & More']
          .filter(Boolean)
          .join(' · '),
        geaendertAm: '',
        dirty: true,
        geloescht: false,
      },
    })
  }

  return { fluege, uebersprungen, belegteFelder: [...belegt].sort() }
}

/**
 * Kennzeichen eines Flugsegments für den Abgleich mit dem Bestand.
 *
 * Die Datei vergibt bei jedem Einlesen neue Kennungen, ein zweiter Import
 * legte sonst alles doppelt an. Datum, Strecke und Airline reichen zur
 * Unterscheidung — dieselbe Airline fliegt dieselbe Strecke am selben Tag in
 * aller Regel nur einmal mit demselben Fahrgast. Das Kennzeichen trifft
 * absichtlich auch von Hand eingetragene Flüge, damit ein Import sie ergänzt
 * statt sie zu verdoppeln.
 */
export function kennzeichen(f: {
  datum: string
  von: string
  nach: string
  airline: string
}): string {
  return [f.datum, f.von.toUpperCase(), f.nach.toUpperCase(), f.airline.toUpperCase()].join('|')
}

export interface Verschmelzung {
  /** Neu hinzugekommene Flüge */
  neu: Flug[]
  /** Vorhandene, bei denen die Datei die tatsächliche Gutschrift nachträgt */
  aktualisiert: Flug[]
  /** Wie viele Einträge unverändert bleiben */
  unveraendert: number
}

/**
 * Führt gelesene Segmente mit dem Bestand zusammen. Vorhandene Flüge werden
 * nicht ersetzt — nur die tatsächlich gutgeschriebenen Punkte werden ergänzt,
 * und auch die nur, wo bisher keine Korrektur stand. Von Hand Eingetragenes
 * bleibt damit unangetastet.
 */
export function verschmelze(vorhandene: Flug[], gelesene: GelesenerFlug[]): Verschmelzung {
  const bestand = new Map<string, Flug>()
  for (const f of vorhandene) {
    if (!f.geloescht) bestand.set(kennzeichen(f), f)
  }

  const neu: Flug[] = []
  const aktualisiert: Flug[] = []
  let unveraendert = 0
  const gesehen = new Set<string>()

  for (const { flug } of gelesene) {
    const k = kennzeichen(flug)
    if (gesehen.has(k)) continue
    gesehen.add(k)

    const vorhanden = bestand.get(k)
    if (!vorhanden) {
      neu.push(flug)
      continue
    }

    const ergaenzt =
      vorhanden.korrekturPoints === null && flug.korrekturPoints !== null
        ? { ...vorhanden, korrekturPoints: flug.korrekturPoints, dirty: true }
        : vorhanden
    const ergaenzt2 =
      ergaenzt.korrekturQp === null && flug.korrekturQp !== null
        ? { ...ergaenzt, korrekturQp: flug.korrekturQp, dirty: true }
        : ergaenzt
    // Ein geplanter Flug, der in der Historie auftaucht, ist geflogen.
    const ergaenzt3 = ergaenzt2.geplant ? { ...ergaenzt2, geplant: false, dirty: true } : ergaenzt2

    if (ergaenzt3 === vorhanden) unveraendert++
    else aktualisiert.push(ergaenzt3)
  }

  return { neu, aktualisiert, unveraendert }
}
