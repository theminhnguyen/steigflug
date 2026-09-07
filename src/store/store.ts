import type { AppDaten, BodenEintrag, Flug } from '../core/types'

const SCHLUESSEL = 'steigflug.daten.v1'
export const SCHEMA_VERSION = 1

export function leereDaten(zieljahr: number): AppDaten {
  return {
    schema: SCHEMA_VERSION,
    zieljahr,
    zielStatus: 'frequent-traveller',
    fluege: [],
    boden: [],
    regelwerkOverrides: {},
  }
}

/** Erzeugt eine ID, die auch ohne crypto.randomUUID funktioniert (ältere iOS-Browser). */
export function neueId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Repariert unvollständige Daten, statt sie zu verwerfen. So überlebt ein
 * Import aus einer älteren Version, ohne dass Einträge verloren gehen.
 */
export function normalisiere(roh: unknown, fallbackJahr: number): AppDaten {
  const basis = leereDaten(fallbackJahr)
  if (!roh || typeof roh !== 'object') return basis
  const d = roh as Partial<AppDaten>

  const jahr = Number(d.zieljahr)
  const fluege = Array.isArray(d.fluege) ? d.fluege : []
  const boden = Array.isArray(d.boden) ? d.boden : []

  return {
    schema: SCHEMA_VERSION,
    zieljahr: Number.isFinite(jahr) && jahr > 2000 && jahr < 2100 ? jahr : fallbackJahr,
    zielStatus: typeof d.zielStatus === 'string' ? d.zielStatus : basis.zielStatus,
    fluege: fluege.map(
      (f: Partial<Flug>): Flug => ({
        id: f.id ?? neueId(),
        datum: f.datum ?? '',
        von: (f.von ?? '').toUpperCase(),
        nach: (f.nach ?? '').toUpperCase(),
        airline: (f.airline ?? 'LH').toUpperCase(),
        klasse: f.klasse ?? 'economy',
        strecke: f.strecke ?? 'kontinental',
        streckeManuell: Boolean(f.streckeManuell),
        geplant: Boolean(f.geplant),
        // Eine Sicherung kann von Hand bearbeitet worden sein. Negative
        // Gutschriften gibt es nicht — sonst zöge ein Flug Punkte ab.
        korrekturPoints: nichtNegativ(f.korrekturPoints),
        korrekturQp: nichtNegativ(f.korrekturQp),
        notiz: f.notiz ?? '',
      }),
    ),
    boden: boden.map(
      (b: Partial<BodenEintrag>): BodenEintrag => ({
        id: b.id ?? neueId(),
        datum: b.datum ?? '',
        quelle: b.quelle ?? 'sonstiges',
        anzahl: Math.max(0, Number(b.anzahl) || 0),
        freieQp: Math.max(0, Number(b.freieQp) || 0),
        geplant: Boolean(b.geplant),
        notiz: b.notiz ?? '',
      }),
    ),
    regelwerkOverrides:
      d.regelwerkOverrides && typeof d.regelwerkOverrides === 'object'
        ? (d.regelwerkOverrides as Record<string, unknown>)
        : {},
  }
}

function nichtNegativ(wert: unknown): number | null {
  return typeof wert === 'number' && Number.isFinite(wert) ? Math.max(0, wert) : null
}

export function lade(fallbackJahr: number): AppDaten {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (!roh) return leereDaten(fallbackJahr)
    return normalisiere(JSON.parse(roh), fallbackJahr)
  } catch {
    // Privater Modus, blockierte Site-Daten oder kaputtes JSON: leer starten,
    // statt die App unbrauchbar zu machen.
    return leereDaten(fallbackJahr)
  }
}

export function speichere(daten: AppDaten): boolean {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(daten))
    return true
  } catch {
    return false
  }
}

export function alsJson(daten: AppDaten): string {
  return JSON.stringify({ ...daten, exportiertAm: new Date().toISOString() }, null, 2)
}

export function dateiname(daten: AppDaten): string {
  const heute = new Date().toISOString().slice(0, 10)
  return `steigflug-${daten.zieljahr}-${heute}.json`
}

/**
 * Prüft, ob ein eingelesenes Objekt überhaupt eine Steigflug-Sicherung ist.
 * Ohne diese Hürde würde eine versehentlich gewählte fremde JSON-Datei von
 * `normalisiere` klaglos zu Leerdaten geglättet — und dabei den gesamten
 * Bestand des Nutzers überschreiben.
 */
export function istSicherung(roh: unknown): boolean {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return false
  const d = roh as Record<string, unknown>
  return Array.isArray(d.fluege) || Array.isArray(d.boden)
}

/** Ob überhaupt etwas drinsteht, das beim Überschreiben verloren ginge. */
export function hatEintraege(daten: AppDaten): boolean {
  return daten.fluege.length > 0 || daten.boden.length > 0
}

/**
 * Einträge, deren Datum sich keinem Kalenderjahr zuordnen lässt. Sie tauchen in
 * keiner Jahresansicht auf und wären sonst unsichtbar — eine Sicherung kann von
 * Hand bearbeitet worden sein.
 */
export function ohneGueltigesDatum(daten: AppDaten): number {
  const ungueltig = (d: string) => !/^\d{4}-\d{2}-\d{2}$/.test(d)
  return (
    daten.fluege.filter((f) => ungueltig(f.datum)).length +
    daten.boden.filter((b) => ungueltig(b.datum)).length
  )
}
