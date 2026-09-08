import { describe, expect, it } from 'vitest'
import {
  istMilesAndMoreDatei,
  kennzeichen,
  leseSegmente,
  pruefeGupDeutung,
  verschmelze,
} from './milesandmore'

/** Nach dem Schema des Endpunkts, inklusive der aufgefüllten Textfelder. */
const SEGMENT = {
  DepartureDate: '2026-05-14',
  ArrivalDate: '2026-05-14',
  OriginAirportCode: 'DUS  ',
  DestinationAirportCode: 'MUC  ',
  AirlineDesignatorCode: 'LH ',
  FlightNumber: 2017,
  CompartmentClass: 'M',
  AircraftCode: '320  ',
  PnrrecordLocator: 'ABCDEF',
  StatusMiles: 0,
  StatusPoints: 20,
  GupPoints: 20,
  HonPoints: 0,
  AwardMiles: 1250,
}

const datei = (segmente: unknown[]) => ({ SegmentListResponses: segmente })

describe('istMilesAndMoreDatei', () => {
  it('erkennt die Antwort des Endpunkts', () => {
    expect(istMilesAndMoreDatei(datei([SEGMENT]))).toBe(true)
  })

  it('erkennt auch eine blanke Liste', () => {
    expect(istMilesAndMoreDatei([SEGMENT])).toBe(true)
  })

  it('weist Fremdes ab', () => {
    expect(istMilesAndMoreDatei({ fluege: [] })).toBe(false)
    expect(istMilesAndMoreDatei(null)).toBe(false)
    expect(istMilesAndMoreDatei('text')).toBe(false)
  })
})

describe('leseSegmente', () => {
  it('liest ein Segment vollständig ein', () => {
    const { fluege, uebersprungen } = leseSegmente(datei([SEGMENT]))
    expect(uebersprungen).toBe(0)
    const f = fluege[0]!.flug
    expect(f.datum).toBe('2026-05-14')
    expect(f.von).toBe('DUS')
    expect(f.nach).toBe('MUC')
    expect(f.airline).toBe('LH')
    expect(f.klasse).toBe('economy')
    expect(f.strecke).toBe('kontinental')
    expect(f.geplant).toBe(false)
  })

  it('schneidet die aufgefüllten Leerzeichen weg', () => {
    const { fluege } = leseSegmente(datei([SEGMENT]))
    expect(fluege[0]!.flug.von).toBe('DUS')
    expect(fluege[0]!.flug.airline).toBe('LH')
  })

  it('übernimmt die tatsächlich gutgeschriebenen Punkte als Korrektur', () => {
    const { fluege } = leseSegmente(datei([{ ...SEGMENT, StatusPoints: 17, GupPoints: 5 }]))
    expect(fluege[0]!.flug.korrekturPoints).toBe(17)
    expect(fluege[0]!.flug.korrekturQp).toBe(5)
  })

  it('lässt die Korrektur weg, wenn GupPoints nicht als QP gedeutet werden soll', () => {
    const { fluege } = leseSegmente(datei([SEGMENT]), false)
    expect(fluege[0]!.flug.korrekturQp).toBeNull()
    expect(fluege[0]!.flug.korrekturPoints).toBe(20)
  })

  it('meldet, welche Punktefelder überhaupt belegt waren', () => {
    const { belegteFelder } = leseSegmente(datei([SEGMENT]))
    expect(belegteFelder).toEqual(['awardMiles', 'gupPoints', 'statusPoints'])
  })

  it('erkennt die Langstrecke aus den Flughäfen', () => {
    const { fluege } = leseSegmente(
      datei([{ ...SEGMENT, OriginAirportCode: 'FRA', DestinationAirportCode: 'JFK' }]),
    )
    expect(fluege[0]!.flug.strecke).toBe('interkontinental')
  })

  it('ordnet Buchungsklassen der Reiseklasse zu', () => {
    const klassen = ['F', 'C', 'W', 'Y'].map(
      (c) => leseSegmente(datei([{ ...SEGMENT, CompartmentClass: c }])).fluege[0]!.flug.klasse,
    )
    expect(klassen).toEqual(['first', 'business', 'premium', 'economy'])
  })

  it('fällt bei unbekannter Buchungsklasse auf Economy zurück', () => {
    const { fluege } = leseSegmente(datei([{ ...SEGMENT, CompartmentClass: '§' }]))
    expect(fluege[0]!.flug.klasse).toBe('economy')
  })

  it('schreibt Flugnummer und Buchung in die Notiz', () => {
    const { fluege } = leseSegmente(datei([SEGMENT]))
    expect(fluege[0]!.flug.notiz).toBe('LH2017 · Buchung ABCDEF · aus Miles & More')
  })

  it('überspringt unbrauchbare Zeilen, statt den Import zu kippen', () => {
    const { fluege, uebersprungen } = leseSegmente(
      datei([
        SEGMENT,
        { ...SEGMENT, DepartureDate: 'kaputt' },
        { ...SEGMENT, OriginAirportCode: '' },
        null,
        'text',
        { ...SEGMENT, AirlineDesignatorCode: '   ' },
      ]),
    )
    expect(fluege).toHaveLength(1)
    expect(uebersprungen).toBe(5)
  })

  it('kommt mit fehlenden Punktefeldern klar, ohne NaN zu erzeugen', () => {
    const { fluege } = leseSegmente(datei([{
      DepartureDate: '2026-05-14', OriginAirportCode: 'DUS',
      DestinationAirportCode: 'MUC', AirlineDesignatorCode: 'LH',
    }]))
    expect(fluege[0]!.flug.korrekturPoints).toBeNull()
    expect(fluege[0]!.flug.korrekturQp).toBeNull()
    expect(fluege[0]!.flug.notiz).toBe('LH · aus Miles & More')
  })

  it('vergibt für jedes Segment eine eigene Kennung', () => {
    const { fluege } = leseSegmente(datei([SEGMENT, SEGMENT, SEGMENT]))
    expect(new Set(fluege.map((f) => f.flug.id)).size).toBe(3)
  })

  it('setzt die Strecke bei unbekanntem Flughafen als selbst gesetzt', () => {
    const { fluege } = leseSegmente(datei([{ ...SEGMENT, DestinationAirportCode: 'ZZZ' }]))
    expect(fluege[0]!.flug.streckeManuell).toBe(true)
  })

  it('liefert bei leerer Liste ein leeres Ergebnis', () => {
    expect(leseSegmente(datei([])).fluege).toHaveLength(0)
  })
})

