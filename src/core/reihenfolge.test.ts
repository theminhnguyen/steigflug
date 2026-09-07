import { describe, expect, it } from 'vitest'
import { ordneSegmente, sortiereFuerAnzeige, sortiereSegmente } from './reihenfolge'

const HEUTE = '2026-09-07'
const e = (datum: string, von = 'AAA', nach = 'BBB') => ({ datum, von, nach })

describe('sortiereFuerAnzeige', () => {
  it('stellt den nächsten Termin nach oben', () => {
    const liste = [e('2027-03-04'), e('2027-02-15'), e('2027-03-01')]
    expect(sortiereFuerAnzeige(liste, HEUTE).map((x) => x.datum)).toEqual([
      '2027-02-15', '2027-03-01', '2027-03-04',
    ])
  })

  it('zeigt Vergangenes darunter, neuestes zuerst', () => {
    const liste = [e('2026-01-10'), e('2026-08-01'), e('2026-05-05')]
    expect(sortiereFuerAnzeige(liste, HEUTE).map((x) => x.datum)).toEqual([
      '2026-08-01', '2026-05-05', '2026-01-10',
    ])
  })

  it('trennt Bevorstehendes von Vergangenem', () => {
    const liste = [e('2026-01-10'), e('2027-03-01'), e('2026-12-24'), e('2026-09-20')]
    expect(sortiereFuerAnzeige(liste, HEUTE).map((x) => x.datum)).toEqual([
      '2026-09-20', '2026-12-24', '2027-03-01', '2026-01-10',
    ])
  })

  it('zählt heute noch zu bevorstehend', () => {
    expect(sortiereFuerAnzeige([e('2026-09-01'), e(HEUTE)], HEUTE)[0]!.datum).toBe(HEUTE)
  })

  it('verliert keinen Eintrag', () => {
    const liste = Array.from({ length: 20 }, (_, i) => e(`2027-01-${String(i + 1).padStart(2, '0')}`))
    expect(sortiereFuerAnzeige(liste, HEUTE)).toHaveLength(20)
  })
})

describe('ordneSegmente', () => {
  it('bringt eine Umsteigeverbindung in Reisereihenfolge', () => {
    const gruppe = [e('2027-03-01', 'VIE', 'OTP'), e('2027-03-01', 'DUS', 'VIE')]
    expect(ordneSegmente(gruppe).map((x) => `${x.von}-${x.nach}`)).toEqual([
      'DUS-VIE', 'VIE-OTP',
    ])
  })

  it('kommt mit drei Segmenten zurecht', () => {
    const gruppe = [
      e('2027-03-01', 'VIE', 'OTP'),
      e('2027-03-01', 'OTP', 'IST'),
      e('2027-03-01', 'DUS', 'VIE'),
    ]
    expect(ordneSegmente(gruppe).map((x) => x.von)).toEqual(['DUS', 'VIE', 'OTP'])
  })

  it('lässt zwei unabhängige Reisen am selben Tag unangetastet', () => {
    const gruppe = [e('2027-03-01', 'DUS', 'MUC'), e('2027-03-01', 'HAM', 'BER')]
    expect(ordneSegmente(gruppe).map((x) => x.von)).toEqual(['DUS', 'HAM'])
  })

  it('kommt mit einem Ringflug klar, ohne sich aufzuhängen', () => {
    const gruppe = [e('2027-03-01', 'DUS', 'MUC'), e('2027-03-01', 'MUC', 'DUS')]
    const ergebnis = ordneSegmente(gruppe)
    expect(ergebnis).toHaveLength(2)
  })

  it('verliert auch bei unvollständiger Kette nichts', () => {
    const gruppe = [
      e('2027-03-01', 'DUS', 'VIE'),
      e('2027-03-01', 'VIE', 'OTP'),
      e('2027-03-01', 'XXX', 'YYY'),
    ]
    expect(ordneSegmente(gruppe)).toHaveLength(3)
  })

  it('lässt ein einzelnes Segment in Ruhe', () => {
    const gruppe = [e('2027-03-01', 'DUS', 'MUC')]
    expect(ordneSegmente(gruppe)).toEqual(gruppe)
  })
})

describe('sortiereSegmente', () => {
  it('sortiert nach Datum und innerhalb des Tages nach Reiseverlauf', () => {
    const liste = [
      e('2027-03-04', 'VIE', 'DUS'),
      e('2027-03-01', 'VIE', 'OTP'),
      e('2027-03-04', 'OTP', 'VIE'),
      e('2027-03-01', 'DUS', 'VIE'),
      e('2027-02-15', 'DUS', 'MUC'),
    ]
    expect(sortiereSegmente(liste, HEUTE).map((x) => `${x.datum} ${x.von}-${x.nach}`)).toEqual([
      '2027-02-15 DUS-MUC',
      '2027-03-01 DUS-VIE',
      '2027-03-01 VIE-OTP',
      '2027-03-04 OTP-VIE',
      '2027-03-04 VIE-DUS',
    ])
  })

  it('verliert keinen Eintrag', () => {
    const liste = [
      e('2027-03-01', 'DUS', 'VIE'), e('2027-03-01', 'VIE', 'OTP'),
      e('2026-01-01', 'A', 'B'), e('2026-01-01', 'C', 'D'),
    ]
    expect(sortiereSegmente(liste, HEUTE)).toHaveLength(4)
  })
})
