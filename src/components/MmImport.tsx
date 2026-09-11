import { useMemo, useRef, useState } from 'react'
import type { AppDaten, SetDaten } from '../core/types'
import type { Regelwerk } from '../rules'
import {
  istMilesAndMoreDatei,
  leseSegmente,
  pruefeGupDeutung,
  verschmelze,
  type Leseergebnis,
  type Verschmelzung,
} from '../import/milesandmore'
import { istKontoauszug, leseKontoauszug, type Kontoauszug } from '../import/kontoauszug'
import { datumKurz, menge, zahl } from '../core/format'
import KontoauszugVorschau from './KontoauszugVorschau'

interface Props {
  regelwerk: Regelwerk
  daten: AppDaten
  setDaten: SetDaten
  qualifyingCodes: string[]
}

const FLUGLISTE =
  'https://api.travelid.lufthansa.com/flightstats/v3/me/segmentList?departureDateRange=10000%20months&size=10000&page=0'
const KONTOAUSZUG =
  'https://api.miles-and-more.com/ui-services/v1/me/statement-ui-printer/table?renderVersion=v2'

type Herkunft = { art: 'eingefuegt' } | { art: 'datei'; name: string }

/** „Der eingefügte Text enthält …“ */
function alsSubjekt(h: Herkunft): string {
  return h.art === 'datei' ? `„${h.name}“` : 'Der eingefügte Text'
}

/** „Gefunden im eingefügten Text“ */
function alsOrt(h: Herkunft): string {
  return h.art === 'datei' ? `in „${h.name}“` : 'im eingefügten Text'
}

