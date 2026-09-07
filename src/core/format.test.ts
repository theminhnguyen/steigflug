import { describe, expect, it } from 'vitest'
import { datum, datumKurz, menge, zahl, zahlAusFeld } from './format'

describe('menge', () => {
  it('setzt Einzahl bei genau eins', () => {
    expect(menge(1, 'Segment', 'Segmente')).toBe('1 Segment')
    expect(menge(1, 'Aufenthalt', 'Aufenthalte')).toBe('1 Aufenthalt')
  })

  it('setzt Mehrzahl bei null und ab zwei', () => {
    expect(menge(0, 'Segment', 'Segmente')).toBe('0 Segmente')
    expect(menge(2, 'Segment', 'Segmente')).toBe('2 Segmente')
  })
})

describe('zahl', () => {
  it('formatiert mit deutschem Tausenderpunkt', () => {
    expect(zahl(2000)).toBe('2.000')
    expect(zahl(650)).toBe('650')
  })

  it('rundet Bruchteile', () => {
    expect(zahl(19.6)).toBe('20')
  })
})

describe('datum', () => {
  it('schreibt das Datum aus', () => {
    expect(datum('2027-03-15')).toBe('15. März 2027')
  })

  it('verschiebt sich nicht über die Zeitzone', () => {
    // Ohne feste Uhrzeit landet ein UTC-Datum je nach Zone einen Tag früher.
    expect(datum('2027-01-01')).toBe('1. Januar 2027')
    expect(datumKurz('2027-01-01')).toBe('01.01.')
  })

  it('kommt mit leeren und kaputten Werten klar', () => {
    expect(datum('')).toBe('—')
    expect(datum('unsinn')).toBe('unsinn')
  })
})

describe('zahlAusFeld', () => {
  it('lässt gültige Zahlen durch', () => {
    expect(zahlAusFeld('42')).toBe(42)
    expect(zahlAusFeld('0')).toBe(0)
  })

  it('fängt negative Eingaben ab', () => {
    expect(zahlAusFeld('-7')).toBe(0)
  })

  it('fängt unbrauchbare Eingaben ab, statt NaN durchzureichen', () => {
    expect(zahlAusFeld('')).toBe(0)
    expect(zahlAusFeld('e')).toBe(0)
    expect(zahlAusFeld('abc')).toBe(0)
  })

  it('achtet auf eine abweichende Untergrenze', () => {
    expect(zahlAusFeld('0', 1)).toBe(1)
    expect(zahlAusFeld('5', 1)).toBe(5)
  })
})
