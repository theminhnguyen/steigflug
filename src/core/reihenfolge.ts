import { heuteIso } from './format'

interface MitDatum {
  datum: string
}

interface Segment extends MitDatum {
  von: string
  nach: string
}

/**
 * Bringt Flugsegmente desselben Tages in Reisereihenfolge: Ein Segment, dessen
 * Ziel der Startflughafen des nächsten ist, kommt davor. Ohne das stünde bei
 * einer Umsteigeverbindung womöglich „VIE → OTP“ über „DUS → VIE“.
 *
 * Lässt sich keine eindeutige Kette bilden (zwei getrennte Reisen am selben
 * Tag, Ringflüge), bleibt die vorhandene Reihenfolge unangetastet. Verloren
 * geht dabei nie ein Eintrag.
 */
export function ordneSegmente<T extends Segment>(gruppe: T[]): T[] {
  if (gruppe.length < 2) return gruppe

  const ziele = new Set(gruppe.map((e) => e.nach))
  const anfaenge = gruppe.filter((e) => !ziele.has(e.von))
  if (anfaenge.length !== 1) return gruppe

  const nachStart = new Map<string, T[]>()
  for (const e of gruppe) {
    const liste = nachStart.get(e.von)
    if (liste) liste.push(e)
    else nachStart.set(e.von, [e])
  }

  const kette: T[] = []
  const benutzt = new Set<T>()
  let aktuell: T | undefined = anfaenge[0]
  while (aktuell && !benutzt.has(aktuell)) {
    kette.push(aktuell)
    benutzt.add(aktuell)
    aktuell = (nachStart.get(aktuell.nach) ?? []).find((e) => !benutzt.has(e))
  }

  // Was die Kette nicht erreicht hat, hängt hinten an — nichts darf fehlen.
  return [...kette, ...gruppe.filter((e) => !benutzt.has(e))]
}

/**
 * Reihenfolge für die Listen: erst was noch bevorsteht, zeitlich aufsteigend,
 * darunter das Vergangene, neuestes zuerst.
 *
 * Der nächste Termin gehört nach oben — genau so zeigt es auch die Airline-App.
 * Eine durchgehend absteigende Liste stellte bei lauter Buchungen in der Zukunft
 * die am weitesten entfernte Reise ganz nach oben.
 */
export function sortiereFuerAnzeige<T extends MitDatum>(
  eintraege: T[],
  heute: string = heuteIso(),
): T[] {
  const bevorstehend = eintraege
    .filter((e) => e.datum >= heute)
    .sort((a, b) => a.datum.localeCompare(b.datum))
  const vergangen = eintraege
    .filter((e) => e.datum < heute)
    .sort((a, b) => b.datum.localeCompare(a.datum))
  return [...bevorstehend, ...vergangen]
}

/** Wie `sortiereFuerAnzeige`, zusätzlich mit Reisereihenfolge je Tag. */
export function sortiereSegmente<T extends Segment>(
  eintraege: T[],
  heute: string = heuteIso(),
): T[] {
  const sortiert = sortiereFuerAnzeige(eintraege, heute)
  const ergebnis: T[] = []
  let i = 0
  while (i < sortiert.length) {
    let j = i
    while (j < sortiert.length && sortiert[j]!.datum === sortiert[i]!.datum) j++
    ergebnis.push(...ordneSegmente(sortiert.slice(i, j)))
    i = j
  }
  return ergebnis
}
