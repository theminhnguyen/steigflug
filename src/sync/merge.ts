import type { AppDaten, BodenEintrag, Flug, SyncFelder } from '../core/types'

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

/** Markiert einen Eintrag als lokal geändert. */
export function alsGeaendert<T extends Abgleichbar>(eintrag: T): T {
  return { ...eintrag, dirty: true }
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
  const zaehle = (liste: (Flug | BodenEintrag)[]) =>
    liste.filter((e) => e.dirty || e.geaendertAm === '').length
  return (
    zaehle(daten.fluege) + zaehle(daten.boden) + (einstellungenGeaendert(daten) ? 1 : 0)
  )
}
