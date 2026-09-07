import { useMemo, useState } from 'react'
import type { AppDaten, Flug, KlassenId, SetDaten, Strecke } from '../core/types'
import type { Regelwerk } from '../rules'
import { alleAirlines, istQualifyingAirline } from '../rules'
import { jahrVon, punkteFuerFlug } from '../core/calc'
import { AIRPORTS, airportLabel, schaetzeStrecke } from '../data/airports'
import { datumKurz, heuteIso, menge, zahl, zahlAusFeld } from '../core/format'
import { neueId } from '../store/store'
import { alsGeloescht, ohneGeloeschte } from '../sync/merge'

interface Props {
  regelwerk: Regelwerk
  daten: AppDaten
  setDaten: SetDaten
}

function leererFlug(jahr: number): Flug {
  const heute = heuteIso()
  return {
    id: neueId(),
    datum: jahrVon(heute) === jahr ? heute : `${jahr}-01-01`,
    von: '',
    nach: '',
    airline: 'LH',
    klasse: 'economy',
    strecke: 'kontinental',
    streckeManuell: false,
    geplant: jahr > new Date().getFullYear(),
    korrekturPoints: null,
    korrekturQp: null,
    notiz: '',
    geaendertAm: '',
    dirty: true,
    geloescht: false,
  }
}

