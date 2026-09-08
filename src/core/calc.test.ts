import { describe, expect, it } from 'vitest'
import {
  anteil,
  berechneBilanz,
  berechneLuecke,
  berechneTempo,
  berechneVerlauf,
  bodenOhneLimit,
  bodenRestKapazitaet,
  erreichtAm,
  flugVorschlaege,
  maxEinheiten,
  punkteFuerFlug,
} from './calc'
import type { AppDaten, BodenEintrag, Flug, KlassenId, Strecke } from './types'
import { BASIS_REGELWERK, findeZiel } from '../rules'

const R = BASIS_REGELWERK
const FTL = findeZiel(R, 'frequent-traveller')

let zaehler = 0
const id = () => `t${++zaehler}`

function flug(over: Partial<Flug> = {}): Flug {
  return {
    id: id(),
    datum: '2027-03-01',
    von: 'FRA',
    nach: 'MUC',
    airline: 'LH',
    klasse: 'economy' as KlassenId,
    strecke: 'kontinental' as Strecke,
    streckeManuell: false,
    geplant: false,
    korrekturPoints: null,
    korrekturQp: null,
    notiz: '',
    geaendertAm: '',
    dirty: false,
    geloescht: false,
    ...over,
  }
}

function boden(over: Partial<BodenEintrag> = {}): BodenEintrag {
  return {
    id: id(),
    datum: '2027-03-01',
    quelle: 'marriott',
    anzahl: 1,
    freieQp: 0,
    geplant: false,
    notiz: '',
    geaendertAm: '',
    dirty: false,
    geloescht: false,
    ...over,
  }
}

function daten(over: Partial<AppDaten> = {}): AppDaten {
  return {
    schema: 1,
    zieljahr: 2027,
    zielStatus: 'frequent-traveller',
    fluege: [],
    boden: [],
    regelwerkOverrides: {},
    einstellungenGesendet: '',
    ...over,
  }
}

describe('punkteFuerFlug', () => {
  it('gibt Points und Qualifying Points bei einer vollintegrierten Airline', () => {
    expect(punkteFuerFlug(R, flug())).toEqual({ points: 20, qp: 20 })
  })

  it('gibt bei einer nicht-integrierten Airline nur Points, keine QP', () => {
    expect(punkteFuerFlug(R, flug({ airline: 'UA' }))).toEqual({ points: 20, qp: 0 })
  })

  it('erkennt Airline-Codes unabhängig von der Schreibweise', () => {
    expect(punkteFuerFlug(R, flug({ airline: 'lh' })).qp).toBe(20)
  })

  it('rechnet Langstrecke nach Klasse', () => {
    const lang = { strecke: 'interkontinental' as Strecke }
    expect(punkteFuerFlug(R, flug({ ...lang })).points).toBe(60)
    expect(punkteFuerFlug(R, flug({ ...lang, klasse: 'premium' })).points).toBe(80)
    expect(punkteFuerFlug(R, flug({ ...lang, klasse: 'business' })).points).toBe(200)
    expect(punkteFuerFlug(R, flug({ ...lang, klasse: 'first' })).points).toBe(400)
  })

  it('behandelt Premium Economy auf Kurzstrecke wie Economy', () => {
    expect(punkteFuerFlug(R, flug({ klasse: 'premium' })).points).toBe(20)
  })

  it('lässt die Korrekturwerte gewinnen', () => {
    const f = flug({ korrekturPoints: 33, korrekturQp: 7 })
    expect(punkteFuerFlug(R, f)).toEqual({ points: 33, qp: 7 })
  })

  it('erlaubt eine Korrektur auf null Punkte', () => {
    const f = flug({ korrekturPoints: 0, korrekturQp: 0 })
    expect(punkteFuerFlug(R, f)).toEqual({ points: 0, qp: 0 })
  })
})

