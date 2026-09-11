import { describe, expect, it } from 'vitest'
import {
  alsKartenArt,
  kartenUebersicht,
  kartenVorschlaege,
  kollektionsStand,
  uptripWeg,
  uptripWegSatz,
} from './uptrip'
import type { Flug, UptripKarte, UptripKollektion } from './types'

let nummer = 0

function karte(o: Partial<UptripKarte> = {}): UptripKarte {
  nummer += 1
  return {
    id: `k${nummer}`, name: 'Munich', art: 'stadt', original: true, datum: '2026-08-28',
    flug: '', kollektion: 'ftl', geaendertAm: '', dirty: false, geloescht: false, ...o,
  }
}

const viele = (anzahl: number, o: Partial<UptripKarte> = {}) =>
  Array.from({ length: anzahl }, () => karte(o))

function kollektion(o: Partial<UptripKollektion> = {}): UptripKollektion {
  return {
    id: 'ftl', name: 'Frequent Traveller', belohnung: 'FTL-Status', benoetigt: 50,
    mindestOriginale: 40, points: 0, qp: 0, bringtStatus: true, eingeloest: false,
    geaendertAm: '', dirty: false, geloescht: false, ...o,
  }
}

function flug(o: Partial<Flug> = {}): Flug {
  nummer += 1
  return {
    id: `f${nummer}`, datum: '2026-08-28', von: 'MUC', nach: 'DUS', airline: 'VL',
    klasse: 'economy', strecke: 'kontinental', streckeManuell: false, geplant: false,
    korrekturPoints: null, korrekturQp: null, notiz: '', geaendertAm: '', dirty: false,
    geloescht: false, ...o,
  }
}

describe('kollektionsStand', () => {
  it('rechnet wie die App: 4 Originale und 6 weitere ergeben 10 von 50', () => {
    const s = kollektionsStand(kollektion(), [...viele(4), ...viele(6, { original: false })])
    expect(s.angerechnet).toBe(10)
    expect(s.fehlendeOriginale).toBe(36)
    expect(s.fehlend).toBe(40)
    expect(s.fehlendeBeliebige).toBe(4)
    expect(s.vollstaendig).toBe(false)
  })

  it('rechnet weitere Karten nur auf die Plätze ohne Original-Pflicht an', () => {
    const s = kollektionsStand(kollektion(), [...viele(4), ...viele(15, { original: false })])
    expect(s.angerechnet).toBe(14)
    expect(s.ueberzaehlig).toBe(5)
    expect(s.fehlendeBeliebige).toBe(0)
  })

  it('lässt Originale auch die freien Plätze füllen', () => {
    const s = kollektionsStand(kollektion(), viele(45))
    expect(s.angerechnet).toBe(45)
    expect(s.fehlendeOriginale).toBe(0)
    expect(s.fehlendeBeliebige).toBe(5)
  })

  it('ist genau an der Grenze vollständig', () => {
    const s = kollektionsStand(kollektion(), [...viele(40), ...viele(10, { original: false })])
    expect(s.vollstaendig).toBe(true)
    expect(s.fehlend).toBe(0)
  })

  it('ist ein Original darunter nicht vollständig, auch mit 50 Karten', () => {
    const s = kollektionsStand(kollektion(), [...viele(39), ...viele(11, { original: false })])
    expect(s.angerechnet).toBe(49)
    expect(s.fehlendeOriginale).toBe(1)
    expect(s.vollstaendig).toBe(false)
  })

  it('zählt nur lebende Karten dieser Kollektion', () => {
    const s = kollektionsStand(kollektion(), [
      karte(),
      karte({ geloescht: true }),
      karte({ kollektion: 'andere' }),
    ])
    expect(s.karten).toHaveLength(1)
    expect(s.angerechnet).toBe(1)
  })

  it('zählt bei Kollektionen ohne Original-Pflicht jede Karte', () => {
    const s = kollektionsStand(
      kollektion({ id: 'rft', benoetigt: 8, mindestOriginale: 0, bringtStatus: false }),
      viele(8, { kollektion: 'rft', original: false }),
    )
    expect(s.vollstaendig).toBe(true)
  })

  it('hält eine Kollektion ohne Kartenzahl nicht für vollständig', () => {
    expect(kollektionsStand(kollektion({ benoetigt: 0 }), []).vollstaendig).toBe(false)
  })

  it('verträgt eine Mindestzahl über der Kartenzahl', () => {
    const s = kollektionsStand(kollektion({ mindestOriginale: 60 }), viele(50))
    expect(s.vollstaendig).toBe(true)
    expect(s.fehlendeOriginale).toBe(0)
  })
})

