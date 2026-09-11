import type { Flug, KartenArt, UptripKarte, UptripKollektion } from './types'
import { menge } from './format'
import { sortiereSegmente } from './reihenfolge'

/**
 * Sammelalbum für die Uptrip-App.
 *
 * Uptrip lässt sich nicht auslesen: Die Karten liegen nur in der App, eine
 * Website oder Schnittstelle gibt es nicht, und auf der Blockchain steht eine
 * Karte nur, wenn man sie selbst in eine eigene Wallet überträgt. Das Album
 * wird deshalb von Hand gepflegt — hier steht, was sich daraus rechnen lässt.
 */

export const KARTEN_ARTEN: readonly { id: KartenArt; name: string }[] = [
  { id: 'stadt', name: 'Stadt' },
  { id: 'airline', name: 'Airline' },
  { id: 'flugzeug', name: 'Flugzeug' },
  { id: 'spezial', name: 'Spezial' },
]

export function alsKartenArt(wert: unknown): KartenArt {
  return KARTEN_ARTEN.some((a) => a.id === wert) ? (wert as KartenArt) : 'spezial'
}

/* ---------- Stand einer Kollektion ---------- */

export interface KollektionsStand {
  kollektion: UptripKollektion
  /** Die zugeordneten Karten, ohne gelöschte */
  karten: UptripKarte[]
  originale: number
  weitere: number
  /** Die Mindestzahl an Originalen, auf die Kartenzahl begrenzt */
  mindestOriginale: number
  /** Weitere Karten, die tatsächlich zählen */
  weitereAngerechnet: number
  /** Was auf die Kollektion angerechnet wird — so zählt auch die App („10/50“) */
  angerechnet: number
  fehlendeOriginale: number
  /** Plätze, die jede beliebige Karte füllen kann */
  fehlendeBeliebige: number
  fehlend: number
  vollstaendig: boolean
  /** Zugeordnet, aber ohne Wirkung: weitere Karten über die freien Plätze hinaus */
  ueberzaehlig: number
}

/**
 * Wie weit eine Kollektion ist.
 *
 * Die Frequent-Traveller-Kollektion verlangt 50 Karten, davon mindestens 40
 * Originale aus eigenen Flügen. Weitere Karten füllen deshalb höchstens die
 * zehn Plätze ohne Original-Pflicht; Originale dagegen dürfen jeden Platz
 * füllen. Genau so zählt die App: 4 Originale und 6 weitere ergeben 10/50.
 */
export function kollektionsStand(k: UptripKollektion, alleKarten: UptripKarte[]): KollektionsStand {
  const karten = alleKarten.filter((c) => !c.geloescht && c.kollektion === k.id)
  const originale = karten.filter((c) => c.original).length
  const weitere = karten.length - originale
  const benoetigt = Math.max(0, k.benoetigt)
  // Eine Mindestzahl über der Kartenzahl ist ein Tippfehler, keine Regel.
  const mindest = Math.min(Math.max(0, k.mindestOriginale), benoetigt)

  const weitereAngerechnet = Math.min(weitere, benoetigt - mindest)
  const angerechnet = Math.min(benoetigt, originale + weitereAngerechnet)
  const fehlendeOriginale = Math.max(0, mindest - originale)
  const fehlend = benoetigt - angerechnet

  return {
    kollektion: k,
    karten,
    originale,
    weitere,
    mindestOriginale: mindest,
    weitereAngerechnet,
    angerechnet,
    fehlendeOriginale,
    fehlendeBeliebige: fehlend - fehlendeOriginale,
    fehlend,
    vollstaendig: benoetigt > 0 && fehlend === 0,
    ueberzaehlig: karten.length - angerechnet,
  }
}

/* ---------- Übersicht über alle Karten ---------- */

export interface KartenUebersicht {
  /** Karten, die du hast — ohne die in eingelösten Kollektionen verbrauchten */
  gesamt: number
  originale: number
  weitere: number
  /** Keiner (bestehenden) Kollektion zugeordnet */
  frei: UptripKarte[]
  /** In eingelösten Kollektionen aufgegangen */
  verbraucht: number
}

