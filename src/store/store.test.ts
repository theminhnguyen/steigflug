import { describe, expect, it } from 'vitest'
import {
  alsJson,
  hatEintraege,
  istSicherung,
  leereDaten,
  neueId,
  normalisiere,
  ohneGueltigesDatum,
} from './store'

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

describe('istSicherung', () => {
  it('erkennt eine echte Sicherung', () => {
    expect(istSicherung({ schema: 1, fluege: [], boden: [] })).toBe(true)
    expect(istSicherung({ fluege: [{ von: 'FRA' }] })).toBe(true)
  })

  it('weist fremde Dateien ab, statt sie zu Leerdaten zu glätten', () => {
    expect(istSicherung({ foo: 1 })).toBe(false)
    expect(istSicherung([1, 2, 3])).toBe(false)
    expect(istSicherung('text')).toBe(false)
    expect(istSicherung(null)).toBe(false)
    expect(istSicherung({ fluege: 'keine Liste' })).toBe(false)
  })
})

describe('hatEintraege', () => {
  it('erkennt leere und gefüllte Bestände', () => {
    const leer = leereDaten(2027)
    expect(hatEintraege(leer)).toBe(false)
    expect(hatEintraege({ ...leer, fluege: [{} as never] })).toBe(true)
    expect(hatEintraege({ ...leer, boden: [{} as never] })).toBe(true)
  })
})

describe('normalisiere begrenzt unplausible Werte', () => {
  it('lässt keine negativen Korrekturen durch', () => {
    const d = normalisiere({ fluege: [{ korrekturPoints: -50, korrekturQp: -5 }] }, 2027)
    expect(d.fluege[0]!.korrekturPoints).toBe(0)
    expect(d.fluege[0]!.korrekturQp).toBe(0)
  })

  it('lässt keine negativen Mengen durch', () => {
    const d = normalisiere({ boden: [{ anzahl: -3, freieQp: -1 }] }, 2027)
    expect(d.boden[0]!.anzahl).toBe(0)
    expect(d.boden[0]!.freieQp).toBe(0)
  })

  it('verwirft NaN und Unendlich in Korrekturen', () => {
    const d = normalisiere({ fluege: [{ korrekturPoints: Number.POSITIVE_INFINITY }] }, 2027)
    expect(d.fluege[0]!.korrekturPoints).toBeNull()
  })
})

describe('ohneGueltigesDatum', () => {
  it('findet Einträge, die in keiner Jahresansicht auftauchen', () => {
    const d = normalisiere(
      {
        fluege: [{ datum: '2027-05-01' }, { datum: '' }, { datum: 'irgendwas' }],
        boden: [{ datum: '2027-05-01' }, { datum: '2027-13' }],
      },
      2027,
    )
    expect(ohneGueltigesDatum(d)).toBe(3)
  })

  it('meldet null, wenn alle Daten sauber sind', () => {
    expect(ohneGueltigesDatum(leereDaten(2027))).toBe(0)
  })
})
