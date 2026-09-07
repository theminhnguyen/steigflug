import type { AppDaten, Flug, KlassenId, Punkte, Strecke } from './types'
import type { BodenQuelle, Regelwerk, Ziel } from '../rules'
import { istQualifyingAirline } from '../rules'

export type Modus = 'ist' | 'plan'

/** Punkte eines einzelnen Flugsegments, vor allen Deckelungen. */
export function punkteFuerFlug(r: Regelwerk, f: Flug): Punkte {
  const basis = r.flugPunkte[f.klasse]?.[f.strecke] ?? 0
  const qualifiziert = istQualifyingAirline(r, f.airline)
  // Letzte Absicherung gegen NaN: Ein einziger unbrauchbarer Wert würde sonst
  // jede Summe der App zu NaN machen und alle Balken leeren.
  const korrektur = (wert: number | null) =>
    wert !== null && Number.isFinite(wert) ? wert : null
  return {
    points: korrektur(f.korrekturPoints) ?? basis,
    qp: korrektur(f.korrekturQp) ?? (qualifiziert ? basis : 0),
  }
}

/** Punkte eines Boden-Eintrags für eine gegebene Anzahl Einheiten. */
export function punkteFuerEinheiten(q: BodenQuelle, einheiten: number, freieQp = 0): Punkte {
  if (q.freieEingabe) return { points: einheiten, qp: freieQp }
  return {
    points: einheiten * (q.pointsProEinheit ?? 0),
    qp: einheiten * (q.qpProEinheit ?? 0),
  }
}

/** Wie viele Einheiten einer Quelle das Jahreslimit noch zulässt. */
export function maxEinheiten(q: BodenQuelle): number {
  if (q.maxPointsProJahr === null) return Infinity
  if (q.freieEingabe) return q.maxPointsProJahr
  const proEinheit = q.pointsProEinheit ?? 0
  if (proEinheit <= 0) return Infinity
  return Math.floor(q.maxPointsProJahr / proEinheit)
}

export function jahrVon(isoDatum: string): number {
  return Number(isoDatum.slice(0, 4))
}

function zaehlt(
  eintrag: { geplant: boolean; datum: string; geloescht: boolean },
  modus: Modus,
  jahr: number,
): boolean {
  // Sanft Gelöschte bleiben für den Abgleich erhalten, dürfen aber in keiner
  // Rechnung mehr auftauchen. Eine einzige Stelle, damit das nicht auseinanderläuft.
  if (eintrag.geloescht) return false
  if (jahrVon(eintrag.datum) !== jahr) return false
  return modus === 'plan' || !eintrag.geplant
}

export interface QuellenBilanz {
  quelle: BodenQuelle
  einheitenEingetragen: number
  einheitenGezaehlt: number
  /** Einheiten, die das Jahreslimit noch zulässt */
  einheitenFrei: number
  punkte: Punkte
  limitErreicht: boolean
  ueberLimit: boolean
}

export interface Bilanz {
  fluege: Punkte
  boden: Punkte
  gesamt: Punkte
  anzahlFluege: number
  proQuelle: QuellenBilanz[]
}

const addiere = (a: Punkte, b: Punkte): Punkte => ({
  points: a.points + b.points,
  qp: a.qp + b.qp,
})

/**
 * Gesamtbilanz für ein Kalenderjahr. Deckelt jede Boden-Quelle auf ihr
 * Jahreslimit – ältere Einträge zuerst, damit die Deckelung nachvollziehbar
 * bleibt und nicht davon abhängt, in welcher Reihenfolge etwas erfasst wurde.
 */
