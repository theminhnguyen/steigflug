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

/**
 * Lesezeichen, das die Historie auf der Miles-&-More-Seite holt und kopiert.
 *
 * Es umgeht keine Sicherung: Der Endpunkt beantwortet Anfragen nur von der
 * eigenen Seite aus, und genau dort läuft dieser Code — mit der Anmeldung, die
 * ohnehin schon besteht. Aus Steigflug heraus ginge es nicht, dort antwortet
 * der Server mit „nicht berechtigt“.
 */
const LESEZEICHEN = `javascript:(async()=>{const u='https://api.travelid.lufthansa.com/flightstats/v3/me/segmentList?departureDateRange=10000%20months&size=10000&page=0';try{const r=await fetch(u,{credentials:'include'});if(!r.ok)throw new Error('HTTP '+r.status);const t=await r.text();try{await navigator.clipboard.writeText(t);alert('Flughistorie kopiert ('+t.length+' Zeichen). Jetzt in Steigflug einfuegen.')}catch(e){const f=document.createElement('textarea');f.value=t;f.style.cssText='position:fixed;inset:8%;width:84%;height:70%;z-index:99999;font:12px monospace';document.body.appendChild(f);f.select();alert('Bitte jetzt kopieren, danach Seite neu laden.')}}catch(e){alert('Hat nicht geklappt: '+e.message+' - bist du bei miles-and-more.com angemeldet?')}})()`

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
  const [eingefuegt, setEingefuegt] = useState('')
  const [zeigeLesezeichen, setZeigeLesezeichen] = useState(false)

  const vorschau = useMemo((): { gelesen: Leseergebnis; plan: Verschmelzung } | null => {
    if (!roh) return null
    const gelesen = leseSegmente(roh.inhalt, gupAlsQp)
    return { gelesen, plan: verschmelze(daten.fluege, gelesen.fluege) }
  }, [roh, gupAlsQp, daten.fluege])

  /** Nimmt den Text entgegen, egal ob aus einer Datei oder eingefügt. */
  function verarbeite(text: string, herkunft: string) {
    setMeldung(null)
    try {
      const inhalt: unknown = JSON.parse(text)
      if (!istMilesAndMoreDatei(inhalt)) {
        setRoh(null)
        setMeldung({
          art: 'fehler',
          text: `${herkunft} enthält keine Miles-&-More-Segmentliste. Es wurde nichts geändert.`,
        })
        return
      }
      setRoh({ inhalt, name: herkunft })
    } catch {
      setRoh(null)
      setMeldung({
        art: 'fehler',
        text: `${herkunft} ließ sich nicht lesen — vermutlich unvollständig kopiert. Es wurde nichts geändert.`,
      })
    }
  }

  async function einlesen(datei: File) {
    verarbeite(await datei.text(), `„${datei.name}“`)
    if (dateiFeld.current) dateiFeld.current.value = ''
  }

  async function ausZwischenablage() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        setMeldung({ art: 'fehler', text: 'Die Zwischenablage ist leer.' })
        return
      }
      setEingefuegt(text)
      verarbeite(text, 'Der eingefügte Text')
    } catch {
      setMeldung({
        art: 'fehler',
        text: 'Dein Browser lässt das Auslesen der Zwischenablage nicht zu. Füge den Text unten von Hand ein.',
      })
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
    setEingefuegt('')
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
          öffnen, alles markieren und kopieren.
        </li>
        <li>Hier einfügen — kein Sichern als Datei nötig.</li>
      </ol>

      <div className="feld">
        <label htmlFor="mm-text">Antwort einfügen</label>
        <textarea
          id="mm-text"
          rows={3}
          spellCheck={false}
          placeholder={'{"SegmentListResponses":[ … ]}'}
          value={eingefuegt}
          onChange={(e) => {
            setEingefuegt(e.target.value)
            if (e.target.value.trim()) verarbeite(e.target.value, 'Der eingefügte Text')
            else setRoh(null)
          }}
        />
      </div>

      <div className="knopf-reihe">
        <button type="button" className="knopf" onClick={() => void ausZwischenablage()}>
          Aus Zwischenablage einfügen
        </button>
        <button type="button" className="knopf leise" onClick={() => dateiFeld.current?.click()}>
          … oder Datei auswählen
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

      <div className="werte-klappe" style={{ marginTop: 'var(--s5)' }}>
        <button
          type="button"
          className="knopf leise klein"
          style={{ padding: 0 }}
          onClick={() => setZeigeLesezeichen((z) => !z)}
        >
          {zeigeLesezeichen ? '▾' : '▸'} Schneller: als Lesezeichen einrichten
        </button>

        {zeigeLesezeichen && (
          <div style={{ marginTop: 'var(--s3)' }}>
            <p className="unter">
              Weiter automatisieren lässt es sich nicht: Der Endpunkt beantwortet Anfragen
              ausschließlich von miles-and-more.com selbst — Steigflug bekommt dort ein
              „nicht berechtigt“. Das ist eine Sicherheitsgrenze, und sie ist richtig so.
              Ein Lesezeichen umgeht sie nicht, es läuft <em>auf</em> der Seite und spart
              dir nur die Handgriffe.
            </p>
            <ol className="anleitung">
              <li>Den Text unten kopieren.</li>
              <li>
                Im Browser ein neues Lesezeichen anlegen, als Adresse den kopierten Text
                einsetzen, Name etwa „Flughistorie holen“.
              </li>
              <li>
                Bei miles-and-more.com angemeldet das Lesezeichen anklicken — die Historie
                liegt danach in der Zwischenablage.
              </li>
            </ol>
            <div className="feld">
              <textarea
                readOnly
                rows={3}
                spellCheck={false}
                value={LESEZEICHEN}
                onFocus={(e) => e.currentTarget.select()}
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}
              />
            </div>
            <div className="knopf-reihe">
              <button
                type="button"
                className="knopf klein"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(LESEZEICHEN)
                    .then(() => setMeldung({ art: 'gut', text: 'Lesezeichen-Text kopiert.' }))
                    .catch(() =>
                      setMeldung({
                        art: 'fehler',
                        text: 'Kopieren nicht möglich — bitte den Text von Hand markieren.',
                      }),
                    )
                }}
              >
                Text kopieren
              </button>
            </div>
            <p className="quellen" style={{ marginTop: 'var(--s3)' }}>
              Manche Seiten unterbinden solche Lesezeichen. Klappt es nicht, bleibt der
              Weg über Kopieren und Einfügen — der funktioniert immer.
            </p>
          </div>
        )}
      </div>

      <p className="quellen" style={{ marginTop: 'var(--s4)' }}>
        Der Endpunkt gehört nicht zu einer offiziellen Schnittstelle und kann sich ohne
        Ankündigung ändern. Er liefert <strong>geflogene</strong> Segmente — gebuchte
        Reisen in der Zukunft stehen dort noch nicht.
      </p>
    </section>
  )
}