describe('Jahresgrenzen', () => {
  it('zählt nur Einträge des Zieljahres', () => {
    const d = daten({
      fluege: [flug({ datum: '2026-12-31' }), flug({ datum: '2027-01-01' }), flug({ datum: '2028-01-01' })],
    })
    expect(berechneBilanz(R, d, 'plan').gesamt.points).toBe(20)
  })

  it('trennt Ist von Plan', () => {
    const d = daten({ fluege: [flug(), flug({ geplant: true })] })
    expect(berechneBilanz(R, d, 'ist').gesamt.points).toBe(20)
    expect(berechneBilanz(R, d, 'plan').gesamt.points).toBe(40)
  })
})

describe('Deckelung der Boden-Quellen', () => {
  it('deckelt Marriott bei 120 Points', () => {
    const d = daten({ boden: [boden({ anzahl: 5 })] })
    const b = berechneBilanz(R, d, 'plan')
    expect(b.gesamt.points).toBe(120)
    expect(b.gesamt.qp).toBe(0)
    const m = b.proQuelle.find((q) => q.quelle.id === 'marriott')!
    expect(m.ueberLimit).toBe(true)
    expect(m.limitErreicht).toBe(true)
    expect(m.einheitenGezaehlt).toBe(3)
  })

  it('deckelt auch über mehrere Einträge hinweg', () => {
    const d = daten({
      boden: [
        boden({ anzahl: 2, datum: '2027-02-01' }),
        boden({ anzahl: 2, datum: '2027-06-01' }),
      ],
    })
    expect(berechneBilanz(R, d, 'plan').gesamt.points).toBe(120)
  })

  it('deckelt den Meilentausch bei 100 Points und 100 QP', () => {
    const d = daten({ boden: [boden({ quelle: 'kk-meilentausch', anzahl: 9 })] })
    const b = berechneBilanz(R, d, 'plan')
    expect(b.gesamt).toEqual({ points: 100, qp: 100 })
  })

  it('lässt unbegrenzte Quellen ungedeckelt', () => {
    const d = daten({ boden: [boden({ quelle: 'evoucher', anzahl: 4 })] })
    expect(berechneBilanz(R, d, 'plan').gesamt).toEqual({ points: 200, qp: 200 })
  })

  it('übernimmt bei freier Eingabe Points und QP direkt', () => {
    const d = daten({ boden: [boden({ quelle: 'sonstiges', anzahl: 35, freieQp: 12 })] })
    expect(berechneBilanz(R, d, 'plan').gesamt).toEqual({ points: 35, qp: 12 })
  })

  it('meldet freie Restkapazität pro Quelle', () => {
    const d = daten({ boden: [boden({ anzahl: 1 })] })
    const rest = bodenRestKapazitaet(berechneBilanz(R, d, 'plan'))
    const m = rest.find((q) => q.quelle.id === 'marriott')!
    expect(m.einheitenFrei).toBe(2)
    expect(m.punkte).toEqual({ points: 80, qp: 0 })
  })
})

describe('maxEinheiten', () => {
  it('rechnet das Jahreslimit in Einheiten um', () => {
    const marriott = R.bodenQuellen.find((q) => q.id === 'marriott')!
    expect(maxEinheiten(marriott)).toBe(3)
  })

  it('gibt bei fehlendem Limit Unendlich zurück', () => {
    const ev = R.bodenQuellen.find((q) => q.id === 'evoucher')!
    expect(maxEinheiten(ev)).toBe(Infinity)
  })
})

describe('Lücke zum Ziel', () => {
  it('nennt die Restlücke getrennt nach Points und QP', () => {
    const d = daten({ boden: [boden({ anzahl: 3 })] }) // 120 Points, 0 QP
    const l = berechneLuecke(berechneBilanz(R, d, 'plan'), FTL)
    expect(l).toEqual({ points: 530, qp: 325, erreicht: false })
  })

  it('wird nie negativ', () => {
    const d = daten({ fluege: Array.from({ length: 40 }, () => flug()) })
    const l = berechneLuecke(berechneBilanz(R, d, 'plan'), FTL)
    expect(l).toEqual({ points: 0, qp: 0, erreicht: true })
  })

  it('gilt erst als erreicht, wenn auch die QP-Schwelle steht', () => {
    // 650 Points, aber ausschließlich ohne Qualifying Points
    const d = daten({
      fluege: Array.from({ length: 33 }, () => flug({ airline: 'UA' })),
    })
    const b = berechneBilanz(R, d, 'plan')
    expect(b.gesamt.points).toBe(660)
    expect(berechneLuecke(b, FTL).erreicht).toBe(false)
  })
})