export function kartenUebersicht(
  karten: UptripKarte[],
  kollektionen: UptripKollektion[],
): KartenUebersicht {
  const lebend = new Map(kollektionen.filter((k) => !k.geloescht).map((k) => [k.id, k]))
  const eigene = karten.filter((k) => !k.geloescht)
  // Eingelöst heißt: Die Karten sind in der App weg.
  const vorhanden = eigene.filter((k) => !lebend.get(k.kollektion)?.eingeloest)
  const originale = vorhanden.filter((k) => k.original).length
  return {
    gesamt: vorhanden.length,
    originale,
    weitere: vorhanden.length - originale,
    // Hängt eine Karte an einer gelöschten Kollektion, ist sie wieder frei.
    frei: vorhanden.filter((k) => !lebend.has(k.kollektion)),
    verbraucht: eigene.length - vorhanden.length,
  }
}

/* ---------- Der Weg zum Status über Uptrip ---------- */

export interface UptripWeg {
  stand: KollektionsStand
  /** Flugsegmente, die für die fehlenden Originale mindestens nötig sind */
  segmenteNoetig: number
  /** Geplante Flüge ab heute, wie in Steigflug eingetragen */
  geplanteSegmente: number
  /** Originale, wenn jeder geplante Flug seine Karten bringt */
  originaleMitPlanung: number
}

/** Geplante Flüge ab heute — daraus entstehen die Karten, die noch kommen. */
function geplanteAb(fluege: Flug[], heute: string): Flug[] {
  return fluege.filter((f) => !f.geloescht && f.geplant && f.datum >= heute)
}

/**
 * Wie weit der Status über die Uptrip-Kollektion ist. Liefert nichts, wenn
 * es keine offene Kollektion gibt, die den Status bringt.
 */
export function uptripWeg(
  kollektionen: UptripKollektion[],
  karten: UptripKarte[],
  fluege: Flug[],
  heute: string,
  kartenJeSegment: number,
): UptripWeg | null {
  const k = kollektionen.find((x) => !x.geloescht && x.bringtStatus && !x.eingeloest)
  if (!k) return null
  const stand = kollektionsStand(k, karten)
  // Das Regelwerk lässt eine Null zu; durch null teilen hieße „unendlich viele Segmente“.
  const je = Math.max(1, kartenJeSegment)
  const geplanteSegmente = geplanteAb(fluege, heute).length
  return {
    stand,
    segmenteNoetig: Math.ceil(stand.fehlendeOriginale / je),
    geplanteSegmente,
    originaleMitPlanung: stand.originale + geplanteSegmente * je,
  }
}

/**
 * Der Satz fürs Cockpit. Entschieden wird hier und nicht im JSX — dort
 * rutschen Randfälle durch („noch 0 Flugsegmente“, wenn nur noch beliebige
 * Karten fehlen).
 *
 * `punkteSegmente`: wie viele Segmente über die Punkte fehlen, zum Vergleich.
 */
export function uptripWegSatz(weg: UptripWeg, punkteSegmente: number | null): string {
  const s = weg.stand
  if (s.vollstaendig) return 'Vollständig — du kannst die Belohnung in der Uptrip-App einlösen.'

  // Wie in der Uptrip-App: die Kartenzahl vorn („10/50“), die Originale dahinter.
  // Mit den Originalen vorn las sich „4 von 40“ wie die Zahl der Karten.
  const stand =
    `${s.angerechnet} von ${s.kollektion.benoetigt} Karten` +
    (s.mindestOriginale > 0
      ? `, davon ${menge(s.originale, 'Original', 'Originale')} (mindestens ${s.mindestOriginale} nötig)`
      : '')

  if (weg.segmenteNoetig === 0) {
    return `${stand}. Es fehlen nur noch ${menge(s.fehlendeBeliebige, 'beliebige Karte', 'beliebige Karten')}.`
  }
  const vergleich =
    punkteSegmente !== null && punkteSegmente > 0
      ? ` — über die Punkte sind es rund ${punkteSegmente}`
      : ''
  return `${stand}. Es fehlen noch mindestens ${menge(weg.segmenteNoetig, 'Flugsegment', 'Flugsegmente')}${vergleich}.`
}

/* ---------- Vorschläge aus den letzten Flügen ---------- */

export interface Namen {
  stadt: (iata: string) => string
  airline: (code: string) => string
}

