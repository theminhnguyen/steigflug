import { describe, expect, it } from 'vitest'
import { bodenZuZeile, flugZuZeile, zeileZuBoden, zeileZuFlug } from './sync'
import type { BodenEintrag, Flug } from '../core/types'

/**
 * Diese Namen stammen aus der echten Datenbank (information_schema).
 * Sie stehen hier fest, damit ein Tippfehler oder eine Umbenennung als
 * Testfehler auffällt — nicht als Abgleich, der stillschweigend nichts tut.
 */
const SPALTEN_FLUEGE = [
  'user_id', 'id', 'datum', 'von', 'nach', 'airline', 'klasse', 'strecke',
  'strecke_manuell', 'geplant', 'korrektur_points', 'korrektur_qp', 'notiz',
  'geloescht', 'geaendert_am',
]
const SPALTEN_BODEN = [
  'user_id', 'id', 'datum', 'quelle', 'anzahl', 'freie_qp', 'geplant', 'notiz',
  'geloescht', 'geaendert_am', 'korrektur_points', 'korrektur_qp', 'herkunft',
]

const FLUG: Flug = {
  id: 'f1', datum: '2027-02-15', von: 'DUS', nach: 'MUC', airline: 'LH',
  klasse: 'economy', strecke: 'kontinental', streckeManuell: true, geplant: true,
  korrekturPoints: 17, korrekturQp: 5, notiz: 'Notiz mit Ümläuten · und Punkt',
  geaendertAm: '2027-01-01T10:00:00Z', dirty: true, geloescht: false,
}

const BODEN: BodenEintrag = {
  id: 'b1', datum: '2027-03-01', quelle: 'marriott', anzahl: 2, freieQp: 3,
  geplant: false, notiz: 'Moxy', korrekturPoints: 20, korrekturQp: null,
  herkunft: 'kontoauszug|probe', geaendertAm: '2027-01-01T10:00:00Z',
  dirty: true, geloescht: true,
}

describe('Spaltennamen', () => {
  it('schreibt Flüge nur in Spalten, die es wirklich gibt', () => {
    for (const spalte of Object.keys(flugZuZeile(FLUG, 'u1'))) {
      expect(SPALTEN_FLUEGE).toContain(spalte)
    }
  })

  it('schreibt Boden-Einträge nur in Spalten, die es wirklich gibt', () => {
    for (const spalte of Object.keys(bodenZuZeile(BODEN, 'u1'))) {
      expect(SPALTEN_BODEN).toContain(spalte)
    }
  })

  it('lässt geaendert_am beim Schreiben aus — das setzt der Server', () => {
    expect(Object.keys(flugZuZeile(FLUG, 'u1'))).not.toContain('geaendert_am')
    expect(Object.keys(bodenZuZeile(BODEN, 'u1'))).not.toContain('geaendert_am')
  })

  it('schreibt jedes inhaltliche Feld eines Fluges mit', () => {
    const zeile = flugZuZeile(FLUG, 'u1')
    for (const spalte of SPALTEN_FLUEGE) {
      if (spalte === 'geaendert_am') continue
      expect(Object.keys(zeile)).toContain(spalte)
    }
  })

  it('schreibt jedes inhaltliche Feld eines Boden-Eintrags mit', () => {
    const zeile = bodenZuZeile(BODEN, 'u1')
    for (const spalte of SPALTEN_BODEN) {
      if (spalte === 'geaendert_am') continue
      expect(Object.keys(zeile)).toContain(spalte)
    }
  })
})

describe('Hin und zurück', () => {
  it('übersteht ein Flug den Weg in die Datenbank und zurück unverändert', () => {
    const zeile = { ...flugZuZeile(FLUG, 'u1'), geaendert_am: '2027-05-05T08:00:00Z' }
    const zurueck = zeileZuFlug(zeile)
    expect(zurueck).toEqual({
      ...FLUG,
      geaendertAm: '2027-05-05T08:00:00Z',
      dirty: false, // frisch vom Server, also nichts Offenes
    })
  })

  it('übersteht ein Boden-Eintrag den Weg unverändert', () => {
    const zeile = { ...bodenZuZeile(BODEN, 'u1'), geaendert_am: '2027-05-05T08:00:00Z' }
    expect(zeileZuBoden(zeile)).toEqual({
      ...BODEN,
      geaendertAm: '2027-05-05T08:00:00Z',
      dirty: false,
    })
  })

  it('behält eine Korrektur von null und unterscheidet sie von "keine Korrektur"', () => {
    const mitNull = zeileZuFlug({ ...flugZuZeile({ ...FLUG, korrekturPoints: 0, korrekturQp: 0 }, 'u1') })
    expect(mitNull.korrekturPoints).toBe(0)
    const ohne = zeileZuFlug({ ...flugZuZeile({ ...FLUG, korrekturPoints: null, korrekturQp: null }, 'u1') })
    expect(ohne.korrekturPoints).toBeNull()
  })

  it('kommt mit einer unvollständigen Zeile klar, ohne NaN zu erzeugen', () => {
    const f = zeileZuFlug({ id: 'x' })
    expect(f.klasse).toBe('economy')
    expect(f.korrekturPoints).toBeNull()
    const b = zeileZuBoden({ id: 'y' })
    expect(b.anzahl).toBe(0)
    expect(Number.isNaN(b.anzahl)).toBe(false)
  })
})
