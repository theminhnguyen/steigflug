import { describe, expect, it } from 'vitest'
import { alsJson, leereDaten, neueId, normalisiere } from './store'

describe('normalisiere', () => {
  it('macht aus Unsinn saubere Leerdaten', () => {
    expect(normalisiere(null, 2027).zieljahr).toBe(2027)
    expect(normalisiere('kaputt', 2027).fluege).toEqual([])
    expect(normalisiere(42, 2027).boden).toEqual([])
  })

  it('ergänzt fehlende Felder eines Fluges', () => {
    const d = normalisiere({ fluege: [{ von: 'fra', nach: 'muc' }] }, 2027)
    const f = d.fluege[0]!
    expect(f.von).toBe('FRA')
    expect(f.nach).toBe('MUC')
    expect(f.airline).toBe('LH')
    expect(f.klasse).toBe('economy')
    expect(f.korrekturPoints).toBeNull()
    expect(f.id).toBeTruthy()
  })

  it('behält eine Korrektur von null Punkten bei', () => {
    const d = normalisiere({ fluege: [{ korrekturPoints: 0, korrekturQp: 0 }] }, 2027)
    expect(d.fluege[0]!.korrekturPoints).toBe(0)
  })

  it('weist unplausible Zieljahre zurück', () => {
    expect(normalisiere({ zieljahr: 12 }, 2027).zieljahr).toBe(2027)
    expect(normalisiere({ zieljahr: '2030' }, 2027).zieljahr).toBe(2030)
  })

  it('rettet Boden-Einträge mit fehlenden Zahlen', () => {
    const d = normalisiere({ boden: [{ quelle: 'marriott', anzahl: 'x' }] }, 2027)
    expect(d.boden[0]!.anzahl).toBe(0)
  })
})

describe('neueId', () => {
  it('erzeugt eindeutige IDs', () => {
    const ids = new Set(Array.from({ length: 500 }, neueId))
    expect(ids.size).toBe(500)
  })
})

describe('Export', () => {
  it('erzeugt gültiges JSON mit Zeitstempel', () => {
    const json = alsJson(leereDaten(2027))
    const zurueck = JSON.parse(json)
    expect(zurueck.zieljahr).toBe(2027)
    expect(zurueck.exportiertAm).toBeTruthy()
  })

  it('lässt sich verlustfrei wieder einlesen', () => {
    const d = leereDaten(2027)
    expect(normalisiere(JSON.parse(alsJson(d)), 2027).zieljahr).toBe(2027)
  })
})
