import { describe, expect, it } from 'vitest'
import {
  alsBodenEintrag,
  istBodenGutschrift,
  istKontoauszug,
  leseKontoauszug,
  repariereUmlaute,
  schlageQuelleVor,
  verschmelzeBuchungen,
  zahlAusText,
} from './kontoauszug'
import type { AppDaten, BodenEintrag } from '../core/types'
import { BASIS_REGELWERK } from '../rules'
import { berechneBilanz } from '../core/calc'

/*
 * Nachbau der echten Antwort — gleiche Knoten, gleiche Kennungen, gleiche
 * Verschachtelung, gleiche kaputten Umlaute. Die Werte sind erfunden: Das Repo
 * ist öffentlich, echte Kontodaten gehören nicht hinein.
 */

const text = (id: string, t: string) => ({ id, type: 'copyText', variant: 'BODY', size: 'LARGE', text: t })

function betrag(p: string, i: number, bezeichnung: string, wert: string, aktion?: [string, string]) {
  const rows: unknown[] = [
    {
      id: `${p}_${i}_CurrencyAmountRow`,
      cells: [
        { body: { ...text(`${p}_${i}_0_CurrencyAmountCell`, bezeichnung), weight: 'BOLD' } },
        {
          body: {
            id: `${p}_${i}_1_CurrencyAmountCell`,
            type: 'row',
            items: [
              { id: `${p}_${i}_CurrencyAmountSpacer`, type: 'spacer', size: 'FULL' },
              text(`${p}_${i}_CurrencyAmountItem`, wert),
            ],
          },
        },
        ...(bezeichnung === 'Meilen'
          ? [{ body: { id: `${p}_${i}_Spacer`, type: 'row', items: [text(`${p}_${i}_MileageSign`, '-M-')] } }]
          : []),
      ],
    },
  ]
  if (aktion) {
    rows.push({
      id: `${p}_${i}_PromotionAmountRow`,
      cells: [
        { body: { id: `${p}_${i}_0_PromotionAmountCell`, type: 'column', items: [text(`${p}_${i}_1_PromotionAmountCell`, aktion[0])] } },
        { body: { id: `${p}_${i}_1_PromotionAmountCell`, type: 'row', items: [text(`${p}_${i}_PromotionAmountItem`, aktion[1])] } },
      ],
    })
  }
  return { id: `${p}_${i}_currencyAmount`, type: 'table', header: { columns: [] }, body: { rows } }
}

interface Zeilenangabe {
  partner: string
  datum: string
  texte: string[]
  betraege: [string, string][]
  klima?: boolean
}

function zeile(n: number, o: Zeilenangabe) {
  const p = `transactionRecord_${n}`
  return {
    id: `${p}_row`,
    cells: [
      {
        body: {
          id: `${p}_grid`,
          type: 'responsiveGrid',
          items: [
            { id: 'ywlprc', type: 'responsiveCell', items: [{ id: 'ipmnljkmvr', type: 'divider' }] },
            {
              id: `${p}_0_Cell`,
              type: 'responsiveCell',
              items: [
                {
                  id: `${p}_CellRow`,
                  type: 'row',
                  items: [
                    { id: `${p}_Image_1`, type: 'image', url: 'logo.svg', contentDescription: o.partner, maxWidth: 140 },
                    { id: `${p}_spacer`, type: 'spacer', size: 'FULL' },
                    { ...text(`${p}_Date`, o.datum), accessibility: { label: `Datum der AktivitÃ¤t ${o.datum}`, isHidden: true } },
                  ],
                },
              ],
            },
            {
              id: `${p}_1_Cell`,
              type: 'responsiveCell',
              items: [{ id: `${p}_Descriptions`, type: 'column', items: o.texte.map((t, i) => text(`${p}_${i}_Items`, t)) }],
            },
            {
              id: `${p}_2_Cell`,
              type: 'responsiveCell',
              items: o.betraege.map(([b, w], i) =>
                betrag(p, i, b, w, o.klima && b === 'Meilen' ? ['Klimabeitrag geleistet', '9'] : undefined),
              ),
            },
            ...(o.klima
              ? [{
                  id: `TransactionRecord_${n}_OffsetCell`,
                  type: 'responsiveCell',
                  items: [{ id: `TransactionRecord_${n}_OffsetRow`, type: 'row', items: [text(`TransactionRecord_${n}_OffsetText`, 'Beitrag zum Klimaschutz geleistet')] }],
                }]
              : []),
          ],
        },
      },
    ],
  }
}