describe('flugVorschlaege', () => {
  it('rechnet die nötigen Segmente aus der größeren der beiden Lücken', () => {
    const luecke = { points: 290, qp: 125, erreicht: false }
    const v = flugVorschlaege(R, luecke)
    const kurz = v.find((x) => x.klasse === 'economy' && x.strecke === 'kontinental')!
    const lang = v.find((x) => x.klasse === 'economy' && x.strecke === 'interkontinental')!
    expect(kurz.segmente).toBe(15) // 290/20 aufgerundet
    expect(lang.segmente).toBe(5) // 290/60 aufgerundet
  })

  it('liefert nichts, wenn das Ziel schon steht', () => {
    expect(flugVorschlaege(R, { points: 0, qp: 0, erreicht: true })).toEqual([])
  })

  it('richtet sich nach der QP-Lücke, wenn diese die größere ist', () => {
    const v = flugVorschlaege(R, { points: 20, qp: 300, erreicht: false })
    const kurz = v.find((x) => x.klasse === 'economy' && x.strecke === 'kontinental')!
    expect(kurz.segmente).toBe(15)
  })
})

describe('Verlauf und Prognose', () => {
  it('kumuliert in Datumsreihenfolge, unabhängig von der Eingabereihenfolge', () => {
    const d = daten({
      fluege: [
        flug({ datum: '2027-08-01' }),
        flug({ datum: '2027-02-01' }),
        flug({ datum: '2027-05-01' }),
      ],
    })
    const v = berechneVerlauf(R, d, FTL, 'plan')
    expect(v.map((x) => x.datum)).toEqual(['2027-02-01', '2027-05-01', '2027-08-01'])
    expect(v.map((x) => x.points)).toEqual([20, 40, 60])
  })

  it('nennt das Datum, an dem beide Schwellen erstmals stehen', () => {
    const fluege = Array.from({ length: 33 }, (_, i) =>
      flug({ datum: `2027-${String(Math.floor(i / 3) + 1).padStart(2, '0')}-10` }),
    )
    const v = berechneVerlauf(R, daten({ fluege }), FTL, 'plan')
    expect(erreichtAm(v)).toBe('2027-11-10')
  })

  it('gibt null zurück, solange das Ziel nicht erreicht wird', () => {
    const v = berechneVerlauf(R, daten({ fluege: [flug()] }), FTL, 'plan')
    expect(erreichtAm(v)).toBeNull()
  })

  it('deckelt Boden-Quellen auch im Verlauf fortlaufend', () => {
    const d = daten({
      boden: [
        boden({ anzahl: 2, datum: '2027-01-10' }),
        boden({ anzahl: 2, datum: '2027-02-10' }),
      ],
    })
    const v = berechneVerlauf(R, d, FTL, 'plan')
    expect(v.map((x) => x.points)).toEqual([80, 120])
  })
})

describe('Tempo-Hochrechnung', () => {
  it('gilt als nicht belastbar, wenn das Zieljahr noch nicht begonnen hat', () => {
    const d = daten({ fluege: [flug(), flug(), flug()] })
    const t = berechneTempo(berechneBilanz(R, d, 'ist'), 2027, new Date('2026-09-07'))
    expect(t.belastbar).toBe(false)
  })

  it('rechnet ein halbes Jahr sinnvoll hoch', () => {
    const fluege = Array.from({ length: 10 }, () => flug({ datum: '2027-03-01' }))
    const b = berechneBilanz(R, daten({ fluege }), 'ist')
    const t = berechneTempo(b, 2027, new Date('2027-07-02'))
    expect(t.belastbar).toBe(true)
    expect(t.hochrechnungPoints).toBeGreaterThan(380)
    expect(t.hochrechnungPoints).toBeLessThan(420)
  })

  it('teilt nicht durch null am ersten Januar', () => {
    const t = berechneTempo(berechneBilanz(R, daten(), 'ist'), 2027, new Date('2027-01-01'))
    expect(Number.isFinite(t.hochrechnungPoints)).toBe(true)
  })
})