type Eingelesen =
  | { art: 'fluege'; inhalt: unknown; herkunft: Herkunft; nummer: number }
  | { art: 'konto'; auszug: Kontoauszug; herkunft: Herkunft; nummer: number }

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
export default function MmImport({ regelwerk, daten, setDaten, qualifyingCodes }: Props) {
  const dateiFeld = useRef<HTMLInputElement>(null)
  // Zählt jedes Einlesen hoch, damit die Kontoauszug-Vorschau mit frischer
  // Zuordnung beginnt, statt die Auswahl vom vorigen Auszug zu behalten.
  const nummer = useRef(0)
  const [roh, setRoh] = useState<Eingelesen | null>(null)
  const [gupAlsQp, setGupAlsQp] = useState(true)
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'fehler'; text: string } | null>(null)
  const [eingefuegt, setEingefuegt] = useState('')
  const [zeigeLesezeichen, setZeigeLesezeichen] = useState(false)

  const vorschau = useMemo((): {
    gelesen: Leseergebnis
    plan: Verschmelzung
    gup: ReturnType<typeof pruefeGupDeutung>
  } | null => {
    if (!roh || roh.art !== 'fluege') return null
    const gelesen = leseSegmente(roh.inhalt, gupAlsQp)
    return {
      gelesen,
      plan: verschmelze(daten.fluege, gelesen.fluege),
      gup: pruefeGupDeutung(gelesen.fluege, qualifyingCodes),
    }
  }, [roh, gupAlsQp, daten.fluege, qualifyingCodes])

  /** Nimmt den Text entgegen, egal ob aus einer Datei oder eingefügt. */
  function verarbeite(text: string, herkunft: Herkunft) {
    setMeldung(null)
    let inhalt: unknown
    try {
      inhalt = JSON.parse(text)
    } catch {
      setRoh(null)
      setMeldung({
        art: 'fehler',
        text: `${alsSubjekt(herkunft)} ließ sich nicht lesen — vermutlich unvollständig kopiert. Es wurde nichts geändert.`,
      })
      return
    }
    nummer.current += 1
    if (istMilesAndMoreDatei(inhalt)) {
      setRoh({ art: 'fluege', inhalt, herkunft, nummer: nummer.current })
    } else if (istKontoauszug(inhalt)) {
      setRoh({ art: 'konto', auszug: leseKontoauszug(inhalt), herkunft, nummer: nummer.current })
    } else {
      setRoh(null)
      setMeldung({
        art: 'fehler',
        text: `${alsSubjekt(herkunft)} enthält weder die Flughistorie noch den Kontoauszug von Miles & More. Es wurde nichts geändert.`,
      })
    }
  }

  async function einlesen(datei: File) {
    verarbeite(await datei.text(), { art: 'datei', name: datei.name })
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
      verarbeite(text, { art: 'eingefuegt' })
    } catch {
      setMeldung({
        art: 'fehler',
        text: 'Dein Browser lässt das Auslesen der Zwischenablage nicht zu. Füge den Text unten von Hand ein.',
      })
    }
  }

  function uebernehmen() {
    if (!vorschau) return
    const gelesen = vorschau.gelesen.fluege
    setDaten((d) => {
      // Bewusst hier noch einmal zusammengeführt statt mit dem Ergebnis der
      // Vorschau: Zwischen Anzeige und Klick kann sich der Bestand geändert
      // haben, und die Vorschau kannte ihn noch nicht.
      const plan = verschmelze(d.fluege, gelesen)
      const nachId = new Map(plan.aktualisiert.map((f) => [f.id, f]))
      return { ...d, fluege: [...d.fluege.map((f) => nachId.get(f.id) ?? f), ...plan.neu] }
    })
    setRoh(null)
    setEingefuegt('')
    // Die Zahlen kommen aus der Vorschau, nicht aus der Funktion oben: React
    // führt sie nicht zwingend sofort aus — eine dort gesetzte Variable stünde
    // beim Melden womöglich noch auf null.
    setMeldung({
      art: 'gut',
      text: `${menge(vorschau.plan.neu.length, 'Flug', 'Flüge')} neu übernommen, ${menge(vorschau.plan.aktualisiert.length, 'Eintrag', 'Einträge')} ergänzt.`,
    })
  }

  return (
    <section className="karte">
      <h2>Aus Miles &amp; More einlesen</h2>
      <p className="unter">
        Dein Konto hat keinen Export-Knopf, rückt Flughistorie und Kontoauszug aber
        heraus, wenn man weiß wo. Damit kommen die{' '}
        <strong>tatsächlich gutgeschriebenen</strong> Punkte in die App statt meiner
        Berechnung — beim Kontoauszug auch Uptrip, Marriott und Kreditkarte.
      </p>

      <ol className="anleitung">
        <li>
          Bei{' '}
          <a href="https://www.miles-and-more.com" target="_blank" rel="noopener noreferrer">
            miles-and-more.com
          </a>{' '}
          anmelden.
        </li>
        <li>
          Im <strong>selben Browser</strong> eine der beiden Adressen öffnen:{' '}
          <a href={FLUGLISTE} target="_blank" rel="noopener noreferrer">
            Flughistorie
          </a>{' '}
          oder{' '}
          <a href={KONTOAUSZUG} target="_blank" rel="noopener noreferrer">
            Kontoauszug
          </a>{' '}
          (Uptrip, Marriott, Kreditkarte). Es erscheint eine lange Textwand — das ist
          richtig so.
        </li>
        <li>
          Alles markieren und kopieren: am Mac <kbd>⌘ A</kbd>, dann <kbd>⌘ C</kbd>. Am
          iPhone lange auf den Text tippen, „Alles auswählen“, dann „Kopieren“.
        </li>
        <li>Hierher zurück und unten einfügen. Kein Sichern als Datei nötig.</li>
      </ol>

      <div className="feld">
        <label htmlFor="mm-text">Antwort einfügen</label>
        <textarea
          id="mm-text"
          rows={3}
          spellCheck={false}
          placeholder="Flughistorie oder Kontoauszug hier einfügen …"
          value={eingefuegt}
          onChange={(e) => {
            setEingefuegt(e.target.value)
            if (e.target.value.trim()) verarbeite(e.target.value, { art: 'eingefuegt' })
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
            Gefunden {roh && alsOrt(roh.herkunft)}
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

          {vorschau.gup.art !== 'offen' && (
            <div className="merker">
              <span aria-hidden="true">{vorschau.gup.art === 'bestaetigt' ? '✅' : '⚠️'}</span>
              <div>
                <b>
                  {vorschau.gup.art === 'bestaetigt'
                    ? 'GupPoints sind die Qualifying Points'
                    : 'GupPoints sind NICHT die Qualifying Points'}
                </b>
                {vorschau.gup.beleg}{' '}
                {vorschau.gup.art === 'bestaetigt'
                  ? 'Der Schalter unten kann angehakt bleiben.'
                  : 'Nimm den Haken unten heraus — sonst werden falsche Qualifying Points übernommen.'}
              </div>
            </div>
          )}

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

      {roh?.art === 'konto' && (
        <KontoauszugVorschau
          key={roh.nummer}
          auszug={roh.auszug}
          ort={alsOrt(roh.herkunft)}
          regelwerk={regelwerk}
          daten={daten}
          setDaten={setDaten}
          schliessen={(text) => {
            setRoh(null)
            if (text) {
              setEingefuegt('')
              setMeldung({ art: 'gut', text })
            }
          }}
        />
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
              <li>Unten auf „Text kopieren“ tippen.</li>
              <li>
                <strong>In Chrome:</strong> Lesezeichenleiste einblenden mit{' '}
                <kbd>⌘ ⇧ B</kbd>, dann Rechtsklick auf die Leiste → „Seite hinzufügen…“.
                Als Name „Flughistorie holen“, als <strong>URL</strong> den kopierten Text
                einfügen, speichern.
              </li>
              <li>
                <strong>In Safari:</strong> Irgendeine Seite mit <kbd>⌘ D</kbd> als
                Favorit sichern. Dann Lesezeichen → Lesezeichen bearbeiten, den neuen
                Eintrag anklicken und seine Adresse durch den kopierten Text ersetzen.
              </li>
              <li>
                Bei miles-and-more.com angemeldet das Lesezeichen anklicken — die Historie
                liegt danach in der Zwischenablage, fertig zum Einfügen.
              </li>
            </ol>
            <p className="quellen" style={{ margin: '0 0 var(--s3)' }}>
              Am iPhone lohnt das nicht: Lesezeichen dieser Art dort einzurichten ist
              umständlicher als der Weg über Kopieren und Einfügen.
            </p>
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
        Beide Adressen gehören nicht zu einer offiziellen Schnittstelle und können sich
        ohne Ankündigung ändern. Die Flughistorie liefert <strong>geflogene</strong>{' '}
        Segmente — gebuchte Reisen in der Zukunft stehen dort noch nicht.
      </p>
    </section>
  )
}