function auszug(zeilen: unknown[], total = zeilen.length) {
  return {
    version: 'V2',
    id: 'transaction-list-pagination',
    metadata: { title: '' },
    body: {
      id: 'transaction-column',
      type: 'column',
      items: [
        { id: 'header-row', type: 'row', items: [text('headingIdTransactions', 'AktivitÃ¤ten')] },
        {
          id: 'transaction-table',
          type: 'table',
          header: { columns: [] },
          body: { rows: zeilen, loading: { id: 'loading-message', type: 'loader' } },
          pagination: { limit: 9, offset: 0, total },
        },
      ],
    },
  }
}

const FLUG = zeile(0, {
  partner: 'Lufthansa',
  datum: '03.05.2026',
  texte: ['MÃ¼nchen - Franz Josef Strauss - DÃ¼sseldorf - Nordrhein-Westfalen', 'LH 1234 durchgefÃ¼hrt von VL 5678 / Economy Class S'],
  betraege: [['Meilen', '400'], ['Points', '20'], ['Qualifying Points', '20']],
})

const FLUG_KLIMA = zeile(1, {
  partner: 'Austrian Airlines',
  datum: '28.04.2026',
  texte: ['Wien International - DÃ¼sseldorf - Nordrhein-Westfalen', 'OS 111 / Economy Class U'],
  betraege: [['Meilen', '600'], ['Points', '20'], ['Qualifying Points', '20'], ['HON Circle Points', '0']],
  klima: true,
})

const MOXY = zeile(2, {
  partner: 'Marriott Bonvoy',
  datum: '22.10.2026',
  texte: ['Moxy Berlin', 'Aufenthalt 15.10.2026'],
  betraege: [['Points', '20']],
})

const UPTRIP = (n: number) =>
  zeile(n, { partner: 'Miles & More', datum: '01.09.2026', texte: ['Uptrip Kollektion abgeschlossen'], betraege: [['Points', '20'], ['Qualifying Points', '20']] })

const NUR_MEILEN = zeile(5, { partner: 'Payback', datum: '02.02.2026', texte: ['Umwandlung Payback'], betraege: [['Meilen', '1.250']] })
const EINGELOEST = zeile(6, { partner: 'Miles & More', datum: '03.03.2026', texte: ['PrÃ¤mie: Lounge-Gutschein'], betraege: [['Meilen', '−5.000']] })

describe('istKontoauszug', () => {
  it('erkennt die Antwort der Kontoseite', () => {
    expect(istKontoauszug(auszug([FLUG]))).toBe(true)
  })

  it('verwechselt sie nicht mit der Flugliste oder anderem', () => {
    expect(istKontoauszug({ SegmentListResponses: [{ DepartureDate: '2026-01-01' }] })).toBe(false)
    expect(istKontoauszug({})).toBe(false)
    expect(istKontoauszug(null)).toBe(false)
    expect(istKontoauszug('text')).toBe(false)
  })
})

describe('leseKontoauszug', () => {
  it('liest einen Flug mit Datum, Partner, Texten und Beträgen', () => {
    const [b] = leseKontoauszug(auszug([FLUG])).buchungen
    expect(b).toMatchObject({
      datum: '2026-05-03',
      partner: 'Lufthansa',
      points: 20,
      qp: 20,
      meilen: 400,
      istFlug: true,
    })
    expect(b!.texte[0]).toBe('München - Franz Josef Strauss - Düsseldorf - Nordrhein-Westfalen')
  })

  it('zählt den Klimabeitrag nicht zu den Meilen und lässt sich von HON-Punkten nicht irritieren', () => {
    const [b] = leseKontoauszug(auszug([FLUG_KLIMA])).buchungen
    expect(b!.meilen).toBe(600)
    expect(b!.points).toBe(20)
    expect(b!.qp).toBe(20)
  })

  it('erkennt Gutschriften ohne Flug', () => {
    const [b] = leseKontoauszug(auszug([MOXY])).buchungen
    expect(b!.istFlug).toBe(false)
    expect(b!.points).toBe(20)
    expect(b!.qp).toBe(0)
    expect(istBodenGutschrift(b!)).toBe(true)
  })

  it('übergeht reine Meilengutschriften und Einlösungen — die zählen nicht für den Status', () => {
    const buchungen = leseKontoauszug(auszug([NUR_MEILEN, EINGELOEST])).buchungen
    expect(buchungen.map((b) => b.meilen)).toEqual([1250, -5000])
    expect(buchungen.filter(istBodenGutschrift)).toHaveLength(0)
  })

  it('nennt, wie viele Buchungen das Konto insgesamt hat', () => {
    expect(leseKontoauszug(auszug([FLUG, MOXY], 27)).gesamt).toBe(27)
  })

  it('gibt zwei gleichen Buchungen am selben Tag verschiedene Schlüssel', () => {
    const [a, b] = leseKontoauszug(auszug([UPTRIP(3), UPTRIP(4)])).buchungen
    expect(a!.schluessel).not.toBe(b!.schluessel)
  })

  it('bildet beim erneuten Einlesen dieselben Schlüssel, obwohl die Zeilen wandern', () => {
    // Beim nächsten Abruf rutscht alles eine Position weiter.
    const erst = leseKontoauszug(auszug([MOXY])).buchungen[0]!
    const verschoben = zeile(7, { partner: 'Marriott Bonvoy', datum: '22.10.2026', texte: ['Moxy Berlin', 'Aufenthalt 15.10.2026'], betraege: [['Points', '20']] })
    const spaeter = leseKontoauszug(auszug([FLUG, verschoben])).buchungen[1]!
    expect(spaeter.schluessel).toBe(erst.schluessel)
  })

  it('übergeht Zeilen ohne erkennbares Datum, statt abzustürzen', () => {
    const kaputt = zeile(8, { partner: 'X', datum: 'gestern', texte: ['?'], betraege: [['Points', '20']] })
    expect(leseKontoauszug(auszug([kaputt, MOXY])).buchungen).toHaveLength(1)
  })
})

