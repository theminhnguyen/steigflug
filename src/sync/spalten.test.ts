import { describe, expect, it } from 'vitest'
import {
  bodenZuZeile,
  flugZuZeile,
  karteZuZeile,
  kollektionZuZeile,
  zeileZuBoden,
  zeileZuFlug,
  zeileZuKarte,
  zeileZuKollektion,
} from './sync'
import type { BodenEintrag, Flug, UptripKarte, UptripKollektion } from '../core/types'

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

const SPALTEN_KARTEN = [
  'user_id', 'id', 'name', 'art', 'original', 'datum', 'flug', 'kollektion',
  'geloescht', 'geaendert_am',
]
const SPALTEN_KOLLEKTIONEN = [
  'user_id', 'id', 'name', 'belohnung', 'benoetigt', 'mindest_originale', 'points',
  'qp', 'bringt_status', 'eingeloest', 'geloescht', 'geaendert_am',
]

const KARTE: UptripKarte = {
  id: 'k1', name: 'Düsseldorf', art: 'stadt', original: true, datum: '2026-08-14',
  flug: 'LH 2016 · MUC → DUS', kollektion: 'ftl', geaendertAm: '2026-09-01T10:00:00Z',
  dirty: true, geloescht: false,
}

const KOLLEKTION: UptripKollektion = {
  id: 'ftl', name: 'Frequent Traveller', belohnung: 'FTL-Status', benoetigt: 50,
  mindestOriginale: 40, points: 0, qp: 0, bringtStatus: true, eingeloest: false,
  geaendertAm: '2026-09-01T10:00:00Z', dirty: true, geloescht: false,
}

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

describe('Uptrip-Album in der Datenbank', () => {
  const faelle = [
    ['Karten', karteZuZeile(KARTE, 'u1'), SPALTEN_KARTEN],
    ['Kollektionen', kollektionZuZeile(KOLLEKTION, 'u1'), SPALTEN_KOLLEKTIONEN],
  ] as const

  for (const [name, zeile, spalten] of faelle) {
    it(`schreibt ${name} nur in Spalten, die es wirklich gibt — und jede davon`, () => {
      expect([...Object.keys(zeile)].sort()).toEqual(
        spalten.filter((s) => s !== 'geaendert_am').sort(),
      )
    })
  }

  it('übersteht eine Karte den Weg in die Datenbank und zurück unverändert', () => {
    const zeile = { ...karteZuZeile(KARTE, 'u1'), geaendert_am: '2026-09-11T08:00:00Z' }
    expect(zeileZuKarte(zeile)).toEqual({ ...KARTE, geaendertAm: '2026-09-11T08:00:00Z', dirty: false })
  })

  it('übersteht eine Kollektion den Weg unverändert', () => {
    const zeile = { ...kollektionZuZeile(KOLLEKTION, 'u1'), geaendert_am: '2026-09-11T08:00:00Z' }
    expect(zeileZuKollektion(zeile)).toEqual({
      ...KOLLEKTION,
      geaendertAm: '2026-09-11T08:00:00Z',
      dirty: false,
    })
  })

  it('kommt mit unvollständigen Zeilen klar', () => {
    expect(zeileZuKarte({ id: 'x' })).toMatchObject({ art: 'spezial', original: false, kollektion: '' })
    const k = zeileZuKollektion({ id: 'y', benoetigt: 'kaputt' })
    expect(k.benoetigt).toBe(0)
    expect(Number.isNaN(k.mindestOriginale)).toBe(false)
  })
})
