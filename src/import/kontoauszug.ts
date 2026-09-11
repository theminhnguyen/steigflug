import type { BodenEintrag } from '../core/types'
import type { BodenQuelle } from '../rules'

/**
 * Einlesen des Kontoauszugs aus Miles & More.
 *
 * Quelle: api.miles-and-more.com/ui-services/v1/me/statement-ui-printer/table
 * Die Antwort ist keine Datenliste, sondern eine Bauanleitung für die Tabelle
 * auf der Kontoseite („Server-Driven UI“): Rahmen, Abstände, Textfelder. Die
 * Buchungen stecken in Zeilen mit der Kennung `transactionRecord_N_row`, die
 * Werte in Knoten mit sprechenden Kennungen (`…_Date`, `…_Items`,
 * `…_CurrencyAmountRow`). Daran hält sich dieser Leser — nicht an Positionen
 * im Baum, damit ein umgebautes Layout ihn nicht sofort bricht.
 *
 * Übernommen werden nur Gutschriften ohne Flug. Flüge kommen sauberer über die
 * Flugliste und zählten sonst doppelt.
 */

type Knoten = Record<string, unknown>

function istKnoten(w: unknown): w is Knoten {
  return typeof w === 'object' && w !== null && !Array.isArray(w)
}

/** Alle Knoten des Baums, in Dokumentreihenfolge. */
function* alleKnoten(w: unknown): Generator<Knoten> {
  if (Array.isArray(w)) {
    for (const x of w) yield* alleKnoten(x)
  } else if (istKnoten(w)) {
    yield w
    for (const wert of Object.values(w)) {
      if (typeof wert === 'object' && wert !== null) yield* alleKnoten(wert)
    }
  }
}

/* ---------- Umlaute ---------- */

/** Rückwärtstabelle Windows-1252 für die Zeichen 0x80–0x9F. */
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
}

/**
 * Repariert Umlaute, die als „Ã¼“ statt „ü“ ankommen. Das passiert, wenn der
 * Browser die Antwort beim Anzeigen als Windows-1252 statt als UTF-8 liest und
 * man sie so kopiert. Bei „Ãœ“ (Ü) steckt dabei ein Zeichen jenseits von
 * Latin-1 im Text — ohne die Rückwärtstabelle bliebe gerade das Ü kaputt.
 * Übernommen wird die Umwandlung nur, wenn sie restlos aufgeht.
 */
export function repariereUmlaute(text: string): string {
  if (!/[ÃÂ]/.test(text)) return text
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    const b = c <= 0xff ? c : CP1252[c]
    if (b === undefined) return text
    bytes[i] = b
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return text
  }
}

/* ---------- Einzelwerte ---------- */

