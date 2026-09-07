import type { AppDaten, KlassenId, Strecke } from '../core/types'
import type { Regelwerk } from '../rules'
import { BASIS_REGELWERK } from '../rules'
import { zahl } from '../core/format'

interface Props {
  regelwerk: Regelwerk
  daten: AppDaten
  setDaten: (d: AppDaten) => void
}

const STRECKEN: { id: Strecke; name: string }[] = [
  { id: 'kontinental', name: 'Kurzstrecke' },
  { id: 'interkontinental', name: 'Langstrecke' },
]

export default function Regeln({ regelwerk, daten, setDaten }: Props) {
  const ov = daten.regelwerkOverrides
  const geaendert = Object.keys(ov).length > 0

  function setzeOverride(pfad: 'ziele' | 'flugPunkte' | 'bodenQuellen', schluessel: string, wert: object) {
    const bisher = (ov[pfad] as Record<string, object> | undefined) ?? {}
    setDaten({
      ...daten,
      regelwerkOverrides: {
        ...ov,
        [pfad]: { ...bisher, [schluessel]: { ...(bisher[schluessel] ?? {}), ...wert } },
      },
    })
  }

  return (
    <>
      <div className="merker">
        <span aria-hidden="true">📌</span>
        <div>
          <b>Stand: {regelwerk.stand}</b>
          {regelwerk.hinweis}
        </div>
      </div>

      <section className="karte">
        <h2>Statusschwellen</h2>
        <p className="unter">Zu erreichen innerhalb eines Kalenderjahres.</p>
        <div className="tabelle-huelle">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Points</th>
                <th>davon Qualifying Points</th>
              </tr>
            </thead>
            <tbody>
              {regelwerk.ziele.map((z) => (
                <tr key={z.id}>
                  <td>{z.name}</td>
                  <td>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={z.points}
                      aria-label={`${z.name}: Points`}
                      onChange={(e) =>
                        setzeOverride('ziele', z.id, { points: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={z.qualifyingPoints}
                      aria-label={`${z.name}: Qualifying Points`}
                      onChange={(e) =>
                        setzeOverride('ziele', z.id, {
                          qualifyingPoints: Number(e.target.value),
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="karte">
        <h2>Punkte pro Flugsegment</h2>
        <p className="unter">
          Ticketpreis und Entfernung spielen keine Rolle — nur Reiseklasse und
          Kurz-/Langstrecke.
        </p>
        <div className="tabelle-huelle">
          <table>
            <thead>
              <tr>
                <th>Reiseklasse</th>
                {STRECKEN.map((s) => (
                  <th key={s.id}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regelwerk.klassen.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  {STRECKEN.map((s) => (
                    <td key={s.id}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={regelwerk.flugPunkte[k.id as KlassenId]?.[s.id] ?? 0}
                        aria-label={`${k.name}, ${s.name}`}
                        onChange={(e) =>
                          setzeOverride('flugPunkte', k.id, { [s.id]: Number(e.target.value) })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="karte">
        <h2>Airlines mit Qualifying Points</h2>
        <p className="unter">
          Nur Flüge mit diesen Airlines liefern Qualifying Points. Alle anderen zählen
          ausschließlich auf die Gesamtpunkte ein.
        </p>
        <div className="chips">
          {regelwerk.qualifyingAirlines.map((a) => (
            <span className="chip gut" key={a.code}>
              {a.code} · {a.name}
            </span>
          ))}
        </div>
      </section>

      <section className="karte">
        <h2>Punkte ohne Flug</h2>
        <div className="tabelle-huelle">
          <table>
            <thead>
              <tr>
                <th>Quelle</th>
                <th>je Einheit</th>
                <th>Limit pro Jahr</th>
              </tr>
            </thead>
            <tbody>
              {regelwerk.bodenQuellen.map((q) => (
                <tr key={q.id}>
                  <td>
                    {q.name}
                    <div className="zeile-neben">
                      {q.freieEingabe ? 'Direkteingabe' : `pro ${q.einheit}`}
                    </div>
                  </td>
                  <td>
                    {q.freieEingabe
                      ? '—'
                      : `${zahl(q.pointsProEinheit ?? 0)} P${q.qpProEinheit ? ` + ${zahl(q.qpProEinheit)} QP` : ''}`}
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="kein Limit"
                      value={q.maxPointsProJahr ?? ''}
                      aria-label={`${q.name}: Jahreslimit`}
                      onChange={(e) =>
                        setzeOverride('bodenQuellen', q.id, {
                          maxPointsProJahr: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          {regelwerk.bodenQuellen.map((q) => (
            <p className="quellen" key={q.id} style={{ margin: 0 }}>
              <b style={{ color: 'var(--text)' }}>{q.name}:</b> {q.hinweis}
            </p>
          ))}
        </div>
      </section>

      <section className="karte">
        <h2>Quellen</h2>
        <p className="unter">
          Grundlage der Zahlen. Miles &amp; More ändert die Bedingungen regelmäßig — bei
          Abweichungen gilt dein Meilenkonto, und du kannst die Werte oben anpassen.
        </p>
        <ul className="quellen" style={{ paddingLeft: 20, margin: 0, display: 'grid', gap: 6 }}>
          {regelwerk.quellen.map((q) => (
            <li key={q.url}>
              <a href={q.url} target="_blank" rel="noopener noreferrer">
                {q.titel}
              </a>
            </li>
          ))}
        </ul>

        {geaendert && (
          <div className="knopf-reihe" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="knopf"
              onClick={() => setDaten({ ...daten, regelwerkOverrides: {} })}
            >
              Eigene Anpassungen verwerfen
            </button>
            <span className="hinweis" style={{ alignSelf: 'center', fontSize: 12.5 }}>
              Setzt alles auf den Stand vom {BASIS_REGELWERK.stand} zurück.
            </span>
          </div>
        )}
      </section>
    </>
  )
}