describe('anteil', () => {
  it('begrenzt auf 0 bis 100', () => {
    expect(anteil(325, 650)).toBe(50)
    expect(anteil(9999, 650)).toBe(100)
    expect(anteil(-5, 650)).toBe(0)
    expect(anteil(5, 0)).toBe(100)
  })
})

describe('Realfall: Economy plus Boden-Punkte', () => {
  it('bestätigt die 15 Kurzstreckensegmente bei voll ausgeschöpften Boden-Quellen', () => {
    const d = daten({
      boden: [
        boden({ quelle: 'marriott', anzahl: 3 }), //  120 P /   0 QP
        boden({ quelle: 'kk-willkommen', anzahl: 1 }), //   40 P /   0 QP
        boden({ quelle: 'kk-meilentausch', anzahl: 5 }), //  100 P / 100 QP
        boden({ quelle: 'uptrip', anzahl: 5 }), //  100 P / 100 QP
      ],
    })
    const b = berechneBilanz(R, d, 'plan')
    expect(b.gesamt).toEqual({ points: 360, qp: 200 })

    const l = berechneLuecke(b, FTL)
    expect(l).toEqual({ points: 290, qp: 125, erreicht: false })

    const v = flugVorschlaege(R, l)
    expect(v.find((x) => x.klasse === 'economy' && x.strecke === 'kontinental')!.segmente).toBe(15)
    expect(v.find((x) => x.klasse === 'economy' && x.strecke === 'interkontinental')!.segmente).toBe(5)
  })

  it('schließt die Lücke mit 15 Kurzstreckenflügen tatsächlich', () => {
    const d = daten({
      boden: [
        boden({ quelle: 'marriott', anzahl: 3 }),
        boden({ quelle: 'kk-willkommen', anzahl: 1 }),
        boden({ quelle: 'kk-meilentausch', anzahl: 5 }),
        boden({ quelle: 'uptrip', anzahl: 5 }),
      ],
      fluege: Array.from({ length: 15 }, () => flug()),
    })
    expect(berechneLuecke(berechneBilanz(R, d, 'plan'), FTL).erreicht).toBe(true)
  })

  it('zeigt, dass Marriott allein nie reicht – die QP-Schwelle bleibt offen', () => {
    const d = daten({ boden: [boden({ anzahl: 99 })] })
    const l = berechneLuecke(berechneBilanz(R, d, 'plan'), FTL)
    expect(l.qp).toBe(325)
    expect(l.erreicht).toBe(false)
  })
})

describe('Jahresränder — beide Seiten', () => {
  it('nimmt den ersten UND den letzten Tag des Zieljahres mit', () => {
    const d = daten({
      fluege: [flug({ datum: '2027-01-01' }), flug({ datum: '2027-12-31' })],
    })
    expect(berechneBilanz(R, d, 'plan').anzahlFluege).toBe(2)
  })

  it('schließt den Tag davor UND den Tag danach aus', () => {
    const d = daten({
      fluege: [flug({ datum: '2026-12-31' }), flug({ datum: '2028-01-01' })],
    })
    expect(berechneBilanz(R, d, 'plan').anzahlFluege).toBe(0)
  })

  it('grenzt Boden-Einträge an beiden Rändern genauso ab', () => {
    const d = daten({
      boden: [
        boden({ datum: '2026-12-31' }),
        boden({ datum: '2027-01-01' }),
        boden({ datum: '2027-12-31' }),
        boden({ datum: '2028-01-01' }),
      ],
    })
    expect(berechneBilanz(R, d, 'plan').gesamt.points).toBe(80)
  })
})