function isoAusDeutsch(text: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/** „1.250“ → 1250, „−500“ → −500. Alles andere ist keine Zahl. */
export function zahlAusText(text: string): number | null {
  const t = text.replace(/\s/g, '').replace(/[−–]/g, '-').replace(/\./g, '').replace(',', '.')
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

function textVon(k: Knoten): string {
  return typeof k.text === 'string' ? repariereUmlaute(k.text).trim() : ''
}

type Betragsart = 'points' | 'qp' | 'meilen' | 'hon'

/**
 * Beschriftungen der Beträge. Exakt verglichen, nicht als Teilstück — sonst
 * fände „Points“ sich auch in „Qualifying Points“ und „HON Circle Points“.
 */
const BESCHRIFTUNG: Record<string, Betragsart> = {
  points: 'points',
  'qualifying points': 'qp',
  meilen: 'meilen',
  miles: 'meilen',
  prämienmeilen: 'meilen',
  'award miles': 'meilen',
  'hon circle points': 'hon',
}

function leseBetragszeile(zeile: Knoten): [Betragsart | null, number | null] {
  const zellen = Array.isArray(zeile.cells) ? zeile.cells : []
  const ersterText = (w: unknown, passt: (t: string) => boolean): string => {
    for (const k of alleKnoten(w)) {
      if (k.type !== 'copyText') continue
      const t = textVon(k)
      if (passt(t)) return t
    }
    return ''
  }
  const bezeichnung = ersterText(zellen[0], (t) => t.length > 0).toLowerCase()
  const wert = ersterText(zellen[1], (t) => zahlAusText(t) !== null)
  return [BESCHRIFTUNG[bezeichnung] ?? null, wert ? zahlAusText(wert) : null]
}

/* ---------- Buchungen ---------- */

export interface Buchung {
  /** ISO-Datum der Gutschrift */
  datum: string
  /** Partner laut Logo, etwa „Lufthansa“ oder „Marriott Bonvoy“ */
  partner: string
  /** Die Beschreibungszeilen, etwa Strecke und Flugnummer */
  texte: string[]
  points: number
  qp: number
  meilen: number
  istFlug: boolean
  /** Inhaltlicher Schlüssel, stabil über wiederholte Abrufe */
  schluessel: string
}

/** Flugnummer mit Reiseklasse: „LH 4110 … / Economy Class S“, „EW 9086 / Economy Class X“. */
const FLUGZEILE = /\b[A-Z0-9]{2}\s?\d{1,4}\b.*\b(class|klasse)\b/i

function leseZeile(zeile: Knoten): Omit<Buchung, 'schluessel'> | null {
  let datum = ''
  let partner = ''
  const texte: string[] = []
  const betraege: Record<Betragsart, number> = { points: 0, qp: 0, meilen: 0, hon: 0 }

  for (const k of alleKnoten(zeile)) {
    const id = typeof k.id === 'string' ? k.id : ''
    if (!datum && id.endsWith('_Date')) datum = isoAusDeutsch(textVon(k)) ?? ''
    if (!partner && k.type === 'image' && typeof k.contentDescription === 'string') {
      partner = repariereUmlaute(k.contentDescription).trim()
    }
    if (/_\d+_Items$/.test(id)) {
      const t = textVon(k)
      if (t) texte.push(t)
    }
    // Nur die Hauptbeträge. Aktionszeilen („Klimabeitrag geleistet“) tragen
    // eine andere Kennung und bringen ohnehin nur Meilen.
    if (id.endsWith('_CurrencyAmountRow')) {
      const [art, wert] = leseBetragszeile(k)
      if (art && wert !== null) betraege[art] += wert
    }
  }

  if (!datum) return null
  return {
    datum,
    partner,
    texte,
    points: betraege.points,
    qp: betraege.qp,
    meilen: betraege.meilen,
    istFlug: texte.some((t) => FLUGZEILE.test(t)),
  }
}

export interface Kontoauszug {
  buchungen: Buchung[]
  /** Wie viele Buchungen das Konto insgesamt hat; die Antwort enthält nur die neuesten */
  gesamt: number | null
}

const ZEILENKENNUNG = /^transactionRecord_\d+_row$/

export function istKontoauszug(roh: unknown): boolean {
  for (const k of alleKnoten(roh)) {
    if (typeof k.id === 'string' && ZEILENKENNUNG.test(k.id)) return true
  }
  return false
}

export function leseKontoauszug(roh: unknown): Kontoauszug {
  const buchungen: Buchung[] = []
  const vorkommen = new Map<string, number>()
  let gesamt: number | null = null

  for (const k of alleKnoten(roh)) {
    if (gesamt === null && istKnoten(k.pagination) && typeof k.pagination.total === 'number') {
      gesamt = k.pagination.total
    }
    if (typeof k.id !== 'string' || !ZEILENKENNUNG.test(k.id)) continue
    const b = leseZeile(k)
    if (!b) continue

    // Die Zeilenkennungen sind nur Positionen und wandern mit jeder neuen
    // Buchung. Der Schlüssel entsteht deshalb aus dem Inhalt — und zählt
    // gleiche Buchungen am selben Tag durch, damit zwei Uptrip-Kollektionen
    // an einem Tag nicht zu einer verschmelzen.
    const grund = ['kontoauszug', b.datum, b.partner, b.texte.join(' / '), b.points, b.qp].join('|')
    const n = (vorkommen.get(grund) ?? 0) + 1
    vorkommen.set(grund, n)
    buchungen.push({ ...b, schluessel: `${grund}#${n}` })
  }

  return { buchungen, gesamt }
}

/* ---------- Zuordnung zu Boden-Quellen ---------- */

/** Nur was für den Status zählt und kein Flug ist. */
export function istBodenGutschrift(b: Buchung): boolean {
  return !b.istFlug && (b.points > 0 || b.qp > 0)
}

/**
 * Welche Boden-Quelle eine Buchung vermutlich ist. Nur ein Vorschlag — echte
 * Beispiele für Uptrip, Marriott und Kreditkarte lagen beim Bau noch nicht
 * vor. Die Vorschau zeigt die Zuordnung deshalb an und lässt sie ändern.
 */
const MUSTER: [RegExp, string][] = [
  [/uptrip/i, 'uptrip'],
  [
    /marriott|bonvoy|moxy|sheraton|westin|courtyard|renaissance|ritz|regis|aloft|m[eé]ridien|autograph|residence inn|four points|jw |edition|design hotels|tribute|delta hotels|element|fairfield/i,
    'marriott',
  ],
  [/e-?voucher/i, 'evoucher'],
  [/willkommen|welcome|begr[üu][ßs]ung/i, 'kk-willkommen'],
  [/umwandlung|umtausch|tausch|conversion|points kauf/i, 'kk-meilentausch'],
]

export function schlageQuelleVor(b: Buchung): string {
  const text = [b.partner, ...b.texte].join(' ')
  for (const [muster, quelle] of MUSTER) if (muster.test(text)) return quelle
  return 'sonstiges'
}

/** Fester Prüfwert eines Textes (FNV-1a, 32 Bit). */
function pruefwert(text: string, saat: number): string {
  let h = saat >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Die Kennung eines übernommenen Eintrags folgt aus der Buchung selbst, nicht
 * aus dem Zufall. Liest man denselben Auszug auf zwei Geräten ein, bevor sie
 * sich abgeglichen haben, entsteht so auf beiden derselbe Eintrag — und der
 * Abgleich legt sie zusammen, statt die Gutschrift doppelt zu zählen.
 */
export function kennungAusSchluessel(schluessel: string): string {
  return `ka-${pruefwert(schluessel, 0x811c9dc5)}${pruefwert(schluessel, 0x9747b28c)}${pruefwert(schluessel, 0x1b873593)}`
}

/** Macht aus einer Buchung einen Boden-Eintrag mit der echten Gutschrift. */
export function alsBodenEintrag(b: Buchung, q: BodenQuelle): BodenEintrag {
  const jeEinheit = q.pointsProEinheit ?? 0
  const anzahl = q.freieEingabe
    ? Math.max(0, b.points)
    : q.einheitenAusPunkten && jeEinheit > 0
      ? Math.max(1, Math.round(b.points / jeEinheit))
      : 1
  return {
    id: kennungAusSchluessel(b.schluessel),
    datum: b.datum,
    quelle: q.id,
    anzahl,
    freieQp: q.freieEingabe ? Math.max(0, b.qp) : 0,
    geplant: false,
    notiz: [b.partner, ...b.texte].filter(Boolean).join(' · ') + ' · aus dem Kontoauszug',
    korrekturPoints: b.points,
    korrekturQp: b.qp,
    herkunft: b.schluessel,
    geaendertAm: '',
    dirty: true,
    geloescht: false,
  }
}

/* ---------- Zusammenführen mit dem Bestand ---------- */

export interface BodenPlan {
  /** Ganz neue Einträge */
  neu: BodenEintrag[]
  /** Geplante Handeinträge, die die Buchung jetzt bestätigt */
  erfuellt: { vorher: BodenEintrag; nachher: BodenEintrag }[]
  /** Buchungen, die schon übernommen waren */
  schonDa: number
  /** Buchungen, deren Eintrag du gelöscht hast — die kommen nicht wieder */
  verworfen: number
}

const TAG = 86_400_000
/** Wie weit Aufenthalt und Gutschrift auseinanderliegen dürfen. */
const HOECHSTABSTAND_TAGE = 45

function tageZwischen(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / TAG
}

/**
 * Führt übernommene Buchungen mit den vorhandenen Boden-Einträgen zusammen.
 *
 * Wichtigster Fall: Du hast eine Moxy-Nacht als geplant eingetragen, später
 * kommt die Gutschrift. Ohne Abgleich stünde sie doppelt da — einmal geplant
 * mit dem Regelwert, einmal echt. Deshalb bestätigt die Buchung den nächst-
 * gelegenen geplanten Handeintrag derselben Quelle im selben Jahr (höchstens
 * 45 Tage Abstand, weil Gutschriften oft Tage bis Wochen nachlaufen). Datum
 * und Notiz des Handeintrags bleiben, die echte Gutschrift kommt dazu.
 */
export function verschmelzeBuchungen(bestand: BodenEintrag[], neue: BodenEintrag[]): BodenPlan {
  const lebend = bestand.filter((b) => !b.geloescht)
  const bekannt = new Set(lebend.map((b) => b.herkunft).filter(Boolean))
  // Gelöschtes zählt mit: Wer eine übernommene Gutschrift entfernt, will sie
  // beim nächsten Einlesen nicht zurückbekommen.
  const geloescht = new Set(
    bestand.filter((b) => b.geloescht).map((b) => b.herkunft).filter(Boolean),
  )
  const vergeben = new Set<string>()
  const plan: BodenPlan = { neu: [], erfuellt: [], schonDa: 0, verworfen: 0 }

  for (const e of neue) {
    if (bekannt.has(e.herkunft)) {
      plan.schonDa++
      continue
    }
    if (geloescht.has(e.herkunft)) {
      plan.verworfen++
      continue
    }
    bekannt.add(e.herkunft)

    const kandidat = lebend
      .filter(
        (b) =>
          b.geplant &&
          !b.herkunft &&
          !vergeben.has(b.id) &&
          b.quelle === e.quelle &&
          b.datum.slice(0, 4) === e.datum.slice(0, 4) &&
          tageZwischen(b.datum, e.datum) <= HOECHSTABSTAND_TAGE,
      )
      .sort((a, b) => tageZwischen(a.datum, e.datum) - tageZwischen(b.datum, e.datum))[0]

    if (kandidat) {
      vergeben.add(kandidat.id)
      plan.erfuellt.push({
        vorher: kandidat,
        nachher: {
          ...kandidat,
          geplant: false,
          anzahl: e.anzahl,
          freieQp: e.freieQp,
          korrekturPoints: e.korrekturPoints,
          korrekturQp: e.korrekturQp,
          herkunft: e.herkunft,
          notiz: kandidat.notiz ? `${kandidat.notiz} · bestätigt durch Kontoauszug` : e.notiz,
          dirty: true,
        },
      })
    } else {
      plan.neu.push(e)
    }
  }
  return plan
}
