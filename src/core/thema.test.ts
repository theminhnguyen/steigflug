import { describe, expect, it } from 'vitest'
import { aufloesen, istWahl, naechsteWahl } from './thema'

describe('aufloesen', () => {
  it('folgt dem Gerät, wenn nichts festgelegt ist', () => {
    expect(aufloesen('system', true)).toBe('dunkel')
    expect(aufloesen('system', false)).toBe('hell')
  })

  it('übergeht das Gerät bei fester Wahl', () => {
    expect(aufloesen('hell', true)).toBe('hell')
    expect(aufloesen('dunkel', false)).toBe('dunkel')
  })
})

describe('naechsteWahl', () => {
  it('schaltet im Kreis und kommt wieder heraus, wo es begann', () => {
    expect(naechsteWahl('system')).toBe('hell')
    expect(naechsteWahl('hell')).toBe('dunkel')
    expect(naechsteWahl('dunkel')).toBe('system')
  })

  it('erreicht in drei Schritten wieder den Anfang', () => {
    let w = 'system' as ReturnType<typeof naechsteWahl>
    for (let i = 0; i < 3; i++) w = naechsteWahl(w)
    expect(w).toBe('system')
  })
})

describe('istWahl', () => {
  it('erkennt gültige Werte', () => {
    expect(istWahl('system')).toBe(true)
    expect(istWahl('hell')).toBe(true)
    expect(istWahl('dunkel')).toBe(true)
  })

  it('weist alles andere ab, damit ein kaputter Speicher nichts anrichtet', () => {
    for (const kaputt of [null, undefined, '', 'light', 'DUNKEL', 42, {}]) {
      expect(istWahl(kaputt), String(kaputt)).toBe(false)
    }
  })
})