describe('Deckelung genau an der Grenze', () => {
  it('zählt exakt das Limit noch voll und meldet kein Übersteigen', () => {
    const d = daten({ boden: [boden({ anzahl: 3 })] })
    const m = berechneBilanz(R, d, 'plan').proQuelle.find((q) => q.quelle.id === 'marriott')!
    expect(m.punkte.points).toBe(120)
    expect(m.limitErreicht).toBe(true)
    expect(m.ueberLimit).toBe(false)
    expect(m.einheitenFrei).toBe(0)
  })

  it('kappt die erste Einheit über der Grenze', () => {
    const d = daten({ boden: [boden({ anzahl: 4 })] })
    const m = berechneBilanz(R, d, 'plan').proQuelle.find((q) => q.quelle.id === 'marriott')!
    expect(m.punkte.points).toBe(120)
    expect(m.ueberLimit).toBe(true)
  })

  it('zählt eine Einheit unter der Grenze noch vollständig', () => {
    const d = daten({ boden: [boden({ anzahl: 2 })] })
    const m = berechneBilanz(R, d, 'plan').proQuelle.find((q) => q.quelle.id === 'marriott')!
    expect(m.punkte.points).toBe(80)
    expect(m.limitErreicht).toBe(false)
    expect(m.einheitenFrei).toBe(1)
  })
})

describe('Ziel exakt auf der Schwelle', () => {
  it('gilt bei punktgenauem Erreichen als geschafft', () => {
    const d = daten({
      // 32 Kurzstrecken = 640 P, dazu ein eVoucher = 50 P/50 QP -> 690/690
      fluege: Array.from({ length: 32 }, () => flug()),
      boden: [boden({ quelle: 'evoucher', anzahl: 1, datum: '2027-12-01' })],
    })
    const l = berechneLuecke(berechneBilanz(R, d, 'plan'), FTL)
    expect(l.erreicht).toBe(true)
  })

  it('gilt einen Punkt darunter noch nicht als geschafft', () => {
    const d = daten({
      fluege: Array.from({ length: 32 }, () => flug()),
      boden: [boden({ quelle: 'sonstiges', anzahl: 9, freieQp: 9, datum: '2027-12-01' })],
    })
    const b = berechneBilanz(R, d, 'plan')
    expect(b.gesamt.points).toBe(649)
    expect(berechneLuecke(b, FTL).erreicht).toBe(false)
  })
})

describe('Tempo-Hochrechnung an den Rändern', () => {
  it('rechnet ein abgelaufenes Jahr nicht über hundert Prozent hinaus', () => {
    const d = daten({ fluege: Array.from({ length: 10 }, () => flug({ datum: '2027-06-01' })) })
    const b = berechneBilanz(R, d, 'ist')
    const t = berechneTempo(b, 2027, new Date('2029-05-05'))
    expect(t.hochrechnungPoints).toBe(200)
  })

  it('liefert am 31. Dezember genau den Ist-Stand', () => {
    const d = daten({ fluege: Array.from({ length: 5 }, () => flug({ datum: '2027-06-01' })) })
    const b = berechneBilanz(R, d, 'ist')
    expect(berechneTempo(b, 2027, new Date('2027-12-31')).hochrechnungPoints).toBe(100)
  })
})

describe('flugVorschlaege bei einseitiger Lücke', () => {
  it('rechnet richtig, wenn nur noch Points fehlen', () => {
    const v = flugVorschlaege(R, { points: 100, qp: 0, erreicht: false })
    expect(v.find((x) => x.klasse === 'economy' && x.strecke === 'kontinental')!.segmente).toBe(5)
  })

  it('rechnet richtig, wenn nur noch Qualifying Points fehlen', () => {
    const v = flugVorschlaege(R, { points: 0, qp: 100, erreicht: false })
    expect(v.find((x) => x.klasse === 'economy' && x.strecke === 'kontinental')!.segmente).toBe(5)
  })
})

describe('Verlauf bei gleichem Datum', () => {
  it('summiert mehrere Einträge desselben Tages auf', () => {
    const d = daten({
      fluege: [flug({ datum: '2027-05-01' }), flug({ datum: '2027-05-01' })],
    })
    const v = berechneVerlauf(R, d, FTL, 'plan')
    expect(v).toHaveLength(2)
    expect(v[1]!.points).toBe(40)
  })
})