describe('verschmelze', () => {
  const gelesen = (over: Record<string, unknown> = {}) =>
    leseSegmente(datei([{ ...SEGMENT, ...over }])).fluege

  const bestandsflug = (over: Partial<import('../core/types').Flug> = {}) => ({
    id: 'vorhanden', datum: '2026-05-14', von: 'DUS', nach: 'MUC', airline: 'LH',
    klasse: 'economy' as const, strecke: 'kontinental' as const, streckeManuell: false,
    geplant: false, korrekturPoints: null, korrekturQp: null, notiz: 'von Hand',
    geaendertAm: '', dirty: false, geloescht: false, ...over,
  })

  it('legt einen unbekannten Flug neu an', () => {
    const e = verschmelze([], gelesen())
    expect(e.neu).toHaveLength(1)
    expect(e.aktualisiert).toHaveLength(0)
  })

  it('legt einen bereits vorhandenen Flug nicht noch einmal an', () => {
    const e = verschmelze([bestandsflug()], gelesen())
    expect(e.neu).toHaveLength(0)
  })

  it('ist beim zweiten Durchlauf still — nichts verdoppelt sich', () => {
    const erst = verschmelze([], gelesen())
    const zweit = verschmelze(erst.neu, gelesen())
    expect(zweit.neu).toHaveLength(0)
    expect(zweit.unveraendert).toBe(1)
  })

  it('trägt die tatsächliche Gutschrift bei einem Handeintrag nach', () => {
    const e = verschmelze([bestandsflug()], gelesen({ StatusPoints: 17 }))
    expect(e.aktualisiert[0]!.korrekturPoints).toBe(17)
    expect(e.aktualisiert[0]!.notiz).toBe('von Hand')
    expect(e.aktualisiert[0]!.dirty).toBe(true)
  })

  it('überschreibt einen vorhandenen Punktewert nicht, ergänzt aber die fehlenden QP', () => {
    const e = verschmelze([bestandsflug({ korrekturPoints: 99 })], gelesen({ StatusPoints: 17 }))
    expect(e.aktualisiert[0]!.korrekturPoints).toBe(99)
    expect(e.aktualisiert[0]!.korrekturQp).toBe(20)
  })

  it('lässt einen rundum vollständigen Eintrag völlig unangetastet', () => {
    const e = verschmelze(
      [bestandsflug({ korrekturPoints: 99, korrekturQp: 88 })],
      gelesen({ StatusPoints: 17 }),
    )
    expect(e.aktualisiert).toHaveLength(0)
    expect(e.neu).toHaveLength(0)
    expect(e.unveraendert).toBe(1)
  })

  it('bildet dasselbe Kennzeichen unabhängig von der Schreibweise', () => {
    expect(kennzeichen({ datum: '2026-05-14', von: 'dus', nach: 'muc', airline: 'lh' })).toBe(
      kennzeichen({ datum: '2026-05-14', von: 'DUS', nach: 'MUC', airline: 'LH' }),
    )
  })

  it('macht aus einem geplanten Flug einen geflogenen', () => {
    const e = verschmelze([bestandsflug({ geplant: true })], gelesen())
    expect(e.aktualisiert[0]!.geplant).toBe(false)
  })

  it('ignoriert gelöschte Einträge im Bestand und legt neu an', () => {
    const e = verschmelze([bestandsflug({ geloescht: true })], gelesen())
    expect(e.neu).toHaveLength(1)
  })

  it('fasst Dubletten innerhalb der Datei zusammen', () => {
    const doppelt = leseSegmente(datei([SEGMENT, SEGMENT])).fluege
    expect(verschmelze([], doppelt).neu).toHaveLength(1)
  })

  it('unterscheidet dieselbe Strecke an verschiedenen Tagen', () => {
    const e = verschmelze(
      [bestandsflug()],
      leseSegmente(datei([{ ...SEGMENT, DepartureDate: '2026-05-15' }])).fluege,
    )
    expect(e.neu).toHaveLength(1)
  })

  it('unterscheidet Hin- und Rückflug am selben Tag', () => {
    const rueck = leseSegmente(
      datei([{ ...SEGMENT, OriginAirportCode: 'MUC', DestinationAirportCode: 'DUS' }]),
    ).fluege
    expect(verschmelze([bestandsflug()], rueck).neu).toHaveLength(1)
  })
})