describe('kartenUebersicht', () => {
  it('zählt Karten, Originale und weitere', () => {
    const u = kartenUebersicht([...viele(4), ...viele(6, { original: false })], [kollektion()])
    expect(u).toMatchObject({ gesamt: 10, originale: 4, weitere: 6, verbraucht: 0 })
    expect(u.frei).toHaveLength(0)
  })

  it('zählt Karten aus eingelösten Kollektionen als verbraucht, nicht als vorhanden', () => {
    const u = kartenUebersicht(viele(3), [kollektion({ eingeloest: true })])
    expect(u.gesamt).toBe(0)
    expect(u.verbraucht).toBe(3)
  })

  it('gibt Karten einer gelöschten Kollektion wieder frei', () => {
    const u = kartenUebersicht([karte(), karte({ kollektion: '' })], [kollektion({ geloescht: true })])
    expect(u.gesamt).toBe(2)
    expect(u.frei).toHaveLength(2)
  })

  it('übergeht gelöschte Karten', () => {
    expect(kartenUebersicht([karte({ geloescht: true })], [kollektion()]).gesamt).toBe(0)
  })
})

describe('uptripWeg', () => {
  const karten = [...viele(4), ...viele(6, { original: false })]

  it('gibt es nur mit einer offenen Status-Kollektion', () => {
    expect(uptripWeg([], karten, [], '2026-09-11', 2)).toBeNull()
    expect(uptripWeg([kollektion({ bringtStatus: false })], karten, [], '2026-09-11', 2)).toBeNull()
    expect(uptripWeg([kollektion({ eingeloest: true })], karten, [], '2026-09-11', 2)).toBeNull()
    expect(uptripWeg([kollektion({ geloescht: true })], karten, [], '2026-09-11', 2)).toBeNull()
  })

  it('rechnet die fehlenden Originale in Segmente um', () => {
    expect(uptripWeg([kollektion()], karten, [], '2026-09-11', 2)!.segmenteNoetig).toBe(18)
  })

  it('rundet auf, wenn eine Karte übrig bliebe', () => {
    const w = uptripWeg([kollektion()], [...viele(5)], [], '2026-09-11', 2)!
    expect(w.stand.fehlendeOriginale).toBe(35)
    expect(w.segmenteNoetig).toBe(18)
  })

  it('zählt geplante Flüge ab heute — nicht gestern, keine geflogenen, keine gelöschten', () => {
    const fluege = [
      flug({ geplant: true, datum: '2026-09-11' }),
      flug({ geplant: true, datum: '2026-11-20' }),
      flug({ geplant: true, datum: '2026-09-10' }),
      flug({ geplant: false, datum: '2026-11-24' }),
      flug({ geplant: true, datum: '2026-11-24', geloescht: true }),
    ]
    const w = uptripWeg([kollektion()], karten, fluege, '2026-09-11', 2)!
    expect(w.geplanteSegmente).toBe(2)
    expect(w.originaleMitPlanung).toBe(8)
  })

  it('teilt nie durch null, auch wenn das Regelwerk null Karten je Segment sagt', () => {
    expect(uptripWeg([kollektion()], karten, [], '2026-09-11', 0)!.segmenteNoetig).toBe(36)
  })
})

