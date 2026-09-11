import { useMemo, useState } from 'react'
import type { AppDaten, BodenEintrag, SetDaten } from '../core/types'
import type { BodenQuelle, Regelwerk } from '../rules'
import { findeBodenQuelle } from '../rules'
import {
  alsBodenEintrag,
  istBodenGutschrift,
  schlageQuelleVor,
  verschmelzeBuchungen,
  type Kontoauszug,
} from '../import/kontoauszug'
import { datumKurz, menge, zahl } from '../core/format'

interface Props {
  auszug: Kontoauszug
  /** Woher der Auszug kam, als Ortsangabe: „im eingefügten Text“ */
  ort: string
  regelwerk: Regelwerk
  daten: AppDaten
  setDaten: SetDaten
  /** Nach Übernehmen oder Verwerfen, mit Meldung, wenn es eine gibt */
  schliessen: (meldung?: string) => void
}

type Zustand = 'neu' | 'bestaetigt' | 'schon-da' | 'geloescht'

const ZUSTAND_TEXT: Record<Zustand, string> = {
  neu: 'neu',
  bestaetigt: 'bestätigt Planung',
  'schon-da': 'schon übernommen',
  geloescht: 'von dir gelöscht',
}

/** Die vorgeschlagene Quelle — oder „Sonstiges“, falls das Regelwerk sie nicht kennt. */
function quelleFuer(regelwerk: Regelwerk, id: string | undefined): BodenQuelle {
  return (
    findeBodenQuelle(regelwerk, id ?? '') ??
    findeBodenQuelle(regelwerk, 'sonstiges') ??
    regelwerk.bodenQuellen[0]!
  )
}

/**
 * Vorschau eines eingelesenen Kontoauszugs.
 *
 * Die Zuordnung zu einer Boden-Quelle ist nur ein Vorschlag aus Partner und
 * Buchungstext — echte Beispiele für Uptrip, Marriott und Kreditkarte lagen
 * beim Bau nicht vor. Deshalb steht bei jeder neuen Gutschrift eine Auswahl,
 * und übernommen wird erst auf Knopfdruck.
 */
