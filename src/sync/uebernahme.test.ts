import { describe, expect, it } from 'vitest'
import { fuehreZusammen, offeneAenderungen, uebernimmErgebnis, type Abgleichbar } from './merge'
import { leereDaten } from '../store/store'

type Eintrag = Abgleichbar & { notiz?: string }

const e = (id: string, over: Partial<Eintrag> = {}): Eintrag => ({
  id, geaendertAm: '', dirty: true, geloescht: false, ...over,
})
const sauber = (id: string, over: Partial<Eintrag> = {}): Eintrag =>
  e(id, { dirty: false, geaendertAm: '2026-09-08T08:34:51Z', ...over })

describe('uebernimmErgebnis', () => {
  it('löscht das Kennzeichen „noch nicht gesendet“ — sonst bleibt alles ewig offen', () => {
    const vorher = [e('a')]
    const nach = uebernimmErgebnis([e('a')], vorher, [sauber('a')])
    expect(nach[0]!.dirty).toBe(false)
    expect(nach[0]!.geaendertAm).toBe('2026-09-08T08:34:51Z')
  })

  it('lässt nach der Übernahme nichts mehr zu senden übrig', () => {
    const nach = uebernimmErgebnis([e('a'), e('b')], [e('a'), e('b')], [sauber('a'), sauber('b')])
    expect(fuehreZusammen(nach, [sauber('a'), sauber('b')]).zuSenden).toHaveLength(0)
  })

  it('behält eine Eingabe, die während des Abgleichs gemacht wurde', () => {
    const vorher = [e('a', { notiz: 'alt' })]
    const aktuell = [e('a', { notiz: 'währenddessen getippt' })]
    const nach = uebernimmErgebnis(aktuell, vorher, [sauber('a', { notiz: 'alt' })])
    expect(nach[0]!.notiz).toBe('währenddessen getippt')
    expect(nach[0]!.dirty).toBe(true)
  })

  it('behält einen Eintrag, der während des Abgleichs angelegt wurde', () => {
    const nach = uebernimmErgebnis([e('a'), e('neu')], [e('a')], [sauber('a')])
    expect(nach.map((x) => x.id).sort()).toEqual(['a', 'neu'])
    expect(nach.find((x) => x.id === 'neu')!.dirty).toBe(true)
  })

  it('behält eine Löschung, die während des Abgleichs erfolgte', () => {
    const vorher = [e('a', { dirty: false, geaendertAm: 'x' })]
    const aktuell = [e('a', { dirty: true, geloescht: true, geaendertAm: 'x' })]
    const nach = uebernimmErgebnis(aktuell, vorher, [sauber('a')])
    expect(nach[0]!.geloescht).toBe(true)
  })

  it('nimmt auf, was der Abgleich vom Server mitgebracht hat', () => {
    const nach = uebernimmErgebnis([e('a')], [e('a')], [sauber('a'), sauber('vomServer')])
    expect(nach.map((x) => x.id).sort()).toEqual(['a', 'vomServer'])
  })

  it('verliert keinen Eintrag, der im Ergebnis fehlt', () => {
    const nach = uebernimmErgebnis([e('a'), e('b')], [e('a'), e('b')], [sauber('a')])
    expect(nach).toHaveLength(2)
    expect(nach.find((x) => x.id === 'b')!.dirty).toBe(true)
  })

  it('ist bei mehrfacher Anwendung stabil', () => {
    const erst = uebernimmErgebnis([e('a')], [e('a')], [sauber('a')])
    const zweit = uebernimmErgebnis(erst, erst, [sauber('a')])
    expect(zweit).toEqual(erst)
  })
})

describe('Offene Änderungen nach einem Abgleich', () => {
  it('geht auf null zurück — daran hing die Ampel', () => {
    const basis = leereDaten(2026)
    const gesendet = JSON.stringify({
      zieljahr: 2026, zielStatus: 'frequent-traveller', regelwerkOverrides: {},
    })
    const vorher = { ...basis, fluege: [e('a') as never, e('b') as never] }
    const nachher = {
      ...basis,
      einstellungenGesendet: gesendet,
      fluege: uebernimmErgebnis(vorher.fluege, vorher.fluege, [sauber('a') as never, sauber('b') as never]),
    }
    expect(offeneAenderungen(vorher)).toBe(3)
    expect(offeneAenderungen(nachher)).toBe(0)
  })
})
