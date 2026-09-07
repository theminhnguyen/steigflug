import { useRef, useState } from 'react'
import type { AppDaten, SetDaten } from '../core/types'
import {
  alsJson,
  dateiname,
  hatEintraege,
  istSicherung,
  leereDaten,
  normalisiere,
  ohneGueltigesDatum,
} from '../store/store'
import { menge, zahl } from '../core/format'
import { ohneGeloeschte } from '../sync/merge'
import type { Konto } from '../sync/useKonto'
import KontoBereich from './Konto'
import MmImport from './MmImport'

interface Props {
  daten: AppDaten
  setDaten: SetDaten
  konto: Konto
}

export default function Daten({ daten, setDaten, konto }: Props) {
  const dateiFeld = useRef<HTMLInputElement>(null)
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'fehler'; text: string } | null>(null)
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(false)
  const [wartend, setWartend] = useState<{ daten: AppDaten; datei: string } | null>(null)

  function exportieren() {
    const blob = new Blob([alsJson(daten)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = dateiname(daten)
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Erst nach dem Klick freigeben, sonst bricht der Download in Safari ab.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMeldung({ art: 'gut', text: `Gesichert als ${dateiname(daten)}.` })
  }

  function uebernehmen(eingelesen: AppDaten) {
    setDaten(() => eingelesen)
    setWartend(null)
    setMeldung({
      art: 'gut',
      text: `${menge(eingelesen.fluege.length, 'Flug', 'Flüge')} und ${menge(eingelesen.boden.length, 'Boden-Eintrag', 'Boden-Einträge')} übernommen.`,
    })
  }

  async function importieren(datei: File) {
    try {
      const roh: unknown = JSON.parse(await datei.text())
      if (!istSicherung(roh)) {
        setMeldung({
          art: 'fehler',
          text: `„${datei.name}“ ist keine Steigflug-Sicherung. Es wurde nichts geändert.`,
        })
        return
      }
      const eingelesen = normalisiere(roh, daten.zieljahr)
      // Bestehende Einträge nie ohne Rückfrage überschreiben — der Import
      // ersetzt alles und lässt sich nicht rückgängig machen.
      if (hatEintraege(daten)) {
        setMeldung(null)
        setWartend({ daten: eingelesen, datei: datei.name })
      } else {
        uebernehmen(eingelesen)
      }
    } catch {
      setMeldung({
        art: 'fehler',
        text: `„${datei.name}“ konnte nicht gelesen werden. Es wurde nichts geändert.`,
      })
    } finally {
      if (dateiFeld.current) dateiFeld.current.value = ''
    }
  }

  return (
    <>
      <KontoBereich konto={konto} />

      <MmImport daten={daten} setDaten={setDaten} />

      <section className="karte">
        <h2>Sicherung</h2>
        <p className="unter">
          {konto.sitzung
            ? 'Zusätzlich zum Abgleich mit deinem Konto: eine Datei zum Mitnehmen, unabhängig von Google und Supabase.'
            : 'Ohne Anmeldung liegen deine Daten ausschließlich in diesem Browser — und sind weg, wenn du Browserdaten löschst oder das Gerät wechselst. Auf dem iPhone kommt dazu, dass Safari die Daten einer Seite nach etwa sieben Tagen ohne Besuch von sich aus löscht. Sichere sie deshalb als Datei, oder melde dich an.'}
        </p>

        <div className="knopf-reihe">
          <button type="button" className="knopf haupt" onClick={exportieren}>
            Als Datei sichern
          </button>
          <button
            type="button"
            className="knopf"
            onClick={() => dateiFeld.current?.click()}
          >
            Sicherung einlesen
          </button>
          <input
            ref={dateiFeld}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const datei = e.target.files?.[0]
              if (datei) void importieren(datei)
            }}
          />
        </div>

        {wartend && (
          <div className="merker" style={{ marginTop: 16, marginBottom: 0 }}>
            <span aria-hidden="true">⚠️</span>
            <div>
              <b>Bestehende Einträge werden ersetzt</b>
              Aktuell gespeichert: {menge(daten.fluege.length, 'Flug', 'Flüge')} und{' '}
              {menge(daten.boden.length, 'Boden-Eintrag', 'Boden-Einträge')}. „
              {wartend.datei}“ enthält{' '}
              {menge(wartend.daten.fluege.length, 'Flug', 'Flüge')} und{' '}
              {menge(wartend.daten.boden.length, 'Boden-Eintrag', 'Boden-Einträge')}. Das Einlesen
              überschreibt alles und lässt sich nicht rückgängig machen.
              <div className="knopf-reihe" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="knopf haupt"
                  onClick={() => uebernehmen(wartend.daten)}
                >
                  Ersetzen
                </button>
                <button
                  type="button"
                  className="knopf"
                  onClick={() => setWartend(null)}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {meldung && (
          <div className="merker" style={{ marginTop: 16, marginBottom: 0 }}>
            <span aria-hidden="true">{meldung.art === 'gut' ? '✅' : '⚠️'}</span>
            <div>{meldung.text}</div>
          </div>
        )}
      </section>

      <section className="karte">
        <h2>Bestand</h2>
        <div className="tabelle-huelle">
          <table>
            <tbody>
              <tr>
                <td>Flugsegmente insgesamt</td>
                <td>{zahl(ohneGeloeschte(daten.fluege).length)}</td>
              </tr>
              <tr>
                <td>davon geplant</td>
                <td>{zahl(ohneGeloeschte(daten.fluege).filter((f) => f.geplant).length)}</td>
              </tr>
              <tr>
                <td>Boden-Einträge insgesamt</td>
                <td>{zahl(ohneGeloeschte(daten.boden).length)}</td>
              </tr>
              <tr>
                <td>davon geplant</td>
                <td>{zahl(ohneGeloeschte(daten.boden).filter((b) => b.geplant).length)}</td>
              </tr>
              {ohneGueltigesDatum(daten) > 0 && (
                <tr>
                  <td>
                    Ohne gültiges Datum
                    <div className="zeile-neben">
                      Erscheinen in keiner Jahresansicht. Bitte die Sicherung prüfen.
                    </div>
                  </td>
                  <td>{zahl(ohneGueltigesDatum(daten))}</td>
                </tr>
              )}
              <tr>
                <td>Eigene Regel-Anpassungen</td>
                <td>{Object.keys(daten.regelwerkOverrides).length > 0 ? 'ja' : 'nein'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="karte">
        <h2>Alles löschen</h2>
        <p className="unter">
          Entfernt sämtliche Flüge, Boden-Einträge und Anpassungen von diesem Gerät. Das
          lässt sich nicht rückgängig machen — sichere vorher.
        </p>
        <div className="knopf-reihe">
          {loeschBestaetigung ? (
            <>
              <button
                type="button"
                className="knopf haupt"
                style={{ background: 'var(--warn)', borderColor: 'var(--warn)' }}
                onClick={() => {
                  setDaten((d) => leereDaten(d.zieljahr))
                  setLoeschBestaetigung(false)
                  setMeldung({ art: 'gut', text: 'Alle Daten wurden gelöscht.' })
                }}
              >
                Ja, wirklich alles löschen
              </button>
              <button
                type="button"
                className="knopf leise"
                onClick={() => setLoeschBestaetigung(false)}
              >
                Abbrechen
              </button>
            </>
          ) : (
            <button
              type="button"
              className="knopf"
              onClick={() => setLoeschBestaetigung(true)}
            >
              Daten löschen
            </button>
          )}
        </div>
      </section>
    </>
  )
}
