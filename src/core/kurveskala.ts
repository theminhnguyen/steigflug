/**
 * Skalenrechnung für die Verlaufskurve. Bewusst außerhalb der Komponente, weil
 * genau hier ein Absturz schlummerte: Eine Schwelle von null ergab eine
 * unendliche Obergrenze und damit ein Feld unendlicher Länge.
 */

/** Anteil am Ziel in Prozent. Ohne Ziel gibt es keinen sinnvollen Anteil. */
export function anteilProzent(wert: number, ziel: number): number {
  if (!Number.isFinite(wert) || !Number.isFinite(ziel) || ziel <= 0) return 0
  return (wert / ziel) * 100
}

export interface Skala {
  /** Oberer Rand der Achse in Prozent */
  obenPct: number
  /** Abstand zwischen zwei Gitterlinien in Prozent */
  schritt: number
  /** Die Beschriftungen von unten nach oben */
  stufen: number[]
}

/** Höchstzahl an Gitterlinien — mehr wird unlesbar und bläht die Anzeige auf. */
const MAX_LINIEN = 7

/**
 * Legt die senkrechte Achse fest. Die Ziellinie bei 100 Prozent ist immer
 * sichtbar, auch wenn erst wenig erreicht ist — sonst verlöre die Kurve ihren
 * Bezugspunkt.
 */
export function berechneSkala(hoechsterAnteil: number): Skala {
  const sicher = Number.isFinite(hoechsterAnteil) ? Math.max(0, hoechsterAnteil) : 0
  const roh = Math.max(120, sicher * 1.08)
  // Schrittweite so wählen, dass nie mehr als MAX_LINIEN Linien entstehen.
  const schritt = Math.max(20, Math.ceil(roh / (MAX_LINIEN - 1) / 20) * 20)
  const obenPct = Math.ceil(roh / schritt) * schritt
  const anzahl = Math.floor(obenPct / schritt) + 1
  return {
    obenPct,
    schritt,
    stufen: Array.from({ length: anzahl }, (_, i) => i * schritt),
  }
}
