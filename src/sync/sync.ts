import { supabase } from '../supabase/client'
import type { AppDaten, BodenEintrag, Flug, KlassenId, Strecke } from '../core/types'
import { einstellungenAbbild, fuehreZusammen, einstellungenGeaendert } from './merge'

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
  const [fernFluege, fernBoden] = await Promise.all([
    hole('sf_fluege', userId),
    hole('sf_boden', userId),
  ])

  const fluege = fuehreZusammen(daten.fluege, fernFluege.map(zeileZuFlug))
  const boden = fuehreZusammen(daten.boden, fernBoden.map(zeileZuBoden))

  const gesendeteFluege = await sende(
    'sf_fluege',
    fluege.zuSenden.map((f) => flugZuZeile(f, userId)),
  )
  const gesendetesBoden = await sende(
    'sf_boden',
    boden.zuSenden.map((b) => bodenZuZeile(b, userId)),
  )

  // Die Rückgabe enthält den Zeitstempel, den der Server gesetzt hat.
  const stempel = (zeilen: Zeile[]) =>
    new Map(zeilen.map((z) => [String(z.id), String(z.geaendert_am ?? '')]))
  const flugStempel = stempel(gesendeteFluege)
  const bodenStempel = stempel(gesendetesBoden)

  const uebernommen = <T extends { id: string; dirty: boolean; geaendertAm: string }>(
    liste: T[],
    karte: Map<string, string>,
  ): T[] =>
    liste.map((e) =>
      karte.has(e.id) ? { ...e, dirty: false, geaendertAm: karte.get(e.id)! } : e,
    )

  const einstellungen = await gleicheEinstellungenAb(daten, userId)

  return {
    daten: {
      ...daten,
      ...einstellungen,
      fluege: uebernommen(fluege.lokal, flugStempel),
      boden: uebernommen(boden.lokal, bodenStempel),
    },
    hochgeladen: gesendeteFluege.length + gesendetesBoden.length,
    heruntergeladen: fernFluege.length + fernBoden.length,
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
