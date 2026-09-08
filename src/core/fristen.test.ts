import { describe, expect, it } from 'vitest'
import { jahresfrist, naeheresJahr, offeneTermine } from './fristen'

const L = (points: number, qp: number) => ({
  points, qp, erreicht: points === 0 && qp === 0,
})

describe('jahresfrist', () => {
  it('zählt die verbleibenden Tage im laufenden Jahr', () => {
    const f = jahresfrist(2026, '2026-09-08')
    expect(f.tageUebrig).toBe(115)
    expect(f.nochNichtBegonnen).toBe(false)
    expect(f.abgelaufen).toBe(false)
  })

  it('erkennt ein Jahr, das noch nicht begonnen hat', () => {
    const f = jahresfrist(2027, '2026-09-08')
    expect(f.nochNichtBegonnen).toBe(true)
    expect(f.tageUebrig).toBe(365)
    expect(f.verbraucht).toBe(0)
  })

  it('erkennt ein abgelaufenes Jahr', () => {
    const f = jahresfrist(2025, '2026-09-08')
    expect(f.abgelaufen).toBe(true)
    expect(f.tageUebrig).toBe(0)
    expect(f.verbraucht).toBe(1)
  })

  it('rechnet an beiden Rändern des Jahres richtig', () => {
    expect(jahresfrist(2026, '2026-01-01').tageUebrig).toBe(365)
    expect(jahresfrist(2026, '2026-12-31').tageUebrig).toBe(1)
  })

  it('stürzt bei kaputtem Datum nicht ab', () => {
    const f = jahresfrist(2026, 'unsinn')
    expect(Number.isFinite(f.tageUebrig)).toBe(true)
  })
})

describe('offeneTermine', () => {
  const termine = [
    { id: 'a', titel: 'A', datum: '2026-12-31', hinweis: '' },
    { id: 'b', titel: 'B', datum: '2026-09-30', hinweis: '' },
    { id: 'c', titel: 'C', datum: '2025-01-01', hinweis: '' },
  ]

  it('zeigt nur Bevorstehendes, das Nächste zuerst', () => {
    expect(offeneTermine(termine, '2026-09-08').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('markiert, was innerhalb von sechs Wochen fällig ist', () => {
    const o = offeneTermine(termine, '2026-09-08')
    expect(o[0]!.draengt).toBe(true)
    expect(o[1]!.draengt).toBe(false)
  })

  it('zählt die Tage bis zum Termin', () => {
    expect(offeneTermine(termine, '2026-09-08')[0]!.tageUebrig).toBe(22)
  })

  it('zeigt einen heute fälligen Termin noch an', () => {
    const o = offeneTermine([{ id: 'x', titel: 'X', datum: '2026-09-08', hinweis: '' }], '2026-09-08')
    expect(o).toHaveLength(1)
    expect(o[0]!.tageUebrig).toBe(0)
  })

  it('übergeht kaputte Datumsangaben, statt zu stolpern', () => {
    const o = offeneTermine([{ id: 'y', titel: 'Y', datum: 'kaputt', hinweis: '' }], '2026-09-08')
    expect(o).toHaveLength(0)
  })
})

describe('naeheresJahr', () => {
  const staende = [
    { jahr: 2026, luecke: L(290, 0) },
    { jahr: 2027, luecke: L(450, 205) },
    { jahr: 2025, luecke: L(10, 0) },
  ]

  it('weist auf ein Jahr hin, in dem das Ziel näher liegt', () => {
    expect(naeheresJahr(staende, 2027, '2026-09-08')?.jahr).toBe(2026)
  })

  it('lässt vergangene Jahre außen vor — dort geht nichts mehr', () => {
    expect(naeheresJahr(staende, 2026, '2026-09-08')).toBeNull()
  })

  it('schweigt, wenn das gewählte Jahr schon das beste ist', () => {
    expect(naeheresJahr([{ jahr: 2026, luecke: L(10, 0) }, { jahr: 2027, luecke: L(400, 100) }], 2026, '2026-09-08')).toBeNull()
  })

  it('schweigt, wenn das Ziel im gewählten Jahr bereits steht', () => {
    expect(naeheresJahr([{ jahr: 2027, luecke: L(0, 0) }, { jahr: 2026, luecke: L(5, 0) }], 2027, '2026-09-08')).toBeNull()
  })

  it('nimmt das nächstgelegene, wenn mehrere besser sind', () => {
    const s = [
      { jahr: 2027, luecke: L(500, 200) },
      { jahr: 2026, luecke: L(290, 0) },
      { jahr: 2028, luecke: L(100, 50) },
    ]
    expect(naeheresJahr(s, 2027, '2026-09-08')?.jahr).toBe(2028)
  })
})
