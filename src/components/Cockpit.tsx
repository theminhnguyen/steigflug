import { useMemo } from 'react'
import type { AppDaten, Strecke } from '../core/types'
import type { Regelwerk, Ziel } from '../rules'
import {
  berechneBilanz,
  bodenOhneLimit,
  berechneLuecke,
  berechneTempo,
  berechneVerlauf,
  bodenRestKapazitaet,
  erreichtAm,
  flugVorschlaege,
} from '../core/calc'
import { datum, menge, zahl } from '../core/format'
import { jahresfrist, naeheresJahr, offeneTermine } from '../core/fristen'
import Balken from './Balken'
import Kurve from './Kurve'

interface Props {
  regelwerk: Regelwerk
  daten: AppDaten
  ziel: Ziel
  aufFluege: () => void
  aufBoden: () => void
}

const KURZ_DATUM = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' })

export default function Cockpit({ regelwerk, daten, ziel, aufFluege, aufBoden }: Props) {
  const ist = useMemo(() => berechneBilanz(regelwerk, daten, 'ist'), [regelwerk, daten])
  const plan = useMemo(() => berechneBilanz(regelwerk, daten, 'plan'), [regelwerk, daten])
  const verlauf = useMemo(
    () => berechneVerlauf(regelwerk, daten, ziel, 'plan'),
    [regelwerk, daten, ziel],
  )

  const lueckeIst = berechneLuecke(ist, ziel)
  const lueckePlan = berechneLuecke(plan, ziel)
  const erreichtIst = useMemo(
    () => erreichtAm(berechneVerlauf(regelwerk, daten, ziel, 'ist')),
    [regelwerk, daten, ziel],
  )
  const erreichtPlan = erreichtAm(verlauf)
  const tempo = berechneTempo(ist, daten.zieljahr)

  // Was bleibt, wenn alle noch offenen Boden-Quellen ausgeschöpft werden?
  const rest = bodenRestKapazitaet(plan)
  const bodenMoeglich = rest.reduce(
    (s, r) => ({ points: s.points + r.punkte.points, qp: s.qp + r.punkte.qp }),
    { points: 0, qp: 0 },
  )
  const nachBoden = {
    points: Math.max(0, lueckePlan.points - bodenMoeglich.points),
    qp: Math.max(0, lueckePlan.qp - bodenMoeglich.qp),
    erreicht: false,
  }
  nachBoden.erreicht = nachBoden.points === 0 && nachBoden.qp === 0

  const vorschlaege = flugVorschlaege(regelwerk, nachBoden)
  const economyKurz = vorschlaege.find(
    (v) => v.klasse === 'economy' && v.strecke === 'kontinental',
  )
  const leer = daten.fluege.length + daten.boden.length === 0
  const ohneLimit = bodenOhneLimit(plan)
  const frist = jahresfrist(daten.zieljahr)
  const termine = useMemo(() => offeneTermine(regelwerk.termine ?? []), [regelwerk.termine])

  // Wer auf ein künftiges Jahr plant, übersieht leicht, dass das laufende
  // längst weiter ist. Deshalb alle Jahre mit Einträgen durchrechnen.
  const naeher = useMemo(() => {
    const jahre = new Set<number>([daten.zieljahr])
    for (const e of [...daten.fluege, ...daten.boden]) {
      if (!e.geloescht) jahre.add(Number(e.datum.slice(0, 4)))
    }
    const staende = [...jahre]
      .filter((j) => Number.isFinite(j) && j > 2000 && j < 2100)
      .map((jahr) => ({
        jahr,
        luecke: berechneLuecke(berechneBilanz(regelwerk, { ...daten, zieljahr: jahr }, 'plan'), ziel),
      }))
    return naeheresJahr(staende, daten.zieljahr)
  }, [regelwerk, daten, ziel])

  return (
    <>
      {/* Genau eine Leitzahl je Ansicht. */}
      {lueckeIst.erreicht ? (
        <section className="aussage erreicht">
          <div className="leitzahl">
            <b>{zahl(ist.gesamt.points)}</b>
            <span className="einheit">Points erreicht</span>
          </div>
          <p>
            {ziel.name} steht seit dem {datum(erreichtIst ?? '')}. Der Status gilt für den
            Rest von {daten.zieljahr} plus das folgende Kalenderjahr plus zwei Monate.
          </p>
        </section>
      ) : erreichtPlan ? (
        <section className="aussage">
          <div className="leitzahl">
            <b>{KURZ_DATUM.format(new Date(`${erreichtPlan}T12:00:00`))}</b>
            <span className="einheit">{daten.zieljahr} voraussichtlich {ziel.kuerzel}</span>
          </div>
          <p>
            Wenn alle geplanten Flüge und Buchungen so eintreffen, reißt du an diesem Tag
            beide Schwellen.
          </p>
        </section>
      ) : (
        <section className="aussage">
          <div className="leitzahl">
            <b>{zahl(lueckePlan.points)}</b>
            <span className="einheit">Points fehlen noch</span>
          </div>
          <p>
            {leer
              ? `Trage deine Flüge und Boden-Punkte ein, dann rechnet Steigflug dir den voraussichtlichen Termin für ${daten.zieljahr} aus.`
              : `Dazu ${zahl(lueckePlan.qp)} Qualifying Points. Mit dem, was eingetragen und geplant ist, reicht es für ${daten.zieljahr} noch nicht.`}
          </p>
          {!frist.nochNichtBegonnen && !frist.abgelaufen && (
            <p className="zusatz">
              Noch <strong>{menge(frist.tageUebrig, 'Tag', 'Tage')}</strong> bis zum
              31.12.{daten.zieljahr}.
            </p>
          )}
          {frist.abgelaufen && (
            <p className="zusatz">
              {daten.zieljahr} ist vorbei — hier lässt sich nichts mehr erreichen.
            </p>
          )}
        </section>
      )}

      {naeher && (
        <div className="merker">
          <span aria-hidden="true">📅</span>
          <div>
            <b>In {naeher.jahr} bist du näher dran</b>
            Dort fehlen nur {zahl(naeher.luecke.points)} Points
            {naeher.luecke.qp > 0
              ? ` und ${zahl(naeher.luecke.qp)} Qualifying Points`
              : ' — die Qualifying Points stehen dort bereits'}
            . Stelle oben rechts das Jahr um, wenn du das prüfen willst.
          </div>
        </div>
      )}

      {termine.length > 0 && (
        <section className="karte">
          <h2>Fristen</h2>
          <div className="liste">
            {termine.map((t) => (
              <div className="zeile" key={t.id}>
                <div className="zeile-haupt">
                  <div className="zeile-titel">
                    {t.titel}
                    {t.draengt && <span className="marke-geplant">bald</span>}
                  </div>
                  <div className="zeile-neben">{t.hinweis}</div>
                </div>
                <div className="punkte-block">
                  <b>{zahl(t.tageUebrig)}</b>
                  <span className="keine-qp">{t.tageUebrig === 1 ? 'Tag' : 'Tage'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="karte">
        <h2>
          {ziel.name} {daten.zieljahr}
        </h2>
        <p className="unter">
          Beide Hürden müssen stehen: die Gesamtpunkte und der Anteil an Qualifying Points.
        </p>

        <Balken
          name="Points"
          ist={ist.gesamt.points}
          plan={plan.gesamt.points}
          ziel={ziel.points}
        />
        <Balken
          name="Qualifying Points"
          ist={ist.gesamt.qp}
          plan={plan.gesamt.qp}
          ziel={ziel.qualifyingPoints}
          variante="qp"
        />

        <div className="legende">
          <span><i className="l-ist" /> geflogen / gebucht</span>
          <span><i className="l-qp" /> Qualifying Points</span>
          <span><i className="l-plan" /> geplant</span>
        </div>

        {tempo.belastbar && !lueckeIst.erreicht && (
          <p className="unter" style={{ margin: 'var(--s4) 0 0' }}>
            Im bisherigen Tempo von {daten.zieljahr} landest du zum Jahresende bei rund{' '}
            {zahl(tempo.hochrechnungPoints)} Points und {zahl(tempo.hochrechnungQp)}{' '}
            Qualifying Points — geplante Einträge nicht mitgerechnet.
          </p>
        )}
      </section>

      <section className="karte">
        <h2>Der Anstieg über {daten.zieljahr}</h2>
        <p className="unter">
          Anteil am jeweiligen Ziel. Beide Reihen auf einer Skala, damit sichtbar wird,
          welche der zwei Hürden die knappere ist.
        </p>
        <Kurve verlauf={verlauf} ziel={ziel} jahr={daten.zieljahr} />
      </section>

      {!lueckePlan.erreicht && (
        <section className="karte">
          <h2>So schließt du die Lücke</h2>
          <p className="unter">
            Gerechnet ab dem aktuellen Stand inklusive aller geplanten Einträge.
          </p>

          {rest.length > 0 && (
            <>
              <p className="abschnitt-titel">Ohne einen einzigen weiteren Flug sind noch drin:</p>
              <div className="liste" style={{ marginBottom: 'var(--s4)' }}>
                {rest.map((r) => (
                  <div className="zeile" key={r.quelle.id}>
                    <div className="zeile-haupt">
                      <div className="zeile-titel">{r.quelle.name}</div>
                      <div className="zeile-neben">
                        noch {menge(r.einheitenFrei, r.quelle.einheit, r.quelle.einheitPlural)} möglich
                      </div>
                    </div>
                    <div className="punkte-block">
                      <b>+{zahl(r.punkte.points)}</b>
                      <span className={r.punkte.qp === 0 ? 'keine-qp' : ''}>
                        {r.punkte.qp === 0 ? 'keine QP' : `+${zahl(r.punkte.qp)} QP`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="knopf klein" onClick={aufBoden}>
                Boden-Punkte eintragen
              </button>
            </>
          )}

          {ohneLimit.length > 0 && (
            <p className="unter" style={{ margin: 'var(--s4) 0 0' }}>
              Ohne festes Jahreslimit kommen dazu:{' '}
              {ohneLimit
                .map(
                  (o) =>
                    `${o.quelle.name} (${zahl(o.jeEinheit.points)} Points${
                      o.jeEinheit.qp > 0 ? ` + ${zahl(o.jeEinheit.qp)} QP` : ''
                    } je ${o.quelle.einheit})`,
                )
                .join(', ')}
              . Wie viel davon geht, hängt daran, wie viele du hast — deshalb stehen sie
              oben nicht mit.
            </p>
          )}

          {nachBoden.erreicht ? (
            <div className="merker" style={{ margin: 'var(--s4) 0 0' }}>
              <span aria-hidden="true">✅</span>
              <div>
                <b>Ohne weitere Flüge machbar</b>
                Wenn du die oben genannten Boden-Punkte alle mitnimmst, steht {ziel.name}{' '}
                auch ohne zusätzliche Flüge.
              </div>
            </div>
          ) : (
            <>
              <p className="abschnitt-titel" style={{ marginTop: 'var(--s5)' }}>
                Danach fehlen noch {zahl(nachBoden.points)} Points und {zahl(nachBoden.qp)}{' '}
                Qualifying Points — das entspricht:
              </p>
              <div className="tabelle-huelle">
                <table>
                  <thead>
                    <tr>
                      <th>Reiseklasse</th>
                      <th>Kurzstrecke</th>
                      <th>Langstrecke</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regelwerk.klassen.map((k) => {
                      const finde = (s: Strecke) =>
                        vorschlaege.find((v) => v.klasse === k.id && v.strecke === s)
                      return (
                        <tr key={k.id}>
                          <td>{k.name}</td>
                          <td>{finde('kontinental')?.segmente ?? '—'}</td>
                          <td>{finde('interkontinental')?.segmente ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="unter" style={{ margin: 'var(--s3) 0 var(--s4)' }}>
                Angaben in Flugsegmenten mit einer der vollintegrierten Airlines. Ein Hin-
                und Rückflug zählt als zwei Segmente.
                {economyKurz &&
                  ` Für dich in Economy heißt das: ${zahl(economyKurz.segmente)} Kurzstreckensegmente, also rund ${zahl(Math.ceil(economyKurz.segmente / 2))} Hin- und Rückreisen.`}
              </p>
              <button type="button" className="knopf klein" onClick={aufFluege}>
                Flug eintragen
              </button>
            </>
          )}

          {lueckePlan.qp > 0 && bodenMoeglich.qp < lueckePlan.qp && (
            <div className="merker" style={{ margin: 'var(--s4) 0 0' }}>
              <span aria-hidden="true">💡</span>
              <div>
                <b>Qualifying Points sind der Engpass</b>
                Marriott-Aufenthalte und der Kreditkarten-Willkommensbonus zählen nur auf
                die {zahl(ziel.points)} Points ein, nicht auf die{' '}
                {zahl(ziel.qualifyingPoints)} Qualifying Points. Die musst du fliegen —
                oder über Meilentausch, Uptrip und eVoucher holen.
              </div>
            </div>
          )}
        </section>
      )}

      <section className="karte">
        <h2>Woher die Punkte kommen</h2>
        <div className="tabelle-huelle">
          <table>
            <thead>
              <tr>
                <th>Quelle</th>
                <th>Points</th>
                <th>davon QP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Flüge
                  <div className="zeile-neben">
                    {menge(plan.anzahlFluege, 'Segment', 'Segmente')}
                  </div>
                </td>
                <td>{zahl(plan.fluege.points)}</td>
                <td>{zahl(plan.fluege.qp)}</td>
              </tr>
              {plan.proQuelle
                .filter((q) => q.einheitenGezaehlt > 0)
                .map((q) => (
                  <tr key={q.quelle.id}>
                    <td>{q.quelle.name}</td>
                    <td>{zahl(q.punkte.points)}</td>
                    <td>{zahl(q.punkte.qp)}</td>
                  </tr>
                ))}
              <tr className="summe">
                <td>Gesamt (inkl. geplant)</td>
                <td>{zahl(plan.gesamt.points)}</td>
                <td>{zahl(plan.gesamt.qp)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {plan.proQuelle.some((q) => q.ueberLimit) && (
          <div className="merker" style={{ margin: 'var(--s4) 0 0' }}>
            <span aria-hidden="true">✂️</span>
            <div>
              <b>Jahreslimit erreicht</b>
              {plan.proQuelle
                .filter((q) => q.ueberLimit)
                .map(
                  (q) =>
                    `${q.quelle.name}: ${menge(q.einheitenEingetragen, q.quelle.einheit, q.quelle.einheitPlural)} eingetragen, davon zählen ${zahl(q.einheitenGezaehlt)}. `,
                )}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