describe('Sanft gelöschte Einträge', () => {
  it('zählen in keiner Bilanz mit', () => {
    const d = daten({
      fluege: [flug(), flug({ geloescht: true })],
      boden: [boden({ anzahl: 2 }), boden({ anzahl: 3, geloescht: true })],
    })
    const b = berechneBilanz(R, d, 'plan')
    expect(b.anzahlFluege).toBe(1)
    expect(b.gesamt.points).toBe(20 + 80)
  })

  it('tauchen auch im Verlauf nicht auf', () => {
    const d = daten({ fluege: [flug({ geloescht: true })] })
    expect(berechneVerlauf(R, d, FTL, 'plan')).toHaveLength(0)
  })

  it('verbrauchen kein Jahreslimit', () => {
    const d = daten({
      boden: [boden({ anzahl: 3, geloescht: true }), boden({ anzahl: 1 })],
    })
    const m = berechneBilanz(R, d, 'plan').proQuelle.find((q) => q.quelle.id === 'marriott')!
    expect(m.punkte.points).toBe(40)
    expect(m.limitErreicht).toBe(false)
  })
})

describe('Unbrauchbare Werte', () => {
  it('fällt bei NaN in der Korrektur auf die Berechnung zurück', () => {
    const f = flug({ korrekturPoints: Number.NaN, korrekturQp: Number.NaN })
    expect(punkteFuerFlug(R, f)).toEqual({ points: 20, qp: 20 })
  })

  it('lässt keine unendlichen Werte in die Summe', () => {
    const d = daten({ fluege: [flug({ korrekturPoints: Number.POSITIVE_INFINITY })] })
    expect(Number.isFinite(berechneBilanz(R, d, 'plan').gesamt.points)).toBe(true)
  })

  it('bleibt bei einem kaputten Eintrag für die übrigen richtig', () => {
    const d = daten({ fluege: [flug({ korrekturPoints: Number.NaN }), flug()] })
    expect(berechneBilanz(R, d, 'plan').gesamt.points).toBe(40)
  })
})

describe('Verlauf kennzeichnet geplante Schritte', () => {
  it('markiert jeden Schritt danach, ob sein Eintrag geplant war', () => {
    const d = daten({
      fluege: [flug({ datum: '2027-02-01' }), flug({ datum: '2027-06-01', geplant: true })],
      boden: [boden({ datum: '2027-04-01', geplant: true })],
    })
    const v = berechneVerlauf(R, d, FTL, 'plan')
    expect(v.map((x) => x.geplant)).toEqual([false, true, true])
  })
})

describe('Airlines aus echten Kontodaten', () => {
  it('gibt Lufthansa City Airlines Qualifying Points', () => {
    // Aus dem echten Konto belegt: VL-Flüge wurden mit 20 Punkten gutgeschrieben.
    // Die Airline fehlte im Regelwerk und hätte null QP ergeben.
    expect(punkteFuerFlug(R, flug({ airline: 'VL' }))).toEqual({ points: 20, qp: 20 })
  })

  it('gibt allen vollintegrierten Airlines aus den Kontodaten Qualifying Points', () => {
    for (const code of ['LH', 'LX', 'OS', 'EW', 'VL', 'SN', 'EN', 'AZ', 'OU', 'LO', 'LG', '4Y']) {
      expect(punkteFuerFlug(R, flug({ airline: code })).qp, code).toBe(20)
    }
  })
})

describe('bodenOhneLimit', () => {
  it('nennt die Quellen ohne Jahreslimit samt Wert je Einheit', () => {
    const b = berechneBilanz(R, daten(), 'plan')
    const ohne = bodenOhneLimit(b)
    const ev = ohne.find((o) => o.quelle.id === 'evoucher')!
    expect(ev.jeEinheit).toEqual({ points: 50, qp: 50 })
  })

  it('lässt Quellen mit freier Eingabe weg — die kann man nicht beziffern', () => {
    const ohne = bodenOhneLimit(berechneBilanz(R, daten(), 'plan'))
    expect(ohne.map((o) => o.quelle.id)).not.toContain('sonstiges')
    expect(ohne.map((o) => o.quelle.id)).not.toContain('co2')
  })

  it('nennt keine begrenzte Quelle', () => {
    const ohne = bodenOhneLimit(berechneBilanz(R, daten(), 'plan'))
    expect(ohne.map((o) => o.quelle.id)).not.toContain('marriott')
  })
})