describe('schlageQuelleVor', () => {
  const erste = (z: unknown) => leseKontoauszug(auszug([z])).buchungen[0]!

  it('ordnet Hotelaufenthalte Marriott zu', () => {
    expect(schlageQuelleVor(erste(MOXY))).toBe('marriott')
  })

  it('ordnet Uptrip zu', () => {
    expect(schlageQuelleVor(erste(UPTRIP(3)))).toBe('uptrip')
  })

  it('fällt bei Unbekanntem auf „Sonstiges“ zurück', () => {
    const fremd = zeile(9, { partner: 'Irgendwer', datum: '01.01.2026', texte: ['Aktion'], betraege: [['Points', '10']] })
    expect(schlageQuelleVor(erste(fremd))).toBe('sonstiges')
  })
})

describe('repariereUmlaute', () => {
  it('repariert alle deutschen Sonderzeichen, auch das tückische Ü', () => {
    expect(repariereUmlaute('MÃ¼nchen')).toBe('München')
    expect(repariereUmlaute('Ãœbersicht')).toBe('Übersicht')
    expect(repariereUmlaute('StraÃŸe')).toBe('Straße')
    expect(repariereUmlaute('Ã–sterreich')).toBe('Österreich')
    expect(repariereUmlaute('Ã„nderung')).toBe('Änderung')
    expect(repariereUmlaute('AktivitÃ¤ten')).toBe('Aktivitäten')
  })

  it('lässt heilen Text in Ruhe', () => {
    expect(repariereUmlaute('Düsseldorf')).toBe('Düsseldorf')
    expect(repariereUmlaute('Wien International')).toBe('Wien International')
  })

  it('verschlimmbessert nichts, was sich nicht sauber umwandeln lässt', () => {
    expect(repariereUmlaute('Ãx')).toBe('Ãx')
  })
})

describe('zahlAusText', () => {
  it('liest deutsche Schreibweisen', () => {
    expect(zahlAusText('20')).toBe(20)
    expect(zahlAusText('1.250')).toBe(1250)
    expect(zahlAusText('−5.000')).toBe(-5000)
    expect(zahlAusText('+40')).toBe(40)
  })

  it('erkennt Nicht-Zahlen', () => {
    expect(zahlAusText('-M-')).toBeNull()
    expect(zahlAusText('')).toBeNull()
    expect(zahlAusText('Points')).toBeNull()
  })
})

const QUELLE = (id: string) => BASIS_REGELWERK.bodenQuellen.find((q) => q.id === id)!
const buchung = (z: unknown) => leseKontoauszug(auszug([z])).buchungen[0]!

describe('alsBodenEintrag', () => {
  it('übernimmt eine Moxy-Nacht als einen Aufenthalt mit der echten Gutschrift', () => {
    const e = alsBodenEintrag(buchung(MOXY), QUELLE('marriott'))
    expect(e).toMatchObject({ quelle: 'marriott', anzahl: 1, korrekturPoints: 20, korrekturQp: 0, geplant: false, dirty: true })
    expect(e.herkunft).toBe(buchung(MOXY).schluessel)
  })

  it('errechnet beim Meilentausch die Zahl der Pakete aus den Punkten', () => {
    const tausch = zeile(10, { partner: 'Miles & More', datum: '05.05.2026', texte: ['Umwandlung Meilen in Points'], betraege: [['Points', '60'], ['Qualifying Points', '60']] })
    expect(alsBodenEintrag(buchung(tausch), QUELLE('kk-meilentausch')).anzahl).toBe(3)
  })

  it('trägt bei freier Eingabe Points und QP direkt ein', () => {
    const sonst = zeile(11, { partner: 'Aktion', datum: '06.06.2026', texte: ['Bonus'], betraege: [['Points', '35'], ['Qualifying Points', '12']] })
    const e = alsBodenEintrag(buchung(sonst), QUELLE('sonstiges'))
    expect(e.anzahl).toBe(35)
    expect(e.freieQp).toBe(12)
  })
})

