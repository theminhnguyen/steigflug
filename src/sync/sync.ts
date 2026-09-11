import { supabase } from '../supabase/client'
import type {
  AppDaten,
  BodenEintrag,
  Flug,
  KlassenId,
  Strecke,
  UptripKarte,
  UptripKollektion,
} from '../core/types'
import { alsKartenArt } from '../core/uptrip'
import {
  einstellungenAbbild,
  fuehreZusammen,
  einstellungenGeaendert,
  type Abgleichbar,
} from './merge'

/* ---------- Übersetzung zwischen App-Form und Tabellenspalten ---------- */

type Zeile = Record<string, unknown>

/**
 * Zahlen aus der Datenbank vorsichtig lesen. `Number(undefined)` ergibt NaN, und
 * ein einziges NaN vergiftet die gesamte Punkterechnung — die App zeigte dann
 * „NaN Points“. Fehlende oder unbrauchbare Werte werden deshalb abgefangen.
 */
function zahlOderNull(wert: unknown): number | null {
  if (wert === null || wert === undefined || wert === '') return null
  const n = Number(wert)
  return Number.isFinite(n) ? n : null
}

function zahlOderNull0(wert: unknown): number {
  return zahlOderNull(wert) ?? 0
}

export function flugZuZeile(f: Flug, userId: string): Zeile {
  return {
    user_id: userId,
    id: f.id,
    datum: f.datum,
    von: f.von,
    nach: f.nach,
    airline: f.airline,
    klasse: f.klasse,
    strecke: f.strecke,
    strecke_manuell: f.streckeManuell,
    geplant: f.geplant,
    korrektur_points: f.korrekturPoints,
    korrektur_qp: f.korrekturQp,
    notiz: f.notiz,
    geloescht: f.geloescht,
  }
}

export function zeileZuFlug(z: Zeile): Flug {
  return {
    id: String(z.id),
    datum: String(z.datum ?? ''),
    von: String(z.von ?? ''),
    nach: String(z.nach ?? ''),
    airline: String(z.airline ?? 'LH'),
    klasse: (z.klasse ?? 'economy') as KlassenId,
    strecke: (z.strecke ?? 'kontinental') as Strecke,
    streckeManuell: Boolean(z.strecke_manuell),
    geplant: Boolean(z.geplant),
    korrekturPoints: zahlOderNull(z.korrektur_points),
    korrekturQp: zahlOderNull(z.korrektur_qp),
    notiz: String(z.notiz ?? ''),
    geaendertAm: String(z.geaendert_am ?? ''),
    dirty: false,
    geloescht: Boolean(z.geloescht),
  }
}

export function bodenZuZeile(b: BodenEintrag, userId: string): Zeile {
  return {
    user_id: userId,
    id: b.id,
    datum: b.datum,
    quelle: b.quelle,
    anzahl: b.anzahl,
    freie_qp: b.freieQp,
    geplant: b.geplant,
    notiz: b.notiz,
    korrektur_points: b.korrekturPoints,
    korrektur_qp: b.korrekturQp,
    herkunft: b.herkunft,
    geloescht: b.geloescht,
  }
}

export function zeileZuBoden(z: Zeile): BodenEintrag {
  return {
    id: String(z.id),
    datum: String(z.datum ?? ''),
    quelle: String(z.quelle ?? 'sonstiges'),
    anzahl: zahlOderNull0(z.anzahl),
    freieQp: zahlOderNull0(z.freie_qp),
    geplant: Boolean(z.geplant),
    notiz: String(z.notiz ?? ''),
    korrekturPoints: zahlOderNull(z.korrektur_points),
    korrekturQp: zahlOderNull(z.korrektur_qp),
    herkunft: String(z.herkunft ?? ''),
    geaendertAm: String(z.geaendert_am ?? ''),
    dirty: false,
    geloescht: Boolean(z.geloescht),
  }
}

export function karteZuZeile(k: UptripKarte, userId: string): Zeile {
  return {
    user_id: userId,
    id: k.id,
    name: k.name,
    art: k.art,
    original: k.original,
    datum: k.datum,
    flug: k.flug,
    kollektion: k.kollektion,
    geloescht: k.geloescht,
  }
}

export function zeileZuKarte(z: Zeile): UptripKarte {
  return {
    id: String(z.id),
    name: String(z.name ?? ''),
    art: alsKartenArt(z.art),
    original: Boolean(z.original),
    datum: String(z.datum ?? ''),
    flug: String(z.flug ?? ''),
    kollektion: String(z.kollektion ?? ''),
    geaendertAm: String(z.geaendert_am ?? ''),
    dirty: false,
    geloescht: Boolean(z.geloescht),
  }
}

export function kollektionZuZeile(k: UptripKollektion, userId: string): Zeile {
  return {
    user_id: userId,
    id: k.id,
    name: k.name,
    belohnung: k.belohnung,
    benoetigt: k.benoetigt,
    mindest_originale: k.mindestOriginale,
    points: k.points,
    qp: k.qp,
    bringt_status: k.bringtStatus,
    eingeloest: k.eingeloest,
    geloescht: k.geloescht,
  }
}

export function zeileZuKollektion(z: Zeile): UptripKollektion {
  return {
    id: String(z.id),
    name: String(z.name ?? ''),
    belohnung: String(z.belohnung ?? ''),
    benoetigt: zahlOderNull0(z.benoetigt),
    mindestOriginale: zahlOderNull0(z.mindest_originale),
    points: zahlOderNull0(z.points),
    qp: zahlOderNull0(z.qp),
    bringtStatus: Boolean(z.bringt_status),
    eingeloest: Boolean(z.eingeloest),
    geaendertAm: String(z.geaendert_am ?? ''),
    dirty: false,
    geloescht: Boolean(z.geloescht),
  }
}