export default function Fluege({ regelwerk, daten, setDaten }: Props) {
  const [entwurf, setEntwurf] = useState<Flug>(() => leererFlug(daten.zieljahr))
  const [bearbeitet, setBearbeitet] = useState<string | null>(null)
  const [zeigeKorrektur, setZeigeKorrektur] = useState(false)

  const airlines = useMemo(() => alleAirlines(regelwerk), [regelwerk])
  // Ein Code aus einer von Hand bearbeiteten Sicherung steht in keiner Liste.
  // Ohne eigenen Eintrag zeigte das Auswahlfeld dann die erste Airline an,
  // während gespeichert etwas anderes bliebe.
  const unbekannteAirline =
    entwurf.airline && !airlines.some((a) => a.code === entwurf.airline)
      ? entwurf.airline
      : null

  const imJahr = ohneGeloeschte(daten.fluege)
    .filter((f) => jahrVon(f.datum) === daten.zieljahr)
    .sort((a, b) => b.datum.localeCompare(a.datum))
  const andereJahre = ohneGeloeschte(daten.fluege).length - imJahr.length

  const vorschlag = schaetzeStrecke(entwurf.von, entwurf.nach)
  const vorschau = punkteFuerFlug(regelwerk, entwurf)
  const vollstaendig = Boolean(entwurf.datum && entwurf.von && entwurf.nach)

  /** Ändert ein Feld und zieht die Streckenautomatik nach, solange der Nutzer
   *  sie nicht selbst übersteuert hat. */
  function aendere(teil: Partial<Flug>) {
    const neu = { ...entwurf, ...teil }
    if (!neu.streckeManuell && (teil.von !== undefined || teil.nach !== undefined)) {
      const s = schaetzeStrecke(neu.von, neu.nach)
      if (s.sicher) neu.strecke = s.strecke
    }
    setEntwurf(neu)
  }

  function zuruecksetzen() {
    setEntwurf(leererFlug(daten.zieljahr))
    setBearbeitet(null)
    setZeigeKorrektur(false)
  }

  function speichern(danach: 'leeren' | 'rueckflug') {
    if (!vollstaendig) return
    const flug: Flug = {
      ...entwurf,
      von: entwurf.von.toUpperCase(),
      nach: entwurf.nach.toUpperCase(),
      // Jede Eingabe wartet ab jetzt auf den nächsten Abgleich.
      dirty: true,
    }
    setDaten((d) => ({
      ...d,
      fluege: bearbeitet
        ? d.fluege.map((f) => (f.id === bearbeitet ? flug : f))
        // Zwei schnelle Klicks landen im selben React-Durchlauf. Über die ID
        // bleibt das Anlegen idempotent, statt den Flug doppelt einzutragen.
        : d.fluege.some((f) => f.id === flug.id)
          ? d.fluege
          : [...d.fluege, flug],
    }))

    if (danach === 'rueckflug') {
      setEntwurf({ ...flug, id: neueId(), von: flug.nach, nach: flug.von })
      setBearbeitet(null)
    } else {
      zuruecksetzen()
    }
  }

  function bearbeiten(f: Flug) {
    setEntwurf({ ...f })
    setBearbeitet(f.id)
    setZeigeKorrektur(f.korrekturPoints !== null || f.korrekturQp !== null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function loeschen(id: string) {
    // Sanft löschen: Nur so erfährt ein zweites Gerät beim Abgleich davon.
    setDaten((d) => ({
      ...d,
      fluege: d.fluege.map((f) => (f.id === id ? alsGeloescht(f) : f)),
    }))
    if (bearbeitet === id) zuruecksetzen()
  }

  return (
    <>
      <section className="karte">
        <h2>{bearbeitet ? 'Flug bearbeiten' : 'Flug eintragen'}</h2>
        <p className="unter">
          Ein Segment pro Eintrag. Für Hin- und Rückflug gibt es unten einen eigenen
          Knopf.
        </p>

        <div className="formular">
          <div className="feld-reihe">
            <div className="feld">
              <label htmlFor="f-datum">Datum</label>
              <input
                id="f-datum"
                type="date"
                value={entwurf.datum}
                onChange={(e) => aendere({ datum: e.target.value })}
              />
              {entwurf.datum && jahrVon(entwurf.datum) !== daten.zieljahr && (
                <span className="hinweis warn">
                  Liegt nicht im Zieljahr {daten.zieljahr} — zählt dort nicht mit.
                </span>
              )}
            </div>

            <div className="feld">
              <label htmlFor="f-von">Von</label>
              <input
                id="f-von"
                list="airports"
                autoComplete="off"
                placeholder="FRA"
                maxLength={3}
                value={entwurf.von}
                onChange={(e) => aendere({ von: e.target.value.toUpperCase() })}
              />
              {AIRPORTS[entwurf.von] && (
                <span className="hinweis">{AIRPORTS[entwurf.von]!.name}</span>
              )}
            </div>

            <div className="feld">
              <label htmlFor="f-nach">Nach</label>
              <input
                id="f-nach"
                list="airports"
                autoComplete="off"
                placeholder="MUC"
                maxLength={3}
                value={entwurf.nach}
                onChange={(e) => aendere({ nach: e.target.value.toUpperCase() })}
              />
              {AIRPORTS[entwurf.nach] && (
                <span className="hinweis">{AIRPORTS[entwurf.nach]!.name}</span>
              )}
            </div>
          </div>

          <div className="feld-reihe">
            <div className="feld">
              <label htmlFor="f-airline">Airline</label>
              <select
                id="f-airline"
                value={entwurf.airline}
                onChange={(e) => aendere({ airline: e.target.value })}
              >
                <optgroup label="Mit Qualifying Points">
                  {airlines
                    .filter((a) => a.qualifying)
                    .map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.name}
                      </option>
                    ))}
                </optgroup>
                {unbekannteAirline && (
                  <optgroup label="Aus der Sicherung übernommen">
                    <option value={unbekannteAirline}>
                      {unbekannteAirline} (unbekannter Code)
                    </option>
                  </optgroup>
                )}
                <optgroup label="Nur Points, keine QP">
                  {airlines
                    .filter((a) => !a.qualifying)
                    .map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.name}
                      </option>
                    ))}
                </optgroup>
              </select>
              {!istQualifyingAirline(regelwerk, entwurf.airline) && (
                <span className="hinweis warn">Bringt keine Qualifying Points.</span>
              )}
            </div>

            <div className="feld">
              <label htmlFor="f-klasse">Reiseklasse</label>
              <select
                id="f-klasse"
                value={entwurf.klasse}
                onChange={(e) => aendere({ klasse: e.target.value as KlassenId })}
              >
                {regelwerk.klassen.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="feld">
              <label htmlFor="f-strecke">Strecke</label>
              <select
                id="f-strecke"
                value={entwurf.strecke}
                onChange={(e) =>
                  setEntwurf({
                    ...entwurf,
                    strecke: e.target.value as Strecke,
                    streckeManuell: true,
                  })
                }
              >
                <option value="kontinental">Kurzstrecke (kontinental)</option>
                <option value="interkontinental">Langstrecke (interkontinental)</option>
              </select>
              {entwurf.streckeManuell ? (
                <span className="hinweis">
                  Selbst gesetzt.{' '}
                  <button
                    type="button"
                    className="knopf leise klein"
                    style={{ padding: 0 }}
                    onClick={() => {
                      const s = schaetzeStrecke(entwurf.von, entwurf.nach)
                      setEntwurf({
                        ...entwurf,
                        streckeManuell: false,
                        strecke: s.sicher ? s.strecke : entwurf.strecke,
                      })
                    }}
                  >
                    Automatik zurück
                  </button>
                </span>
              ) : vorschlag.grenzfall ? (
                <span className="hinweis warn">
                  Grenzfall rund ums Mittelmeer — bitte gegenprüfen.
                </span>
              ) : vorschlag.sicher ? (
                <span className="hinweis">Automatisch aus den Flughäfen erkannt.</span>
              ) : (
                <span className="hinweis warn">
                  Flughafen unbekannt — bitte selbst wählen.
                </span>
              )}
            </div>
          </div>

          <label className="schalter">
            <input
              type="checkbox"
              checked={entwurf.geplant}
              onChange={(e) => aendere({ geplant: e.target.checked })}
            />
            Nur geplant — zählt in der Prognose, nicht im Ist-Stand
          </label>

          {zeigeKorrektur ? (
            <div className="feld-reihe">
              <div className="feld">
                <label htmlFor="f-kp">Tatsächlich gutgeschrieben: Points</label>
                <input
                  id="f-kp"
                  type="number"
                  inputMode="numeric"
                  placeholder={String(regelwerk.flugPunkte[entwurf.klasse]?.[entwurf.strecke] ?? 0)}
                  value={entwurf.korrekturPoints ?? ''}
                  min={0}
                  onChange={(e) =>
                    aendere({
                      korrekturPoints:
                        e.target.value === '' ? null : zahlAusFeld(e.target.value),
                    })
                  }
                />
              </div>
              <div className="feld">
                <label htmlFor="f-kqp">Tatsächlich gutgeschrieben: QP</label>
                <input
                  id="f-kqp"
                  type="number"
                  inputMode="numeric"
                  value={entwurf.korrekturQp ?? ''}
                  min={0}
                  onChange={(e) =>
                    aendere({
                      korrekturQp: e.target.value === '' ? null : zahlAusFeld(e.target.value),
                    })
                  }
                />
                <span className="hinweis">Leer lassen = Berechnung verwenden.</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="knopf leise klein"
              style={{ justifySelf: 'start' }}
              onClick={() => setZeigeKorrektur(true)}
            >
              Abweichende Gutschrift eintragen
            </button>
          )}

          <div className="feld">
            <label htmlFor="f-notiz">Notiz</label>
            <input
              id="f-notiz"
              type="text"
              placeholder="z. B. Buchungsnummer oder Anlass"
              value={entwurf.notiz}
              onChange={(e) => aendere({ notiz: e.target.value })}
            />
          </div>

          <div className="aussage" style={{ margin: 0 }}>
            <strong>
              {zahl(vorschau.points)} Points
              {vorschau.qp > 0 ? ` · ${zahl(vorschau.qp)} Qualifying Points` : ' · keine QP'}
            </strong>
            <p>
              {entwurf.von && entwurf.nach
                ? `${airportLabel(entwurf.von)} → ${airportLabel(entwurf.nach)}`
                : 'Flughäfen eintragen für die Vorschau.'}
            </p>
          </div>

          <div className="knopf-reihe">
            <button
              type="button"
              className="knopf haupt"
              disabled={!vollstaendig}
              onClick={() => speichern('leeren')}
            >
              {bearbeitet ? 'Änderung speichern' : 'Flug hinzufügen'}
            </button>
            {!bearbeitet && (
              <button
                type="button"
                className="knopf"
                disabled={!vollstaendig}
                onClick={() => speichern('rueckflug')}
                title="Speichert den Flug und legt direkt den Rückflug an"
              >
                Speichern + Rückflug
              </button>
            )}
            {(bearbeitet || entwurf.von || entwurf.nach) && (
              <button type="button" className="knopf leise" onClick={zuruecksetzen}>
                Abbrechen
              </button>
            )}
          </div>
          {!vollstaendig && (
            <span className="hinweis" style={{ color: 'var(--text-leise)', fontSize: 12.5 }}>
              Datum, Von und Nach sind nötig.
            </span>
          )}
        </div>
      </section>

      <section className="karte">
        <h2>Flüge {daten.zieljahr}</h2>
        <p className="unter">
          {menge(imJahr.length, 'Segment', 'Segmente')}
          {/* Auch bei einem leeren Jahr sagen, dass anderswo Einträge liegen —
              sonst wirkt ein Jahreswechsel wie ein Datenverlust. */}
          {andereJahre > 0 &&
            ` · ${menge(andereJahre, 'Segment liegt', 'Segmente liegen')} in anderen Jahren`}
        </p>

        {imJahr.length === 0 ? (
          <div className="leer">
            {andereJahre > 0
              ? `Für ${daten.zieljahr} ist nichts eingetragen. Deine übrigen Einträge sind nicht verloren — stelle oben rechts das Jahr um.`
              : 'Trage oben deinen ersten Flug ein — auch geplante Flüge, dann rechnet das Cockpit dir den Termin aus.'}
          </div>
        ) : (
          <div className="liste">
            {imJahr.map((f) => {
              const p = punkteFuerFlug(regelwerk, f)
              const klasse = regelwerk.klassen.find((k) => k.id === f.klasse)?.name ?? f.klasse
              const airline =
                [...regelwerk.qualifyingAirlines, ...regelwerk.weitereAirlines].find(
                  (a) => a.code === f.airline,
                )?.name ?? f.airline
              return (
                <div className={`zeile ${f.geplant ? 'ist-geplant' : ''}`} key={f.id}>
                  <div className="zeile-haupt">
                    <div className="zeile-titel">
                      {f.von} → {f.nach}
                      {f.geplant && <span className="marke-geplant">geplant</span>}
                    </div>
                    <div className="zeile-neben">
                      {datumKurz(f.datum)} · {airline} · {klasse} ·{' '}
                      {f.strecke === 'kontinental' ? 'Kurzstrecke' : 'Langstrecke'}
                      {f.notiz ? ` · ${f.notiz}` : ''}
                    </div>
                  </div>
                  <div className="punkte-block">
                    <b>{zahl(p.points)}</b>
                    <span className={p.qp === 0 ? 'keine-qp' : ''}>
                      {p.qp === 0 ? 'keine QP' : `${zahl(p.qp)} QP`}
                    </span>
                  </div>
                  <div className="knopf-reihe">
                    <button
                      type="button"
                      className="knopf klein"
                      onClick={() => bearbeiten(f)}
                    >
                      Ändern
                    </button>
                    <button
                      type="button"
                      className="knopf leise klein"
                      onClick={() => loeschen(f.id)}
                      aria-label={`Flug ${f.von} nach ${f.nach} löschen`}
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

      <datalist id="airports">
        {Object.values(AIRPORTS).map((a) => (
          <option key={a.iata} value={a.iata}>
            {a.name}
          </option>
        ))}
      </datalist>
    </>
  )
}
