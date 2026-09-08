import { describe, expect, it } from 'vitest'
import { anteilProzent, berechneSkala } from './kurveskala'

describe('anteilProzent', () => {
  it('rechnet den Anteil am Ziel aus', () => {
    expect(anteilProzent(325, 650)).toBe(50)
    expect(anteilProzent(650, 650)).toBe(100)
  })

  it('gibt null zurück, wenn es kein Ziel gibt', () => {
    // Im Regelwerk lässt sich eine Schwelle auf null setzen. Vorher ergab das
    // Unendlich und riss die ganze Ansicht mit.
    expect(anteilProzent(200, 0)).toBe(0)
    expect(anteilProzent(200, -5)).toBe(0)
  })

  it('lässt weder NaN noch Unendlich durch', () => {
    expect(anteilProzent(Number.NaN, 650)).toBe(0)
    expect(anteilProzent(Number.POSITIVE_INFINITY, 650)).toBe(0)
    expect(anteilProzent(200, Number.NaN)).toBe(0)
  })
})

describe('berechneSkala', () => {
  it('zeigt die Ziellinie auch bei wenig Fortschritt', () => {
    const s = berechneSkala(31)
    expect(s.obenPct).toBeGreaterThanOrEqual(100)
    expect(s.stufen).toContain(100)
  })

  it('lässt der Kurve oben Luft, wenn das Ziel übertroffen ist', () => {
    expect(berechneSkala(180).obenPct).toBeGreaterThan(180)
  })

  it('bleibt bei jedem Wert unter acht Gitterlinien', () => {
    for (const anteil of [0, 31, 100, 180, 500, 3000, 50000, 1e9]) {
      expect(berechneSkala(anteil).stufen.length, String(anteil)).toBeLessThanOrEqual(7)
    }
  })

  it('stürzt bei unbrauchbaren Werten nicht ab', () => {
    for (const kaputt of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const s = berechneSkala(kaputt)
      expect(Number.isFinite(s.obenPct)).toBe(true)
      expect(s.stufen.length).toBeGreaterThan(0)
    }
  })

  it('liefert lückenlos aufsteigende Stufen', () => {
    const s = berechneSkala(240)
    expect(s.stufen[0]).toBe(0)
    for (let i = 1; i < s.stufen.length; i++) {
      expect(s.stufen[i]! - s.stufen[i - 1]!).toBe(s.schritt)
    }
    expect(s.stufen[s.stufen.length - 1]).toBe(s.obenPct)
  })
})