export function berechneBilanz(r: Regelwerk, daten: AppDaten, modus: Modus): Bilanz {
  const jahr = daten.zieljahr

  let fluege: Punkte = { points: 0, qp: 0 }
  let anzahlFluege = 0
  for (const f of daten.fluege) {
    if (!zaehlt(f, modus, jahr)) continue
    fluege = addiere(fluege, punkteFuerFlug(r, f))
    anzahlFluege++
  }

  const proQuelle: QuellenBilanz[] = []
  let boden: Punkte = { points: 0, qp: 0 }

  for (const q of r.bodenQuellen) {
    const eintraege = daten.boden
      .filter((b) => b.quelle === q.id && zaehlt(b, modus, jahr))
      .sort((a, b) => a.datum.localeCompare(b.datum))

    const grenze = maxEinheiten(q)
    let eingetragen = 0
    let gezaehlt = 0
    let punkte: Punkte = { points: 0, qp: 0 }

    for (const e of eintraege) {
      eingetragen += e.anzahl
      const frei = grenze - gezaehlt
      if (frei <= 0) continue
      const nutzbar = Math.min(e.anzahl, frei)
      gezaehlt += nutzbar
      // Bei freier Eingabe wird der QP-Anteil anteilig mitgedeckelt.
      const anteil = e.anzahl > 0 ? nutzbar / e.anzahl : 0
      punkte = addiere(punkte, punkteFuerEinheiten(q, nutzbar, e.freieQp * anteil))
    }

    boden = addiere(boden, punkte)
    proQuelle.push({
      quelle: q,
      einheitenEingetragen: eingetragen,
      einheitenGezaehlt: gezaehlt,
      einheitenFrei: grenze === Infinity ? Infinity : Math.max(0, grenze - gezaehlt),
      punkte,
      limitErreicht: grenze !== Infinity && gezaehlt >= grenze,
      ueberLimit: eingetragen > gezaehlt,
    })
  }

  return { fluege, boden, gesamt: addiere(fluege, boden), anzahlFluege, proQuelle }
}

export interface Luecke {
  points: number
  qp: number
  erreicht: boolean
}

/** Was bis zum Ziel noch fehlt. Nie negativ. */
export function berechneLuecke(bilanz: Bilanz, ziel: Ziel): Luecke {
  const points = Math.max(0, ziel.points - bilanz.gesamt.points)
  const qp = Math.max(0, ziel.qualifyingPoints - bilanz.gesamt.qp)
  return { points, qp, erreicht: points === 0 && qp === 0 }
}

export interface VerlaufPunkt {
  datum: string
  points: number
  qp: number
  erreicht: boolean
  /** Beschriftung des Eintrags, der zu diesem Schritt geführt hat */
  label: string
}

/**
 * Kumulierter Verlauf über alle Einträge des Zieljahres in Datumsreihenfolge.
 * Deckelungen greifen dabei fortlaufend – so entsteht genau der Punkt, an dem
 * beide Schwellen erstmals gerissen werden.
 */
export function berechneVerlauf(
  r: Regelwerk,
  daten: AppDaten,
  ziel: Ziel,
  modus: Modus,
): VerlaufPunkt[] {
  const jahr = daten.zieljahr

  type Schritt = { datum: string; label: string; punkte: () => Punkte }
  const schritte: Schritt[] = []

  for (const f of daten.fluege) {
    if (!zaehlt(f, modus, jahr)) continue
    schritte.push({
      datum: f.datum,
      label: `${f.von.toUpperCase()} → ${f.nach.toUpperCase()}`,
      punkte: () => punkteFuerFlug(r, f),
    })
  }

  const verbraucht = new Map<string, number>()
  for (const b of daten.boden) {
    if (!zaehlt(b, modus, jahr)) continue
    const q = r.bodenQuellen.find((x) => x.id === b.quelle)
    if (!q) continue
    schritte.push({
      datum: b.datum,
      label: q.name,
      punkte: () => {
        const grenze = maxEinheiten(q)
        const bisher = verbraucht.get(q.id) ?? 0
        const nutzbar = Math.max(0, Math.min(b.anzahl, grenze - bisher))
        verbraucht.set(q.id, bisher + nutzbar)
        const anteil = b.anzahl > 0 ? nutzbar / b.anzahl : 0
        return punkteFuerEinheiten(q, nutzbar, b.freieQp * anteil)
      },
    })
  }

  schritte.sort((a, b) => a.datum.localeCompare(b.datum))

  const verlauf: VerlaufPunkt[] = []
  let points = 0
  let qp = 0
  for (const s of schritte) {
    const p = s.punkte()
    points += p.points
    qp += p.qp
    verlauf.push({
      datum: s.datum,
      points,
      qp,
      erreicht: points >= ziel.points && qp >= ziel.qualifyingPoints,
      label: s.label,
    })
  }
  return verlauf
}

