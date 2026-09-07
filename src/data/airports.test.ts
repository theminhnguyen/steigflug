import { describe, expect, it } from 'vitest'
import { AIRPORTS, airportLabel, schaetzeStrecke, sucheAirports } from './airports'

describe('Flughafenliste', () => {
  it('liest jeden Eintrag vollständig ein', () => {
    expect(Object.keys(AIRPORTS).length).toBeGreaterThan(240)
  })

  it('behält Namen mit Leerzeichen — das war der Fehler beim Trennen an Leerzeichen', () => {
    expect(AIRPORTS.JFK?.name).toBe('New York JFK')
    expect(AIRPORTS.CDG?.name).toBe('Paris Charles de Gaulle')
    expect(AIRPORTS.LHR?.name).toBe('London Heathrow')
    expect(AIRPORTS.LAS?.name).toBe('Las Vegas')
    expect(AIRPORTS.SSH?.name).toBe('Sharm el-Sheikh')
  })

  it('hat durchgehend saubere Codes', () => {
    for (const [schluessel, f] of Object.entries(AIRPORTS)) {
      expect(schluessel).toBe(f.iata)
      expect(f.iata).toMatch(/^[A-Z]{3}$/)
      expect(f.land).toMatch(/^[A-Z]{2}$/)
      expect(f.name.length).toBeGreaterThan(2)
      expect(f.name).not.toContain('|')
    }
  })
})

describe('schaetzeStrecke', () => {
  it('erkennt innerdeutsch als Kurzstrecke', () => {
    expect(schaetzeStrecke('FRA', 'MUC')).toEqual({
      strecke: 'kontinental',
      sicher: true,
      grenzfall: false,
    })
  })

  it('erkennt Europa untereinander als Kurzstrecke', () => {
    expect(schaetzeStrecke('MUC', 'LIS').strecke).toBe('kontinental')
    expect(schaetzeStrecke('BER', 'ATH').strecke).toBe('kontinental')
  })

  it('erkennt Interkontinental in beide Richtungen', () => {
    expect(schaetzeStrecke('FRA', 'JFK').strecke).toBe('interkontinental')
    expect(schaetzeStrecke('JFK', 'FRA').strecke).toBe('interkontinental')
    expect(schaetzeStrecke('MUC', 'SIN').strecke).toBe('interkontinental')
    expect(schaetzeStrecke('FRA', 'DXB').strecke).toBe('interkontinental')
  })

  it('markiert Mittelmeer-Randlagen als Grenzfall', () => {
    const ist = schaetzeStrecke('FRA', 'IST')
    expect(ist.strecke).toBe('kontinental')
    expect(ist.grenzfall).toBe(true)

    const tlv = schaetzeStrecke('MUC', 'TLV')
    expect(tlv.grenzfall).toBe(true)
  })

  it('ist kleinschreibungstolerant', () => {
    expect(schaetzeStrecke('fra', 'jfk').strecke).toBe('interkontinental')
  })

  it('meldet unsicher bei unbekanntem Code — an beiden Enden', () => {
    expect(schaetzeStrecke('FRA', 'XXX').sicher).toBe(false)
    expect(schaetzeStrecke('XXX', 'FRA').sicher).toBe(false)
    expect(schaetzeStrecke('XXX', 'YYY').sicher).toBe(false)
    expect(schaetzeStrecke('', 'FRA').sicher).toBe(false)
    expect(schaetzeStrecke('FRA', '').sicher).toBe(false)
    expect(schaetzeStrecke('', '').sicher).toBe(false)
  })

  it('markiert den Grenzfall unabhängig von der Flugrichtung', () => {
    expect(schaetzeStrecke('FRA', 'IST').grenzfall).toBe(true)
    expect(schaetzeStrecke('IST', 'FRA').grenzfall).toBe(true)
  })

  it('behandelt zwei Randlagen untereinander als Kurzstrecke', () => {
    expect(schaetzeStrecke('IST', 'TLV').strecke).toBe('kontinental')
  })

  it('setzt keinen Grenzfall, wenn beide Flughäfen in Kerneuropa liegen', () => {
    expect(schaetzeStrecke('FRA', 'MAD').grenzfall).toBe(false)
  })
})

describe('sucheAirports', () => {
  it('findet über den Code', () => {
    expect(sucheAirports('FR').some((a) => a.iata === 'FRA')).toBe(true)
  })

  it('findet über den Namen', () => {
    expect(sucheAirports('new york').some((a) => a.iata === 'JFK')).toBe(true)
  })

  it('liefert bei leerer Eingabe nichts', () => {
    expect(sucheAirports('  ')).toEqual([])
  })
})

describe('airportLabel', () => {
  it('zeigt Code und Name', () => {
    expect(airportLabel('JFK')).toBe('JFK · New York JFK')
  })

  it('fällt bei Unbekanntem auf den Code zurück', () => {
    expect(airportLabel('xyz')).toBe('XYZ')
  })
})
