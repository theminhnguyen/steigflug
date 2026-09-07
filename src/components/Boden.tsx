import { useState } from 'react'
import type { AppDaten, BodenEintrag } from '../core/types'
import type { Regelwerk } from '../rules'
import { findeBodenQuelle } from '../rules'
import { berechneBilanz, jahrVon, maxEinheiten, punkteFuerEinheiten } from '../core/calc'
import { datumKurz, heuteIso, menge, zahl } from '../core/format'
import { neueId } from '../store/store'

interface Props {
  regelwerk: Regelwerk
  daten: AppDaten
  setDaten: (d: AppDaten) => void
}

function leererEintrag(jahr: number, quelle: string): BodenEintrag {
  const heute = heuteIso()
  return {
    id: neueId(),
    datum: jahrVon(heute) === jahr ? heute : `${jahr}-01-01`,
    quelle,
    anzahl: 1,
    freieQp: 0,
    geplant: jahr > new Date().getFullYear(),
    notiz: '',
  }
}

export default function Boden({ regelwerk, daten, setDaten }: Props) {
  const ersteQuelle = regelwerk.bodenQuellen[0]!.id
  const [entwurf, setEntwurf] = useState<BodenEintrag>(() =>
    leererEintrag(daten.zieljahr, ersteQuelle),
  )
  const [bearbeitet, setBearbeitet] = useState<string | null>(null)

  const quelle = findeBodenQuelle(regelwerk, entwurf.quelle) ?? regelwerk.bodenQuellen[0]!
  const bilanz = berechneBilanz(regelwerk, daten, 'plan')
  const stand = bilanz.proQuelle.find((q) => q.quelle.id === quelle.id)

  const imJahr = daten.boden
    .filter((b) => jahrVon(b.datum) === daten.zieljahr)
    .sort((a, b) => b.datum.localeCompare(a.datum))

  const vorschau = punkteFuerEinheiten(quelle, entwurf.anzahl, entwurf.freieQp)
  const vollstaendig = Boolean(entwurf.datum) && entwurf.anzahl > 0

  function zuruecksetzen() {
    setEntwurf(leererEintrag(daten.zieljahr, entwurf.quelle))
    setBearbeitet(null)
  }

  function speichern() {
    if (!vollstaendig) return
    const boden = bearbeitet
      ? daten.boden.map((b) => (b.id === bearbeitet ? entwurf : b))
      : [...daten.boden, entwurf]
    setDaten({ ...daten, boden })
    zuruecksetzen()
  }

  function bearbeiten(b: BodenEintrag) {
    setEntwurf({ ...b })
    setBearbeitet(b.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function loeschen(id: string) {
    setDaten({ ...daten, boden: daten.boden.filter((b) => b.id !== id) })
    if (bearbeitet === id) zuruecksetzen()
  }

  return (
    <>
      <section className="karte">
        <h2>{bearbeitet ? 'Eintrag bearbeiten' : 'Punkte ohne Flug eintragen'}</h2>
        <p className="unter">
          Marriott, Kreditkarte, Uptrip und Co. Die Jahreslimits zieht Steigflug
          automatisch ab.
        </p>

        <div className="formular">
          <div className="feld">
            <label htmlFor="b-quelle">Quelle</label>
            <select
              id="b-quelle"
              value={entwurf.quelle}
              onChange={(e) =>
                setEntwurf({ ...entwurf, quelle: e.target.value, anzahl: 1, freieQp: 0 })
              }
            >
              {regelwerk.bodenQuellen.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>

          <div className="merker" style={{ margin: 0 }}>
            <span aria-hidden="true">ℹ️</span>
            <div>
              <b>{quelle.name}</b>
              {quelle.hinweis}
            </div>
          </div>

          <div className="feld-reihe">
            <div className="feld">
              <label htmlFor="b-datum">Datum</label>
              <input
                id="b-datum"
                type="date"
                value={entwurf.datum}
                onChange={(e) => setEntwurf({ ...entwurf, datum: e.target.value })}
              />
              {entwurf.datum && jahrVon(entwurf.datum) !== daten.zieljahr && (
                <span className="hinweis warn">
                  Liegt nicht im Zieljahr {daten.zieljahr}.
                </span>
              )}
            </div>

            <div className="feld">
              <label htmlFor="b-anzahl">
                {quelle.freieEingabe ? 'Points' : quelle.einheitPlural}
              </label>
              <input
                id="b-anzahl"
                type="number"
                inputMode="numeric"
                min={quelle.freieEingabe ? 0 : 1}
                step={1}
                value={entwurf.anzahl}
                onChange={(e) => setEntwurf({ ...entwurf, anzahl: Number(e.target.value) })}
              />
              {!quelle.freieEingabe && (
                <span className="hinweis">
                  {zahl(quelle.pointsProEinheit ?? 0)} Points
                  {quelle.qpProEinheit
                    ? ` + ${zahl(quelle.qpProEinheit)} QP`
                    : ' · keine QP'}{' '}
                  je {quelle.einheit}
                </span>
              )}
            </div>

            {quelle.freieEingabe && (
              <div className="feld">
                <label htmlFor="b-qp">davon Qualifying Points</label>
                <input
                  id="b-qp"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={entwurf.freieQp}
                  onChange={(e) => setEntwurf({ ...entwurf, freieQp: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          {stand && quelle.maxPointsProJahr !== null && (
            <div className="chips">
              <span className={`chip ${stand.limitErreicht ? 'voll' : 'gut'}`}>
                {stand.limitErreicht
                  ? `Jahreslimit ${daten.zieljahr} ausgeschöpft`
                  : `${daten.zieljahr}: noch ${menge(stand.einheitenFrei, quelle.einheit, quelle.einheitPlural)} möglich`}
              </span>
              <span className="chip">
                Maximal {zahl(quelle.maxPointsProJahr)} Points pro Jahr
                {maxEinheiten(quelle) !== Infinity &&
                  !quelle.freieEingabe &&
                  ` (${menge(maxEinheiten(quelle), quelle.einheit, quelle.einheitPlural)})`}
              </span>
            </div>
          )}

          <label className="schalter">
            <input
              type="checkbox"
              checked={entwurf.geplant}
              onChange={(e) => setEntwurf({ ...entwurf, geplant: e.target.checked })}
            />
            Nur geplant — zählt in der Prognose, nicht im Ist-Stand
          </label>

          <div className="feld">
            <label htmlFor="b-notiz">Notiz</label>
            <input
              id="b-notiz"
              type="text"
              placeholder="z. B. Hotel oder Aktion"
              value={entwurf.notiz}
              onChange={(e) => setEntwurf({ ...entwurf, notiz: e.target.value })}
            />
          </div>

          <div className="aussage" style={{ margin: 0 }}>
            <strong>
              {zahl(vorschau.points)} Points
              {vorschau.qp > 0 ? ` · ${zahl(vorschau.qp)} Qualifying Points` : ' · keine QP'}
            </strong>
            <p>
              {stand?.limitErreicht
                ? 'Achtung: Das Jahreslimit ist bereits erreicht — dieser Eintrag zählt nicht mehr mit.'
                : 'Vorschau vor Anrechnung des Jahreslimits.'}
            </p>
          </div>

          <div className="knopf-reihe">
            <button
              type="button"
              className="knopf haupt"
              disabled={!vollstaendig}
              onClick={speichern}
            >
              {bearbeitet ? 'Änderung speichern' : 'Hinzufügen'}
            </button>
            {bearbeitet && (
              <button type="button" className="knopf leise" onClick={zuruecksetzen}>
                Abbrechen
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="karte">
        <h2>Stand {daten.zieljahr}</h2>
        <p className="unter">Wie weit die einzelnen Quellen ausgeschöpft sind.</p>
        <div className="liste">
          {bilanz.proQuelle.map((q) => (
            <div className="zeile" key={q.quelle.id}>
              <div className="zeile-haupt">
                <div className="zeile-titel">{q.quelle.name}</div>
                <div className="zeile-neben">
                  {q.einheitenGezaehlt === 0
                    ? 'noch nichts eingetragen'
                    : menge(q.einheitenGezaehlt, q.quelle.einheit, q.quelle.einheitPlural)}
                  {q.quelle.maxPointsProJahr !== null &&
                    ` · Limit ${zahl(q.quelle.maxPointsProJahr)} Points`}
                  {q.ueberLimit &&
                    ` · ${menge(q.einheitenEingetragen - q.einheitenGezaehlt, q.quelle.einheit, q.quelle.einheitPlural)} über Limit`}
                </div>
              </div>
              <div className="punkte-block">
                <b>{zahl(q.punkte.points)}</b>
                <span className={q.punkte.qp === 0 ? 'keine-qp' : ''}>
                  {q.punkte.qp === 0 ? 'keine QP' : `${zahl(q.punkte.qp)} QP`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="karte">
        <h2>Einträge {daten.zieljahr}</h2>
        {imJahr.length === 0 ? (
          <div className="leer">Noch keine Boden-Punkte eingetragen.</div>
        ) : (
          <div className="liste">
            {imJahr.map((b) => {
              const q = findeBodenQuelle(regelwerk, b.quelle)
              const p = q ? punkteFuerEinheiten(q, b.anzahl, b.freieQp) : { points: 0, qp: 0 }
              return (
                <div className={`zeile ${b.geplant ? 'ist-geplant' : ''}`} key={b.id}>
                  <div className="zeile-haupt">
                    <div className="zeile-titel">
                      {q?.name ?? b.quelle}
                      {b.geplant && <span className="marke-geplant">geplant</span>}
                    </div>
                    <div className="zeile-neben">
                      {datumKurz(b.datum)} ·{' '}
                      {q?.freieEingabe
                        ? 'Direkteingabe'
                        : menge(b.anzahl, q?.einheit ?? '', q?.einheitPlural ?? '')}
                      {b.notiz ? ` · ${b.notiz}` : ''}
                    </div>
                  </div>
                  <div className="punkte-block">
                    <b>{zahl(p.points)}</b>
                    <span className={p.qp === 0 ? 'keine-qp' : ''}>
                      {p.qp === 0 ? 'keine QP' : `${zahl(p.qp)} QP`}
                    </span>
                  </div>
                  <div className="knopf-reihe">
                    <button type="button" className="knopf klein" onClick={() => bearbeiten(b)}>
                      Ändern
                    </button>
                    <button
                      type="button"
                      className="knopf leise klein"
                      onClick={() => loeschen(b.id)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
