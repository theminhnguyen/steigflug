import type { AppDaten, SyncFelder } from '../core/types'

/** Gemeinsamer Nenner von Flug und BodenEintrag für den Abgleich. */
export type Abgleichbar = SyncFelder & { id: string }

export interface Zusammenfuehrung<T> {
  /** Der neue lokale Stand */
  lokal: T[]
  /** Einträge, die noch hochgeladen werden müssen */
  zuSenden: T[]
}

/**
 * Führt lokalen und entfernten Stand zusammen. Bewusst ohne Netzwerk, damit
 * sich jede Regel einzeln prüfen lässt.
 *
 * Grundsatz: Es geht nichts verloren. Zusammengeführt wird über die ID —
 * beide Seiten dürfen unabhängig voneinander Einträge hinzugefügt haben, und
 * beide behalten sie. Löschungen reisen als `geloescht`-Kennzeichen mit, nicht
 * als Abwesenheit einer Zeile.
 */
export function fuehreZusammen<T extends Abgleichbar>(
  lokal: T[],
  fern: T[],
): Zusammenfuehrung<T> {
  const ergebnis = new Map<string, T>()
  const zuSenden: T[] = []

  for (const e of lokal) ergebnis.set(e.id, e)

  for (const f of fern) {
    const eigen = ergebnis.get(f.id)
    if (!eigen) {
      // Nur auf dem Server: übernehmen.
      ergebnis.set(f.id, f)
      continue
    }
    if (eigen.dirty) {
      // Lokal geändert und noch nicht gesendet — die eigene Fassung gewinnt und
      // wird hochgeladen. Sonst überschriebe ein Abgleich frische Eingaben.
      continue
    }
    ergebnis.set(f.id, f)
  }

  const fernIds = new Set(fern.map((f) => f.id))
  for (const e of ergebnis.values()) {
    // Alles, was lokal geändert wurde oder dem Server noch gar nicht bekannt
    // ist, muss hoch. Ein nie abgeglichener Eintrag hat kein Server-Datum.
    if (e.dirty || !fernIds.has(e.id) || e.geaendertAm === '') zuSenden.push(e)
  }

  return { lokal: [...ergebnis.values()], zuSenden }
}

/** Sichtbare Einträge: alles außer sanft Gelöschtem. */
export function ohneGeloeschte<T extends Abgleichbar>(eintraege: T[]): T[] {
  return eintraege.filter((e) => !e.geloescht)
}

/** Sanftes Löschen statt Entfernen, damit die Löschung mitreist. */
export function alsGeloescht<T extends Abgleichbar>(eintrag: T): T {
  return { ...eintrag, geloescht: true, dirty: true }
}

/** Die Einstellungen als Vergleichsabbild. */
export function einstellungenAbbild(daten: AppDaten): string {
  return JSON.stringify({
    zieljahr: daten.zieljahr,
    zielStatus: daten.zielStatus,
    regelwerkOverrides: daten.regelwerkOverrides,
  })
}

export function einstellungenGeaendert(daten: AppDaten): boolean {
  return einstellungenAbbild(daten) !== daten.einstellungenGesendet
}

/** Wie viele Änderungen auf den nächsten Abgleich warten. */
export function offeneAenderungen(daten: AppDaten): number {
  const zaehle = (liste: Abgleichbar[]) =>
    liste.filter((e) => e.dirty || e.geaendertAm === '').length
  return (
    zaehle(daten.fluege) +
    zaehle(daten.boden) +
    zaehle(daten.uptripKarten) +
    zaehle(daten.uptripKollektionen) +
    (einstellungenGeaendert(daten) ? 1 : 0)
  )
}

/** Vergleichsabbild eines Eintrags, um eine Änderung während des Abgleichs zu erkennen. */
function abbild<T extends Abgleichbar>(e: T): string {
  return JSON.stringify(e)
}

/**
 * Schreibt das Ergebnis eines Abgleichs zurück in den Zustand.
 *
 * **Nicht** mit `fuehreZusammen` verwechseln: Dort ist die zweite Liste
 * Fremddaten, und eine ungesendete lokale Änderung gewinnt zu Recht. Hier ist
 * die zweite Liste das eigene, bereits abgeglichene Ergebnis — dieselbe Regel
 * würde es verwerfen und die Einträge blieben auf ewig „offen“. Genau das war
 * der Fall: Die Ampel wurde nie grün, und der Abgleich lief immer wieder los.
 *
 * Vorrang bekommt der aktuelle Stand nur dort, wo er sich seit dem Start des
 * Abgleichs tatsächlich geändert hat — also bei Eingaben während des Wartens.
 */
export function uebernimmErgebnis<T extends Abgleichbar>(
  aktuell: T[],
  vorher: T[],
  ergebnis: T[],
): T[] {
  const vorherNachId = new Map(vorher.map((e) => [e.id, abbild(e)]))
  const ergebnisNachId = new Map(ergebnis.map((e) => [e.id, e]))
  const zusammen = new Map<string, T>()

  for (const e of aktuell) {
    const waehrenddessenGeaendert = vorherNachId.get(e.id) !== abbild(e)
    const ausErgebnis = ergebnisNachId.get(e.id)
    zusammen.set(e.id, waehrenddessenGeaendert || !ausErgebnis ? e : ausErgebnis)
  }

  // Was der Abgleich neu vom Server geholt hat, kommt dazu.
  for (const e of ergebnis) {
    if (!zusammen.has(e.id)) zusammen.set(e.id, e)
  }

  return [...zusammen.values()]
}
