import { describe, expect, it } from 'vitest'
import {
  alsGeloescht,
  einstellungenGeaendert,
  fuehreZusammen,
  offeneAenderungen,
  ohneGeloeschte,
  type Abgleichbar,
} from './merge'
import { leereDaten } from '../store/store'

type Testeintrag = Abgleichbar & { notiz?: string }

function e(id: string, over: Partial<Testeintrag> = {}): Testeintrag {
  return { id, geaendertAm: '2027-01-01T00:00:00Z', dirty: false, geloescht: false, ...over }
}

describe('fuehreZusammen', () => {
  it('behält Einträge, die es nur auf dem Server gibt', () => {
    const { lokal } = fuehreZusammen([], [e('a')])
    expect(lokal.map((x) => x.id)).toEqual(['a'])
  })

  it('behält Einträge, die es nur lokal gibt, und sendet sie', () => {
    const { lokal, zuSenden } = fuehreZusammen([e('a', { geaendertAm: '', dirty: true })], [])
    expect(lokal.map((x) => x.id)).toEqual(['a'])
    expect(zuSenden.map((x) => x.id)).toEqual(['a'])
  })

  it('vereinigt beide Seiten, wenn jedes Gerät etwas eigenes angelegt hat', () => {
    const { lokal } = fuehreZusammen(
      [e('nurLokal', { geaendertAm: '', dirty: true })],
      [e('nurFern')],
    )
    expect(lokal.map((x) => x.id).sort()).toEqual(['nurFern', 'nurLokal'])
  })

  it('lässt eine ungesendete lokale Änderung gewinnen', () => {
    const lokalNeu = e('a', { dirty: true, notiz: 'meine Fassung' })
    const fernAlt = { ...e('a'), notiz: 'alte Fassung' }
    const { lokal, zuSenden } = fuehreZusammen([lokalNeu], [fernAlt])
    expect(lokal[0]?.notiz).toBe('meine Fassung')
    expect(zuSenden.map((x) => x.id)).toEqual(['a'])
  })

  it('übernimmt die Serverfassung, wenn lokal nichts geändert wurde', () => {
    const lokalAlt = { ...e('a'), notiz: 'alt' }
    const fernNeu = { ...e('a', { geaendertAm: '2027-06-01T00:00:00Z' }), notiz: 'neu' }
    const { lokal, zuSenden } = fuehreZusammen([lokalAlt], [fernNeu])
    expect(lokal[0]?.notiz).toBe('neu')
    expect(zuSenden).toHaveLength(0)
  })

  it('trägt eine Löschung vom Server ins Gerät', () => {
    const { lokal } = fuehreZusammen([e('a')], [e('a', { geloescht: true })])
    expect(lokal[0]!.geloescht).toBe(true)
    expect(ohneGeloeschte(lokal)).toHaveLength(0)
  })

  it('sendet eine lokale Löschung weiter, statt sie zu verschlucken', () => {
    const { lokal, zuSenden } = fuehreZusammen([alsGeloescht(e('a'))], [e('a')])
    expect(lokal[0]!.geloescht).toBe(true)
    expect(zuSenden.map((x) => x.id)).toEqual(['a'])
  })

  it('sendet auch unveränderte Einträge, die der Server noch nicht kennt', () => {
    const { zuSenden } = fuehreZusammen([e('a', { geaendertAm: '', dirty: false })], [])
    expect(zuSenden.map((x) => x.id)).toEqual(['a'])
  })

  it('sendet nichts, wenn beide Seiten gleich sind', () => {
    const { zuSenden } = fuehreZusammen([e('a')], [e('a')])
    expect(zuSenden).toHaveLength(0)
  })

  it('bleibt bei mehrfachem Durchlauf stabil', () => {
    const erst = fuehreZusammen([e('a', { geaendertAm: '', dirty: true })], [e('b')])
    const zweit = fuehreZusammen(erst.lokal, [e('b')])
    expect(zweit.lokal.map((x) => x.id).sort()).toEqual(['a', 'b'])
  })

  it('legt keine Dubletten an, wenn dieselbe ID auf beiden Seiten steht', () => {
    const { lokal } = fuehreZusammen([e('a'), e('b')], [e('a'), e('b')])
    expect(lokal).toHaveLength(2)
  })
})

describe('Einstellungen', () => {
  it('erkennt eine Änderung gegenüber dem gesendeten Abbild', () => {
    const d = leereDaten(2027)
    expect(einstellungenGeaendert(d)).toBe(true) // noch nie gesendet
    const gesendet = { ...d, einstellungenGesendet: JSON.stringify({
      zieljahr: 2027, zielStatus: 'frequent-traveller', regelwerkOverrides: {},
    }) }
    expect(einstellungenGeaendert(gesendet)).toBe(false)
    expect(einstellungenGeaendert({ ...gesendet, zieljahr: 2028 })).toBe(true)
  })
})

describe('offeneAenderungen', () => {
  it('zählt Flüge, Boden-Einträge und Einstellungen zusammen', () => {
    const d = leereDaten(2027)
    const gesendet = JSON.stringify({
      zieljahr: 2027, zielStatus: 'frequent-traveller', regelwerkOverrides: {},
    })
    expect(
      offeneAenderungen({
        ...d,
        einstellungenGesendet: gesendet,
        fluege: [e('a', { dirty: true }) as never, e('b') as never],
        boden: [e('c', { geaendertAm: '' }) as never],
      }),
    ).toBe(2)
  })

  it('meldet null, wenn alles abgeglichen ist', () => {
    const d = leereDaten(2027)
    const gesendet = JSON.stringify({
      zieljahr: 2027, zielStatus: 'frequent-traveller', regelwerkOverrides: {},
    })
    expect(offeneAenderungen({ ...d, einstellungenGesendet: gesendet })).toBe(0)
  })
})