/** Datum, an dem das Ziel im Verlauf erstmals erreicht wird – oder null. */
export function erreichtAm(verlauf: VerlaufPunkt[]): string | null {
  return verlauf.find((v) => v.erreicht)?.datum ?? null
}

export interface FlugVorschlag {
  klasse: KlassenId
  strecke: Strecke
  segmente: number
}

/**
 * Wie viele qualifizierende Flugsegmente die Lücke je Klasse/Strecke schließen.
 * Grundlage sind Flüge mit den vollintegrierten Airlines, denn nur die liefern
 * Qualifying Points.
 */
export function flugVorschlaege(r: Regelwerk, luecke: Luecke): FlugVorschlag[] {
  if (luecke.erreicht) return []
  const strecken: Strecke[] = ['kontinental', 'interkontinental']
  const vorschlaege: FlugVorschlag[] = []
  for (const klasse of Object.keys(r.flugPunkte) as KlassenId[]) {
    for (const strecke of strecken) {
      const wert = r.flugPunkte[klasse]?.[strecke] ?? 0
      if (wert <= 0) continue
      vorschlaege.push({
        klasse,
        strecke,
        segmente: Math.max(
          Math.ceil(luecke.points / wert),
          Math.ceil(luecke.qp / wert),
        ),
      })
    }
  }
  return vorschlaege
}

export interface RestKapazitaet {
  quelle: BodenQuelle
  einheitenFrei: number
  punkte: Punkte
}

/** Was an Boden-Punkten im Zieljahr noch möglich wäre – nur begrenzte Quellen. */
export function bodenRestKapazitaet(bilanz: Bilanz): RestKapazitaet[] {
  return bilanz.proQuelle
    .filter((q) => q.einheitenFrei !== Infinity && q.einheitenFrei > 0)
    .map((q) => ({
      quelle: q.quelle,
      einheitenFrei: q.einheitenFrei,
      punkte: punkteFuerEinheiten(q.quelle, q.einheitenFrei),
    }))
}

export interface Tempo {
  /** Points pro Tag im bisherigen Jahresverlauf */
  proTag: number
  /** Hochrechnung auf den 31.12. des Zieljahres */
  hochrechnungPoints: number
  hochrechnungQp: number
  /** false, wenn zu wenig Ist-Daten für eine sinnvolle Aussage vorliegen */
  belastbar: boolean
}

/**
 * Lineare Hochrechnung aus dem bisherigen Ist-Tempo des Zieljahres.
 * Bewusst konservativ: unter drei Ist-Einträgen gilt sie als nicht belastbar.
 */
export function berechneTempo(
  bilanz: Bilanz,
  zieljahr: number,
  heute: Date = new Date(),
): Tempo {
  const start = new Date(Date.UTC(zieljahr, 0, 1))
  const ende = new Date(Date.UTC(zieljahr, 11, 31))
  const jetzt = heute < start ? start : heute > ende ? ende : heute
  // Beide Zeiträume einschließlich zählen: Am 1. Januar ist ein Tag vergangen,
  // am 31. Dezember das ganze Jahr. Ohne das +1 rechnet die Hochrechnung am
  // Jahresende über den tatsächlichen Stand hinaus.
  const vergangeneTage = (jetzt.getTime() - start.getTime()) / 86_400_000 + 1
  const jahresTage = (ende.getTime() - start.getTime()) / 86_400_000 + 1

  const proTag = bilanz.gesamt.points / vergangeneTage
  const faktor = jahresTage / vergangeneTage
  const eintraege = bilanz.anzahlFluege + bilanz.proQuelle.filter((q) => q.einheitenGezaehlt > 0).length

  return {
    proTag,
    hochrechnungPoints: Math.round(bilanz.gesamt.points * faktor),
    hochrechnungQp: Math.round(bilanz.gesamt.qp * faktor),
    belastbar: eintraege >= 3 && heute >= start && vergangeneTage >= 30,
  }
}

/** Prozentwert für Fortschrittsbalken, auf 0–100 begrenzt. */
export function anteil(wert: number, ziel: number): number {
  if (ziel <= 0) return 100
  return Math.min(100, Math.max(0, (wert / ziel) * 100))
}