describe('kartenVorschlaege', () => {
  const namen = {
    stadt: (c: string) => ({ MUC: 'München', DUS: 'Düsseldorf', HAM: 'Hamburg' })[c] ?? c,
    airline: (c: string) => ({ VL: 'Lufthansa City Airlines', LH: 'Lufthansa' })[c] ?? c,
  }

  it('schlägt Start, Ziel und Airline des letzten Flugs vor', () => {
    const v = kartenVorschlaege([flug()], [], namen, '2026-09-11')
    expect(v.map((x) => [x.name, x.art])).toEqual([
      ['München', 'stadt'],
      ['Düsseldorf', 'stadt'],
      ['Lufthansa City Airlines', 'airline'],
    ])
    expect(v[0]).toMatchObject({ datum: '2026-08-28', flug: 'VL · MUC → DUS' })
  })

  it('übergeht geplante, künftige und gelöschte Flüge', () => {
    const fluege = [
      flug({ geplant: true, datum: '2026-09-01' }),
      flug({ datum: '2026-09-12' }),
      flug({ geloescht: true }),
    ]
    expect(kartenVorschlaege(fluege, [], namen, '2026-09-11')).toHaveLength(0)
  })

  it('bietet einen Flug von heute schon an', () => {
    expect(kartenVorschlaege([flug({ datum: '2026-09-11' })], [], namen, '2026-09-11')).toHaveLength(3)
  })

  it('lässt weg, was vom selben Tag schon im Album steht', () => {
    const v = kartenVorschlaege([flug()], [karte({ name: 'münchen', datum: '2026-08-28' })], namen, '2026-09-11')
    expect(v.map((x) => x.name)).not.toContain('München')
    expect(v).toHaveLength(2)
  })

  it('bietet dieselbe Stadt von einem anderen Tag wieder an', () => {
    const v = kartenVorschlaege([flug()], [karte({ name: 'München', datum: '2026-08-14' })], namen, '2026-09-11')
    expect(v.map((x) => x.name)).toContain('München')
  })

  it('nimmt nur die letzten Flüge, neueste zuerst', () => {
    const fluege = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map(
      (datum) => flug({ datum }),
    )
    const v = kartenVorschlaege(fluege, [], namen, '2026-09-11')
    expect(v).toHaveLength(9)
    expect(v[0]!.datum).toBe('2026-09-01')
    expect(v.some((x) => x.datum === '2026-06-01')).toBe(false)
  })

  it('zeigt einen unbekannten Flughafen mit seinem Kürzel', () => {
    const v = kartenVorschlaege([flug({ nach: 'XYZ' })], [], namen, '2026-09-11')
    expect(v.map((x) => x.name)).toContain('XYZ')
  })
})

describe('alsKartenArt', () => {
  it('lässt bekannte Arten durch und macht aus allem anderen „Spezial“', () => {
    expect(alsKartenArt('flugzeug')).toBe('flugzeug')
    expect(alsKartenArt('rakete')).toBe('spezial')
    expect(alsKartenArt(undefined)).toBe('spezial')
  })
})

describe('uptripWegSatz', () => {
  const weg = (karten: UptripKarte[], o: Partial<UptripKollektion> = {}) =>
    uptripWeg([kollektion(o)], karten, [], '2026-09-11', 2)!

  it('beschreibt deinen echten Stand samt Vergleich mit dem Punkteweg', () => {
    expect(uptripWegSatz(weg([...viele(4), ...viele(6, { original: false })]), 13)).toBe(
      '4 von 40 Originalen und 6 von 10 weiteren Karten. Es fehlen noch mindestens 18 Flugsegmente — über die Punkte sind es rund 13.',
    )
  })

  it('lässt den Vergleich weg, wenn über die Punkte nichts mehr fehlt oder es keinen gibt', () => {
    expect(uptripWegSatz(weg(viele(4)), 0)).not.toContain('über die Punkte')
    expect(uptripWegSatz(weg(viele(4)), null)).not.toContain('über die Punkte')
  })

  it('spricht bei einem einzigen Segment in der Einzahl', () => {
    expect(uptripWegSatz(weg(viele(38)), null)).toContain('mindestens 1 Flugsegment.')
  })

  it('sagt nicht „0 Flugsegmente“, wenn nur noch beliebige Karten fehlen', () => {
    const satz = uptripWegSatz(weg(viele(40)), 13)
    expect(satz).toContain('Es fehlen nur noch 10 beliebige Karten.')
    expect(satz).not.toContain('Flugsegment')
  })

  it('zählt ohne Original-Pflicht nur Karten', () => {
    expect(uptripWegSatz(weg(viele(3), { benoetigt: 8, mindestOriginale: 0 }), null)).toBe(
      '3 von 8 Karten. Es fehlen nur noch 5 beliebige Karten.',
    )
  })

  it('meldet eine vollständige Kollektion', () => {
    expect(uptripWegSatz(weg([...viele(40), ...viele(10, { original: false })]), 13)).toContain('Vollständig')
  })
})