function eintrag(o: Partial<BodenEintrag>): BodenEintrag {
  return {
    id: 'hand', datum: '2026-10-15', quelle: 'marriott', anzahl: 1, freieQp: 0, geplant: true,
    notiz: 'Moxy Berlin', korrekturPoints: null, korrekturQp: null, herkunft: '',
    geaendertAm: '', dirty: false, geloescht: false, ...o,
  }
}

describe('verschmelzeBuchungen', () => {
  const echt = () => alsBodenEintrag(buchung(MOXY), QUELLE('marriott'))

  it('legt eine neue Gutschrift an', () => {
    expect(verschmelzeBuchungen([], [echt()]).neu).toHaveLength(1)
  })

  it('übernimmt dieselbe Buchung kein zweites Mal', () => {
    const e = echt()
    const plan = verschmelzeBuchungen([{ ...e, id: 'alt' }], [echt()])
    expect(plan.neu).toHaveLength(0)
    expect(plan.schonDa).toBe(1)
  })

  it('bestätigt einen geplanten Aufenthalt, statt ihn zu verdoppeln', () => {
    const plan = verschmelzeBuchungen([eintrag({})], [echt()])
    expect(plan.neu).toHaveLength(0)
    expect(plan.erfuellt).toHaveLength(1)
    const { nachher } = plan.erfuellt[0]!
    expect(nachher).toMatchObject({ id: 'hand', datum: '2026-10-15', geplant: false, korrekturPoints: 20, dirty: true })
    expect(nachher.notiz).toContain('Moxy Berlin')
  })

  it('bestätigt nichts, was zu weit entfernt liegt', () => {
    expect(verschmelzeBuchungen([eintrag({ datum: '2026-07-01' })], [echt()]).erfuellt).toHaveLength(0)
  })

  it('bestätigt nichts aus einem anderen Jahr oder von einer anderen Quelle', () => {
    expect(verschmelzeBuchungen([eintrag({ datum: '2027-10-20' })], [echt()]).erfuellt).toHaveLength(0)
    expect(verschmelzeBuchungen([eintrag({ quelle: 'uptrip' })], [echt()]).erfuellt).toHaveLength(0)
  })

  it('holt eine gelöschte Gutschrift beim erneuten Einlesen nicht zurück', () => {
    const e = echt()
    const plan = verschmelzeBuchungen([{ ...e, geloescht: true }], [echt()])
    expect(plan.neu).toHaveLength(0)
    expect(plan.verworfen).toBe(1)
  })

  it('vergibt für dieselbe Buchung auf jedem Gerät dieselbe Kennung', () => {
    expect(echt().id).toBe(echt().id)
    expect(echt().id).not.toBe(alsBodenEintrag(buchung(UPTRIP(3)), QUELLE('uptrip')).id)
  })

  it('rührt Gelöschtes und schon Übernommenes nicht an', () => {
    expect(verschmelzeBuchungen([eintrag({ geloescht: true })], [echt()]).erfuellt).toHaveLength(0)
    expect(verschmelzeBuchungen([eintrag({ herkunft: 'andere' })], [echt()]).erfuellt).toHaveLength(0)
  })

  it('verwendet einen geplanten Eintrag nur einmal', () => {
    const zweite = { ...echt(), herkunft: 'kontoauszug|zweite', datum: '2026-10-25' }
    const plan = verschmelzeBuchungen([eintrag({})], [echt(), zweite])
    expect(plan.erfuellt).toHaveLength(1)
    expect(plan.neu).toHaveLength(1)
  })

  it('rechnet danach mit der echten Gutschrift und lässt zwei Aufenthalte frei', () => {
    const plan = verschmelzeBuchungen([eintrag({})], [echt()])
    const daten: AppDaten = {
      schema: 1, zieljahr: 2026, zielStatus: 'frequent-traveller', fluege: [],
      boden: plan.erfuellt.map((x) => x.nachher), regelwerkOverrides: {}, einstellungenGesendet: '',
    }
    const m = berechneBilanz(BASIS_REGELWERK, daten, 'plan').proQuelle.find((q) => q.quelle.id === 'marriott')!
    expect(m.punkte.points).toBe(20)
    expect(m.einheitenFrei).toBe(2)
  })
})