export default function KontoauszugVorschau({
  auszug,
  ort,
  regelwerk,
  daten,
  setDaten,
  schliessen,
}: Props) {
  const gutschriften = useMemo(() => auszug.buchungen.filter(istBodenGutschrift), [auszug])
  const fluege = useMemo(() => auszug.buchungen.filter((b) => b.istFlug).length, [auszug])
  const [zuordnung, setZuordnung] = useState<Record<string, string>>(() =>
    Object.fromEntries(gutschriften.map((b) => [b.schluessel, schlageQuelleVor(b)])),
  )

  const eintraege = useMemo(
    () =>
      gutschriften.map((b) => alsBodenEintrag(b, quelleFuer(regelwerk, zuordnung[b.schluessel]))),
    [gutschriften, zuordnung, regelwerk],
  )
  const plan = useMemo(() => verschmelzeBuchungen(daten.boden, eintraege), [daten.boden, eintraege])

  const zustand = useMemo(() => {
    const m = new Map<string, { art: Zustand; vorher?: BodenEintrag }>()
    for (const e of plan.neu) m.set(e.herkunft, { art: 'neu' })
    for (const x of plan.erfuellt) m.set(x.nachher.herkunft, { art: 'bestaetigt', vorher: x.vorher })
    // Ein lebender Eintrag geht einem gelöschten mit derselben Herkunft vor.
    for (const b of daten.boden) {
      if (b.herkunft && !b.geloescht && !m.has(b.herkunft)) m.set(b.herkunft, { art: 'schon-da' })
    }
    for (const b of daten.boden) {
      if (b.herkunft && b.geloescht && !m.has(b.herkunft)) m.set(b.herkunft, { art: 'geloescht' })
    }
    return m
  }, [plan, daten.boden])

  const nichtsZuTun = plan.neu.length === 0 && plan.erfuellt.length === 0

  function uebernehmen() {
    setDaten((d) => {
      // Bewusst gegen den aktuellen Stand statt gegen den der Vorschau: Seit dem
      // Anzeigen kann ein Abgleich Einträge gebracht haben.
      const p = verschmelzeBuchungen(d.boden, eintraege)
      const ersatz = new Map(p.erfuellt.map((x) => [x.nachher.id, x.nachher]))
      const dazu = p.neu.filter((e) => !d.boden.some((b) => b.id === e.id))
      return { ...d, boden: [...d.boden.map((b) => ersatz.get(b.id) ?? b), ...dazu] }
    })
    const teile = [menge(plan.neu.length, 'Gutschrift neu übernommen', 'Gutschriften neu übernommen')]
    if (plan.erfuellt.length > 0) {
      teile.push(menge(plan.erfuellt.length, 'geplanter Eintrag bestätigt', 'geplante Einträge bestätigt'))
    }
    schliessen(`${teile.join(', ')}. Zu finden unter „Boden“.`)
  }

  return (
    <div className="vorschau">
      <p className="abschnitt-titel" style={{ marginTop: 'var(--s4)' }}>
        Kontoauszug gefunden {ort}
      </p>

      <div className="chips" style={{ marginBottom: 'var(--s3)' }}>
        <span className="chip gut">
          {menge(plan.neu.length, 'Gutschrift neu', 'Gutschriften neu')}
        </span>
        {plan.erfuellt.length > 0 && (
          <span className="chip gut">
            {menge(plan.erfuellt.length, 'Planung bestätigt', 'Planungen bestätigt')}
          </span>
        )}
        {plan.schonDa > 0 && <span className="chip">{zahl(plan.schonDa)} schon übernommen</span>}
        {plan.verworfen > 0 && (
          <span className="chip">{zahl(plan.verworfen)} von dir gelöscht, bleiben weg</span>
        )}
        {fluege > 0 && (
          <span className="chip">{menge(fluege, 'Flug', 'Flüge')} übergangen</span>
        )}
      </div>

      {fluege > 0 && (
        <p className="unter">
          Flüge übernimmt dieser Import nicht — die kommen genauer über die Flugliste und
          zählten sonst doppelt.
        </p>
      )}

      {auszug.gesamt !== null && auszug.gesamt > auszug.buchungen.length && (
        <div className="merker">
          <span aria-hidden="true">📄</span>
          <div>
            <b>
              Die neuesten {zahl(auszug.buchungen.length)} von {zahl(auszug.gesamt)} Buchungen
            </b>
            Ältere liefert die Adresse nicht mit, und Flüge zählen dabei mit. Lies den Auszug
            deshalb ein, bevor mehr als {zahl(auszug.buchungen.length)} neue Buchungen
            dazukommen — dann rutscht nichts durch. Doppelt übernommen wird nichts.
          </div>
        </div>
      )}

      {gutschriften.length === 0 ? (
        <div className="leer">
          In diesem Auszug steht keine Gutschrift ohne Flug, die für den Status zählt.
        </div>
      ) : (
        <div className="liste">
          {gutschriften.map((b, i) => {
            const z = zustand.get(b.schluessel) ?? { art: 'schon-da' as const }
            const q = quelleFuer(regelwerk, zuordnung[b.schluessel])
            const regel =
              !q.freieEingabe && !q.einheitenAusPunkten ? (q.pointsProEinheit ?? null) : null
            const aenderbar = z.art === 'neu' || z.art === 'bestaetigt'
            return (
              <div className="zeile" key={b.schluessel}>
                <div className="zeile-haupt">
                  <div className="zeile-titel">
                    {b.partner || 'Gutschrift'}
                    <span className="marke-geplant">{ZUSTAND_TEXT[z.art]}</span>
                  </div>
                  <div className="zeile-neben">
                    {datumKurz(b.datum)}
                    {b.texte.length > 0 && ` · ${b.texte.join(' · ')}`}
                  </div>
                  {z.vorher && (
                    <div className="zeile-neben">
                      Bestätigt deinen geplanten Eintrag vom {datumKurz(z.vorher.datum)}
                    </div>
                  )}
                  {regel !== null && regel !== b.points && (
                    <div className="zeile-neben">
                      Das Regelwerk rechnet hier mit {zahl(regel)} Points. Übernommen wird die
                      echte Gutschrift.
                    </div>
                  )}
                  {aenderbar && (
                    <div className="feld" style={{ marginTop: 'var(--s2)' }}>
                      <label htmlFor={`ka-quelle-${i}`}>Zählt als</label>
                      <select
                        id={`ka-quelle-${i}`}
                        value={q.id}
                        onChange={(e) => {
                          const wert = e.target.value
                          setZuordnung((bisher) => ({ ...bisher, [b.schluessel]: wert }))
                        }}
                      >
                        {regelwerk.bodenQuellen.map((quelle) => (
                          <option key={quelle.id} value={quelle.id}>
                            {quelle.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="punkte-block">
                  <b>{zahl(b.points)}</b>
                  <span className={b.qp === 0 ? 'keine-qp' : ''}>
                    {b.qp === 0 ? 'keine QP' : `${zahl(b.qp)} QP`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="knopf-reihe" style={{ marginTop: 'var(--s4)' }}>
        <button type="button" className="knopf haupt" disabled={nichtsZuTun} onClick={uebernehmen}>
          Übernehmen
        </button>
        <button type="button" className="knopf leise" onClick={() => schliessen()}>
          Verwerfen
        </button>
      </div>
      {nichtsZuTun && (
        <span className="hinweis">
          {gutschriften.length === 0
            ? 'Es gibt nichts zu übernehmen.'
            : 'Alles aus diesem Auszug steht schon in der App — es gibt nichts zu übernehmen.'}
        </span>
      )}
    </div>
  )
}