/* ---------- Abgleich ---------- */

export interface AbgleichErgebnis {
  daten: AppDaten
  hochgeladen: number
  heruntergeladen: number
}

export class AbgleichFehler extends Error {}

/**
 * Gleicht den lokalen Stand mit dem Konto ab.
 *
 * Ablauf: erst holen, dann zusammenführen, dann das Offene hochladen. Die
 * Zusammenführung entscheidet über die IDs, nicht über Zeitstempel des Geräts —
 * zwei Geräte mit abweichender Uhr können sich so nicht gegenseitig
 * überschreiben. Bei einem Konflikt gewinnt die lokal geänderte Fassung.
 */
export async function abgleichen(daten: AppDaten, userId: string): Promise<AbgleichErgebnis> {
  const [fluege, boden, karten, kollektionen] = await Promise.all([
    gleicheTabelleAb('sf_fluege', daten.fluege, userId, zeileZuFlug, flugZuZeile),
    gleicheTabelleAb('sf_boden', daten.boden, userId, zeileZuBoden, bodenZuZeile),
    gleicheTabelleAb('sf_uptrip_karten', daten.uptripKarten, userId, zeileZuKarte, karteZuZeile),
    gleicheTabelleAb(
      'sf_uptrip_kollektionen',
      daten.uptripKollektionen,
      userId,
      zeileZuKollektion,
      kollektionZuZeile,
    ),
  ])
  const einstellungen = await gleicheEinstellungenAb(daten, userId)
  const teile = [fluege, boden, karten, kollektionen]

  return {
    daten: {
      ...daten,
      ...einstellungen,
      fluege: fluege.liste,
      boden: boden.liste,
      uptripKarten: karten.liste,
      uptripKollektionen: kollektionen.liste,
    },
    hochgeladen: teile.reduce((s, t) => s + t.hochgeladen, 0),
    heruntergeladen: teile.reduce((s, t) => s + t.heruntergeladen, 0),
  }
}

/**
 * Eine Tabelle abgleichen: holen, zusammenführen, das Offene hochladen. Erst
 * mit dem Zeitstempel aus der Antwort des Servers gilt ein Eintrag als
 * abgeglichen — den setzt der Server, nicht das Gerät.
 */
async function gleicheTabelleAb<T extends Abgleichbar>(
  tabelle: string,
  lokal: T[],
  userId: string,
  ausZeile: (z: Zeile) => T,
  zuZeile: (e: T, userId: string) => Zeile,
): Promise<{ liste: T[]; hochgeladen: number; heruntergeladen: number }> {
  const fern = await hole(tabelle, userId)
  const zusammen = fuehreZusammen(lokal, fern.map(ausZeile))
  const gesendet = await sende(
    tabelle,
    zusammen.zuSenden.map((e) => zuZeile(e, userId)),
  )
  const stempel = new Map(gesendet.map((z) => [String(z.id), String(z.geaendert_am ?? '')]))
  return {
    liste: zusammen.lokal.map((e) =>
      stempel.has(e.id) ? { ...e, dirty: false, geaendertAm: stempel.get(e.id)! } : e,
    ),
    hochgeladen: gesendet.length,
    heruntergeladen: fern.length,
  }
}

async function hole(tabelle: string, userId: string): Promise<Zeile[]> {
  const { data, error } = await supabase.from(tabelle).select('*').eq('user_id', userId)
  if (error) throw new AbgleichFehler(error.message)
  return (data ?? []) as Zeile[]
}

async function sende(tabelle: string, zeilen: Zeile[]): Promise<Zeile[]> {
  if (zeilen.length === 0) return []
  const { data, error } = await supabase
    .from(tabelle)
    .upsert(zeilen, { onConflict: 'user_id,id' })
    .select()
  if (error) throw new AbgleichFehler(error.message)
  return (data ?? []) as Zeile[]
}

/**
 * Einstellungen sind eine einzige Zeile. Lokale Änderungen gewinnen; sonst wird
 * übernommen, was im Konto steht — so findet ein frisch angemeldetes zweites
 * Gerät dasselbe Zieljahr vor.
 */
async function gleicheEinstellungenAb(
  daten: AppDaten,
  userId: string,
): Promise<Partial<AppDaten>> {
  if (einstellungenGeaendert(daten)) {
    const { error } = await supabase.from('sf_einstellungen').upsert({
      user_id: userId,
      zieljahr: daten.zieljahr,
      ziel_status: daten.zielStatus,
      regelwerk_overrides: daten.regelwerkOverrides,
    })
    if (error) throw new AbgleichFehler(error.message)
    return { einstellungenGesendet: einstellungenAbbild(daten) }
  }

  const { data, error } = await supabase
    .from('sf_einstellungen')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new AbgleichFehler(error.message)
  if (!data) return {}

  const uebernommen: Partial<AppDaten> = {
    zieljahr: zahlOderNull(data.zieljahr) ?? daten.zieljahr,
    zielStatus: String(data.ziel_status),
    regelwerkOverrides: (data.regelwerk_overrides ?? {}) as Record<string, unknown>,
  }
  return {
    ...uebernommen,
    einstellungenGesendet: einstellungenAbbild({ ...daten, ...uebernommen } as AppDaten),
  }
}
