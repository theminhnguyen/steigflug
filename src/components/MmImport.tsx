import { useMemo, useRef, useState } from 'react'
import type { AppDaten, SetDaten } from '../core/types'
import {
  istMilesAndMoreDatei,
  leseSegmente,
  verschmelze,
  type Leseergebnis,
  type Verschmelzung,
} from '../import/milesandmore'
import { datumKurz, menge, zahl } from '../core/format'

interface Props {
  daten: AppDaten
  setDaten: SetDaten
}

const FELD_NAMEN: Record<string, string> = {
  statusPoints: 'StatusPoints',
  gupPoints: 'GupPoints',
  honPoints: 'HonPoints',
  statusMiles: 'StatusMiles',
  awardMiles: 'AwardMiles',
}

/**
 * Einlesen der Flughistorie aus dem Miles-&-More-Konto.
 *
 * Bewusst mit Vorschau vor dem Übernehmen: Der Endpunkt ist nicht dokumentiert,
 * und was genau in `GupPoints` steht, ist nicht belegt. Deshalb zeigt die
 * Vorschau, welche Felder überhaupt Werte hatten, und lässt die Deutung
 * umschalten, statt sie stillschweigend zu unterstellen.
 */
export default function MmImport({ daten, setDaten }: Props) {
  const dateiFeld = useRef<HTMLInputElement>(null)
  const [roh, setRoh] = useState<{ inhalt: unknown; name: string } | null>(null)
  const [gupAlsQp, setGupAlsQp] = useState(true)
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'fehler'; text: string } | null>(null)

  const vorschau = useMemo((): { gelesen: Leseergebnis; plan: Verschmelzung } | null => {
    if (!roh) return null
    const gelesen = leseSegmente(roh.inhalt, gupAlsQp)
    return { gelesen, plan: verschmelze(daten.fluege, gelesen.fluege) }
  }, [roh, gupAlsQp, daten.fluege])

  async function einlesen(datei: File) {
    setMeldung(null)
    try {
      const inhalt: unknown = JSON.parse(await datei.text())
      if (!istMilesAndMoreDatei(inhalt)) {
        setRoh(null)
        setMeldung({
          art: 'fehler',
          text: `„${datei.name}“ enthält keine Miles-&-More-Segmentliste. Es wurde nichts geändert.`,
        })
        return
      }
      setRoh({ inhalt, name: datei.name })
    } catch {
      setRoh(null)
      setMeldung({
        art: 'fehler',
        text: `„${datei.name}“ konnte nicht gelesen werden. Es wurde nichts geändert.`,
      })
    } finally {
      if (dateiFeld.current) dateiFeld.current.value = ''
    }
  }

  function uebernehmen() {
    if (!vorschau) return
    const { neu, aktualisiert } = vorschau.plan
    const nachId = new Map(aktualisiert.map((f) => [f.id, f]))
    setDaten((d) => ({
      ...d,
      fluege: [...d.fluege.map((f) => nachId.get(f.id) ?? f), ...neu],
    }))
    setRoh(null)
    setMeldung({
      art: 'gut',
      text: `${menge(neu.length, 'Flug', 'Flüge')} neu übernommen, ${menge(aktualisiert.length, 'Eintrag', 'Einträge')} ergänzt.`,
    })
  }

  return (
    <section className="karte">
      <h2>Aus Miles &amp; More einlesen</h2>
      <p className="unter">
        Dein Konto hat keinen Export-Knopf, gibt die eigene Flughistorie aber als Datei
        heraus. Damit kommen die <strong>tatsächlich gutgeschriebenen</strong> Punkte in
        die App statt der Berechnung.
      </p>

      <ol className="anleitung">
        <li>
          Bei <a href="https://www.miles-and-more.com" target="_blank" rel="noopener noreferrer">
            miles-and-more.com
          </a>{' '}
          anmelden.
        </li>
        <li>
          Im selben Browser{' '}
          <a
            href="https://api.travelid.lufthansa.com/flightstats/v3/me/segmentList?departureDateRange=10000%20months&size=10000&page=0"
            target="_blank"
            rel="noopener noreferrer"
          >
            diese Adresse
          </a>{' '}
          öffnen und die Antwort als Datei sichern.
        </li>
        <li>Die Datei hier auswählen.</li>
      </ol>

      <div className="knopf-reihe">
        <button type="button" className="knopf" onClick={() => dateiFeld.current?.click()}>
          Datei auswählen
        </button>
        <input
          ref={dateiFeld}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const datei = e.target.files?.[0]
            if (datei) void einlesen(datei)
          }}
        />
      </div>

      {vorschau && (
        <div className="vorschau">
          <p className="abschnitt-titel" style={{ marginTop: 'var(--s4)' }}>
            Gefunden in „{roh?.name}“
          </p>

          <div className="chips" style={{ marginBottom: 'var(--s3)' }}>
            <span className="chip gut">
              {menge(vorschau.plan.neu.length, 'Flug neu', 'Flüge neu')}
            </span>
            {vorschau.plan.aktualisiert.length > 0 && (
              <span className="chip">
                {menge(vorschau.plan.aktualisiert.length, 'Eintrag ergänzt', 'Einträge ergänzt')}
              </span>
            )}
            {vorschau.plan.unveraendert > 0 && (
              <span className="chip">{zahl(vorschau.plan.unveraendert)} schon vorhanden</span>
            )}
            {vorschau.gelesen.uebersprungen > 0 && (
              <span className="chip voll">
                {zahl(vorschau.gelesen.uebersprungen)} unlesbar, übersprungen
              </span>
            )}
          </div>

          <div className="merker">
            <span aria-hidden="true">🔎</span>
            <div>
              <b>Punktefelder mit Werten</b>
              {vorschau.gelesen.belegteFelder.length === 0
                ? 'Keines der Punktefelder war belegt — die Datei enthält offenbar keine Gutschriften.'
                : vorschau.gelesen.belegteFelder.map((f) => FELD_NAMEN[f] ?? f).join(', ')}
              . Vergleiche die Zahlen unten mit deinem Kontoauszug, bevor du übernimmst.
            </div>
          </div>

          <label className="schalter" style={{ marginBottom: 'var(--s3)' }}>
            <input
              type="checkbox"
              checked={gupAlsQp}
              onChange={(e) => setGupAlsQp(e.target.checked)}
            />
            GupPoints als Qualifying Points übernehmen
          </label>

          <div className="tabelle-huelle">
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Strecke</th>
                  <th>Points</th>
                  <th>QP</th>
                </tr>
              </thead>
              <tbody>
                {vorschau.gelesen.fluege.slice(0, 8).map((g) => (
                  <tr key={g.flug.id}>
                    <td>{datumKurz(g.flug.datum)}</td>
                    <td style={{ textAlign: 'left' }}>
                      {g.flug.von} → {g.flug.nach}
                      <div className="zeile-neben">
                        {g.flugnummer} · Klasse {g.buchungsklasse || '—'}
                      </div>
                    </td>
                    <td>{g.roh.statusPoints ?? '—'}</td>
                    <td>{gupAlsQp ? (g.roh.gupPoints ?? '—') : 'berechnet'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vorschau.gelesen.fluege.length > 8 && (
            <p className="hinweis" style={{ marginTop: 'var(--s2)' }}>
              … und {zahl(vorschau.gelesen.fluege.length - 8)} weitere.
            </p>
          )}

          <div className="knopf-reihe" style={{ marginTop: 'var(--s4)' }}>
            <button
              type="button"
              className="knopf haupt"
              disabled={vorschau.plan.neu.length === 0 && vorschau.plan.aktualisiert.length === 0}
              onClick={uebernehmen}
            >
              Übernehmen
            </button>
            <button type="button" className="knopf leise" onClick={() => setRoh(null)}>
              Verwerfen
            </button>
          </div>
          {vorschau.plan.neu.length === 0 && vorschau.plan.aktualisiert.length === 0 && (
            <span className="hinweis">
              Alles aus dieser Datei steht schon so in der App — es gibt nichts zu übernehmen.
            </span>
          )}
        </div>
      )}

      {meldung && (
        <div className="merker" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          <span aria-hidden="true">{meldung.art === 'gut' ? '✅' : '⚠️'}</span>
          <div>{meldung.text}</div>
        </div>
      )}

      <p className="quellen" style={{ marginTop: 'var(--s4)' }}>
        Der Endpunkt gehört nicht zu einer offiziellen Schnittstelle und kann sich ohne
        Ankündigung ändern. Er liefert <strong>geflogene</strong> Segmente — gebuchte
        Reisen in der Zukunft stehen dort noch nicht.
      </p>
    </section>
  )
}