export interface KartenVorschlag {
  name: string
  art: KartenArt
  datum: string
  flug: string
  schluessel: string
}

/**
 * Aus jedem Flug bietet Uptrip Karten zu Start, Ziel, Airline und Flugzeug an.
 * Die ersten drei kennt Steigflug — die schlägt es für die letzten Flüge vor,
 * damit das Nachtragen ein Tippen statt Abschreiben ist. Das Flugzeug kennt
 * Steigflug nicht. Was schon im Album steht, fällt heraus.
 */
export function kartenVorschlaege(
  fluege: Flug[],
  karten: UptripKarte[],
  namen: Namen,
  heute: string,
  anzahlFluege = 3,
): KartenVorschlag[] {
  const bekannt = (name: string, datum: string) => `${name.trim().toLowerCase()}|${datum}`
  const vorhanden = new Set(karten.filter((k) => !k.geloescht).map((k) => bekannt(k.name, k.datum)))
  const letzte = fluege
    .filter((f) => !f.geloescht && !f.geplant && f.datum !== '' && f.datum <= heute)
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, anzahlFluege)

  const vorschlaege: KartenVorschlag[] = []
  for (const f of letzte) {
    const flug = `${f.airline} · ${f.von} → ${f.nach}`
    const kandidaten: [string, KartenArt][] = [
      [namen.stadt(f.von), 'stadt'],
      [namen.stadt(f.nach), 'stadt'],
      [namen.airline(f.airline), 'airline'],
    ]
    for (const [name, art] of kandidaten) {
      if (!name || vorhanden.has(bekannt(name, f.datum))) continue
      vorhanden.add(bekannt(name, f.datum))
      vorschlaege.push({ name, art, datum: f.datum, flug, schluessel: `${f.id}|${art}|${name}` })
    }
  }
  return vorschlaege
}

/* ---------- Erwartete Karten aus geplanten Flügen ---------- */

export interface ErwarteterFlug {
  flug: Flug
  /**
   * Was Uptrip für diesen Flug zur Wahl stellt: Start, Ziel, Airline und
   * Flugzeug. Den Flugzeugtyp kennt Steigflug nicht — dort bleibt der Name leer.
   */
  auswahl: { name: string; art: KartenArt }[]
}

export interface ErwartetesJahr {
  jahr: string
  fluege: ErwarteterFlug[]
  karten: number
}

export interface ErwarteteKarten {
  jahre: ErwartetesJahr[]
  /** Originalkarten aus allen geplanten Flügen zusammen */
  karten: number
  /** Karten, die man je Flug wählt */
  jeFlug: number
}

/**
 * Die Karten, die die geplanten Flüge in Uptrip bringen werden.
 *
 * Bewusst abgeleitet statt gespeichert: Als echte Karten eingetragen stünde im
 * Album eine Zahl, die der Nutzer gar nicht hat, und jede Umbuchung ließe
 * Karteileichen zurück. So stimmt die Liste von selbst. Ist ein Flug geflogen,
 * fällt er hier heraus und erscheint bei den Vorschlägen zum Eintragen.
 */
export function erwarteteKarten(
  fluege: Flug[],
  namen: Namen,
  heute: string,
  kartenJeSegment: number,
): ErwarteteKarten {
  const je = Math.max(1, kartenJeSegment)
  const jahre: ErwartetesJahr[] = []
  // Aufsteigend und je Tag in Reisereihenfolge — alles liegt ab heute.
  for (const flug of sortiereSegmente(geplanteAb(fluege, heute), heute)) {
    const jahr = flug.datum.slice(0, 4)
    let gruppe = jahre[jahre.length - 1]
    if (!gruppe || gruppe.jahr !== jahr) {
      gruppe = { jahr, fluege: [], karten: 0 }
      jahre.push(gruppe)
    }
    gruppe.fluege.push({
      flug,
      auswahl: [
        { name: namen.stadt(flug.von), art: 'stadt' },
        { name: namen.stadt(flug.nach), art: 'stadt' },
        { name: namen.airline(flug.airline), art: 'airline' },
        { name: '', art: 'flugzeug' },
      ],
    })
    gruppe.karten += je
  }
  return { jahre, karten: jahre.reduce((s, j) => s + j.karten, 0), jeFlug: je }
}