describe('pruefeGupDeutung', () => {
  const QUAL = ['LH', 'OS', 'EW', 'LX', 'VL']
  const mit = (over: Record<string, unknown>) => leseSegmente(datei([{ ...SEGMENT, ...over }])).fluege

  it('bleibt offen, solange nur vollintegrierte Airlines vorkommen', () => {
    // Genau der Fall der echten Kontodaten: 28 Zeilen, alle vollintegriert.
    expect(pruefeGupDeutung(mit({}), QUAL).art).toBe('offen')
  })

  it('bestätigt die Deutung bei einer Airline ohne Qualifying Points', () => {
    const b = pruefeGupDeutung(mit({ AirlineDesignatorCode: 'UA', StatusPoints: 20, GupPoints: 0 }), QUAL)
    expect(b.art).toBe('bestaetigt')
    if (b.art === 'bestaetigt') expect(b.beleg).toContain('UA')
  })

  it('widerlegt sie, wenn dort trotzdem GupPoints stehen', () => {
    const b = pruefeGupDeutung(mit({ AirlineDesignatorCode: 'UA', StatusPoints: 20, GupPoints: 20 }), QUAL)
    expect(b.art).toBe('widerlegt')
  })

  it('lässt Flüge ohne Punkte außen vor — die beweisen nichts', () => {
    expect(pruefeGupDeutung(mit({ AirlineDesignatorCode: 'UA', StatusPoints: 0, GupPoints: 0 }), QUAL).art)
      .toBe('offen')
  })

  it('achtet nicht auf Groß- und Kleinschreibung der Airline-Liste', () => {
    expect(pruefeGupDeutung(mit({}), ['lh']).art).toBe('offen')
  })
})
